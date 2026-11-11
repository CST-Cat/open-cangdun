// 苍盾题库服务（Go 版）：静态分发（Brotli 预压缩）+ 账密会话认证
// 编译: CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o cangdun-server .
// 账密引导与 Node 版一致：环境变量 > auth.json > 首次随机生成
package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/andybalholm/brotli"
	"golang.org/x/crypto/scrypt"
)

var (
	root       string // 静态根目录
	configDir  string // auth.json 所在目录
	sessionSec []byte // 会话签名密钥
)

const (
	sessionDays = 30
	cookieName  = "cd_sess"
)

type authStore struct {
	Username string `json:"username"`
	Salt     string `json:"salt"` // base64
	Hash     string `json:"hash"` // base64 scrypt
	Secret   string `json:"secret"`
	Created  string `json:"created,omitempty"`
}

func hashPassword(password string) (salt, hash string) {
	s := make([]byte, 16)
	if _, err := rand.Read(s); err != nil {
		log.Fatal(err)
	}
	d, err := scrypt.Key([]byte(password), s, 16384, 8, 1, 32)
	if err != nil {
		log.Fatal(err)
	}
	return base64.StdEncoding.EncodeToString(s), base64.StdEncoding.EncodeToString(d)
}

func verifyPassword(a *authStore, password string) bool {
	s, err := base64.StdEncoding.DecodeString(a.Salt)
	if err != nil {
		return false
	}
	want, err := base64.StdEncoding.DecodeString(a.Hash)
	if err != nil {
		return false
	}
	got, err := scrypt.Key([]byte(password), s, 16384, 8, 1, len(want))
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare(want, got) == 1
}

func loadAuth() *authStore {
	must(os.MkdirAll(configDir, 0o755))
	authFile := filepath.Join(configDir, "auth.json")
	if u, p := os.Getenv("ADMIN_USERNAME"), os.Getenv("ADMIN_PASSWORD"); u != "" && p != "" {
		salt, hash := hashPassword(p)
		log.Println("[auth] 使用环境变量 ADMIN_USERNAME/ADMIN_PASSWORD 登录凭据")
		return &authStore{Username: u, Salt: salt, Hash: hash, Secret: randToken()}
	}
	if b, err := os.ReadFile(authFile); err == nil {
		var a authStore
		if json.Unmarshal(b, &a) == nil && a.Secret != "" {
			return &a
		}
		log.Println("[auth] auth.json 损坏，重新生成")
	}
	// 首次部署：随机生成（仅日志显示一次明文）
	username := "cangdun-" + randHex(2)
	password := randB64(12)
	salt, hash := hashPassword(password)
	a := &authStore{Username: username, Salt: salt, Hash: hash, Secret: randToken(), Created: time.Now().UTC().Format(time.RFC3339)}
	b, _ := json.MarshalIndent(a, "", "  ")
	must(os.WriteFile(authFile, b, 0o600))
	fmt.Println("\n" + strings.Repeat("=", 52))
	fmt.Println("  首次部署已生成管理员账号（请立即记录，仅显示这一次）")
	fmt.Printf("  用户名: %s\n", username)
	fmt.Printf("  密  码: %s\n", password)
	fmt.Printf("  已保存: %s（挂载卷可跨重启/重建保留）\n", authFile)
	fmt.Println("  重置办法: 删除 auth.json 后重启容器，将重新随机生成")
	fmt.Println(strings.Repeat("=", 52) + "\n")
	return a
}

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
func randHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		log.Fatal(err)
	}
	return fmt.Sprintf("%x", b)
}
func randB64(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		log.Fatal(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func randToken() string    { return randB64(32) }

// ---------- 会话令牌（HMAC，无状态） ----------
func makeToken() string {
	exp := strconv.FormatInt(time.Now().Add(sessionDays*24*time.Hour).Unix(), 10)
	mac := hmac.New(sha256.New, sessionSec)
	mac.Write([]byte(exp))
	return exp + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func checkToken(token string) bool {
	expStr, sig, ok := strings.Cut(token, ".")
	if !ok {
		return false
	}
	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil || exp < time.Now().Unix() {
		return false
	}
	mac := hmac.New(sha256.New, sessionSec)
	mac.Write([]byte(expStr))
	want := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return subtle.ConstantTimeCompare([]byte(sig), []byte(want)) == 1
}

func isAuthed(r *http.Request) bool {
	c, err := r.Cookie(cookieName)
	return err == nil && checkToken(c.Value)
}

// ---------- 登录限流（每 IP 5 次失败锁 15 分钟） ----------
var (
	failMu   sync.Mutex
	failMap  = map[string]*failInfo{}
)

type failInfo struct {
	count     int
	lockUntil time.Time
}

func allowLogin(ip string) bool {
	failMu.Lock()
	defer failMu.Unlock()
	f, ok := failMap[ip]
	return !ok || f.lockUntil.Before(time.Now())
}

func noteFail(ip string) {
	failMu.Lock()
	defer failMu.Unlock()
	f := failMap[ip]
	if f == nil {
		f = &failInfo{}
		failMap[ip] = f
	}
	f.count++
	if f.count >= 5 {
		f.lockUntil = time.Now().Add(15 * time.Minute)
		f.count = 0
		log.Printf("[auth] IP %s 连续失败过多，锁定 15 分钟", ip)
	}
}

// ---------- 静态文件 ----------
var mimeByExt = map[string]string{
	".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
	".gif": "image/gif", ".webp": "image/webp", ".woff2": "font/woff2",
	".woff": "font/woff", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
}

func serveFile(w http.ResponseWriter, r *http.Request, fp string) {
	ctype := mimeByExt[strings.ToLower(filepath.Ext(fp))]
	if ctype == "" {
		ctype = "application/octet-stream"
	}
	w.Header().Set("Content-Type", ctype)
	w.Header().Set("Vary", "Accept-Encoding")
	if strings.HasPrefix(r.URL.Path, "/data/") {
		// 题库数据同 URL 原地刷新（章节内容/分区索引都会变），禁止 immutable 长缓存，
		// 否则数据更新后浏览器永远拿旧副本；协商缓存由 SW 与浏览器自行处理
		w.Header().Set("Cache-Control", "no-cache")
	} else if strings.HasPrefix(r.URL.Path, "/fonts/") || strings.HasPrefix(r.URL.Path, "/assets/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}
	ae := r.Header.Get("Accept-Encoding")
	// slim 模式：ch/kd 只有 .br → 支持 br 直发；不支持则解压兜底
	if !fileExists(fp) {
		if br, err := os.ReadFile(fp + ".br"); err == nil {
			if strings.Contains(ae, "br") {
				w.Header().Set("Content-Encoding", "br")
				w.Header().Set("Content-Length", strconv.Itoa(len(br)))
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(br)
				return
			}
			zr := brotli.NewReader(bytes.NewReader(br))
			raw, err := io.ReadAll(zr)
			if err == nil {
				w.Header().Set("Content-Length", strconv.Itoa(len(raw)))
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(raw)
				return
			}
		}
		http.NotFound(w, r)
		return
	}
	if strings.Contains(ae, "br") {
		if br, err := os.ReadFile(fp + ".br"); err == nil {
			w.Header().Set("Content-Encoding", "br")
			w.Header().Set("Content-Length", strconv.Itoa(len(br)))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(br)
			return
		}
	}
	f, err := os.Open(fp)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	http.ServeContent(w, r, filepath.Base(fp), modTime(fp), f)
}

func fileExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.Mode().IsRegular()
}

func modTime(p string) time.Time {
	st, err := os.Stat(p)
	if err != nil {
		return time.Time{}
	}
	return st.ModTime()
}

func staticHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	// 题库数据必须登录
	if strings.HasPrefix(r.URL.Path, "/data/") && !isAuthed(r) {
		jsonErr(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	clean := filepath.Clean("/" + r.URL.Path)
	fp := filepath.Join(root, clean)
	if !strings.HasPrefix(fp, root) { // 防目录穿越
		http.NotFound(w, r)
		return
	}
	if fileExists(fp) || fileExists(fp+".br") {
		serveFile(w, r, fp)
		return
	}
	// SPA 回退：无扩展名路径一律回 index.html
	if filepath.Ext(r.URL.Path) == "" {
		serveFile(w, r, filepath.Join(root, "index.html"))
		return
	}
	http.NotFound(w, r)
}

func jsonErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func main() {
	root = envOr("STATIC_ROOT", ".")
	if abs, err := filepath.Abs(root); err == nil {
		root = abs
	}
	configDir = envOr("CONFIG_DIR", filepath.Join(root, "auth-config"))
	port := envOr("PORT", "80")

	auth := loadAuth()
	sessionSec = []byte(auth.Secret)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/login", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		ip, _, _ := net.SplitHostPort(r.RemoteAddr)
		if !allowLogin(ip) {
			jsonErr(w, http.StatusTooManyRequests, "尝试过多，请 15 分钟后再试")
			return
		}
		var body struct{ Username, Password string }
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body); err != nil {
			jsonErr(w, http.StatusBadRequest, "bad request")
			return
		}
		if subtle.ConstantTimeCompare([]byte(body.Username), []byte(auth.Username)) == 1 && verifyPassword(auth, body.Password) {
			failMu.Lock()
			delete(failMap, ip)
			failMu.Unlock()
			http.SetCookie(w, &http.Cookie{
				Name: cookieName, Value: makeToken(), Path: "/", MaxAge: sessionDays * 86400,
				HttpOnly: true, SameSite: http.SameSiteLaxMode,
				Secure: r.Header.Get("X-Forwarded-Proto") == "https",
			})
			w.Header().Set("Cache-Control", "no-store")
			log.Printf("[auth] %s 登录成功", ip)
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			_, _ = w.Write([]byte(`{"ok":true,"username":"` + auth.Username + `"}`))
			return
		}
		noteFail(ip)
		log.Printf("[auth] %s 登录失败", ip)
		jsonErr(w, http.StatusUnauthorized, "用户名或密码错误")
	})
	mux.HandleFunc("/api/logout", func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{Name: cookieName, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode})
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})
	// ---------- 用户数据同步（答题记录/收藏/笔记） ----------
	// 整包 JSON 存 configDir/userdata.json（与 auth.json 同卷，跨重建保留）；
	// 服务端不解析内容，只按顶层 kind 合并（PUT 只覆盖本次带来的 kind）。
	var userdataMu sync.Mutex
	userdataPath := filepath.Join(configDir, "userdata.json")
	mux.HandleFunc("/api/userdata", func(w http.ResponseWriter, r *http.Request) {
		if !isAuthed(r) {
			jsonErr(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		switch r.Method {
		case http.MethodGet:
			userdataMu.Lock()
			b, err := os.ReadFile(userdataPath)
			userdataMu.Unlock()
			if err != nil {
				b = []byte("{}")
			}
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			_, _ = w.Write(b)
		case http.MethodPut:
			raw, err := io.ReadAll(io.LimitReader(r.Body, 32<<20))
			if err != nil {
				jsonErr(w, http.StatusBadRequest, "bad request")
				return
			}
			var incoming map[string]json.RawMessage
			if err := json.Unmarshal(raw, &incoming); err != nil {
				jsonErr(w, http.StatusBadRequest, "bad request")
				return
			}
			userdataMu.Lock()
			merged := map[string]json.RawMessage{}
			if b, err := os.ReadFile(userdataPath); err == nil {
				_ = json.Unmarshal(b, &merged)
			}
			for k, v := range incoming {
				merged[k] = v
			}
			out, err := json.Marshal(merged)
			if err == nil {
				tmp := userdataPath + ".tmp"
				if err = os.WriteFile(tmp, out, 0o600); err == nil {
					err = os.Rename(tmp, userdataPath)
				}
			}
			userdataMu.Unlock()
			if err != nil {
				jsonErr(w, http.StatusInternalServerError, "write failed")
				return
			}
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			_, _ = w.Write([]byte(`{"ok":true}`))
		default:
			jsonErr(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})
	mux.HandleFunc("/api/session", func(w http.ResponseWriter, r *http.Request) {
		if isAuthed(r) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			_, _ = w.Write([]byte(`{"username":"` + auth.Username + `"}`))
			return
		}
		jsonErr(w, http.StatusUnauthorized, "unauthorized")
	})
	mux.HandleFunc("/", staticHandler)

	log.Printf("[cangdun] 服务已启动: http://localhost:%s  （静态根: %s）", port, root)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

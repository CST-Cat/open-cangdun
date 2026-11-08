# 苍盾考研政治题库 —— 一键部署镜像（Go 静态二进制 + Brotli 数据）
# 构建：docker build -t cangdun .   运行：docker run -d -p 37080:80 cangdun
# 首次启动自动生成随机账密，docker logs cangdun 查看

# ---------- 阶段 1：前端构建 + 数据流水线（slim：大文件只留 Brotli） ----------
FROM node:22-alpine AS build
WORKDIR /build

# 依赖层（独立 COPY 以利用缓存）
COPY app/package.json app/package-lock.json ./
RUN npm ci

# 应用源码（public/fonts 已含裁剪好的字体子集，无需联网下载字体）
COPY app/ .

# 题库数据 → 分片 + Brotli 预压缩
COPY webapp/data /in/data
COPY webapp/assets /in/assets
RUN node scripts/optimize-data.mjs /in/data --slim

RUN npm run build

# ---------- 阶段 2：Go 静态二进制（vendor 依赖，构建免网络；upx 再压 ~50%） ----------
FROM golang:1.23-alpine AS gobuild
WORKDIR /src
COPY app/server-go/ .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /cangdun-server . \
    && apk add --no-cache upx \
    && upx --lzma -q -o /cangdun-server.packed /cangdun-server \
    && mv /cangdun-server.packed /cangdun-server

# ---------- 阶段 3：scratch —— 只有二进制和数据，无任何运行时 ----------
FROM scratch
COPY --from=gobuild /cangdun-server /cangdun-server
COPY --from=build /build/dist /srv
ENV STATIC_ROOT=/srv \
    CONFIG_DIR=/config \
    PORT=80
EXPOSE 80
ENTRYPOINT ["/cangdun-server"]

// 数据访问层：fetch + 内存缓存 + 请求去重 + 超时 + 预取
// 所有产物均为 immutable 静态文件（服务端 immutable 缓存 + SW 兜底）
import type { Catalog, Chapter, Kaodian, KaodianIndexItem, Tikus } from './types'

const TIMEOUT = 10_000
const mem = new Map<string, unknown>()
const inflight = new Map<string, Promise<unknown>>()

async function getJSON<T>(url: string): Promise<T> {
  if (mem.has(url)) return mem.get(url) as T
  const existing = inflight.get(url)
  if (existing) return existing as Promise<T>
  const p = (async () => {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), TIMEOUT)
    try {
      const res = await fetch(url, { signal: ac.signal })
      if (!res.ok) {
        // 会话失效 → 通知全局门禁切换到登录页
        if (res.status === 401) window.dispatchEvent(new Event('cd:unauth'))
        throw new Error(`HTTP ${res.status}`)
      }
      const data = (await res.json()) as T
      mem.set(url, data)
      return data
    } finally {
      clearTimeout(timer)
      inflight.delete(url)
    }
  })()
  inflight.set(url, p)
  return p as Promise<T>
}

/** 静默预取：不抛错、不打扰 UI */
export function prefetch(url: string): void {
  void getJSON(url).catch(() => {})
}

export const getTikus = () => getJSON<Tikus>('/data/tikus.json')
export const getCatalog = (idx: number) => getJSON<Catalog>(`/data/catalog/${idx}.json`)
export const getChapter = (id: string) => getJSON<Chapter>(`/data/ch/${id}.json`)
export const getKaodianIndex = () => getJSON<KaodianIndexItem[]>('/data/kd/index.json')
export const getKaodian = (id: string) => getJSON<Kaodian>(`/data/kd/${id}.json`)

export const prefetchChapter = (id: string) => prefetch(`/data/ch/${id}.json`)
export const prefetchCatalog = (idx: number) => prefetch(`/data/catalog/${idx}.json`)
export const prefetchKaodian = (id: string) => prefetch(`/data/kd/${id}.json`)

/** 已加载章节的题目（供跨页复用，如考点页跳转） */
export function peekChapter(id: string): Chapter | undefined {
  return mem.get(`/data/ch/${id}.json`) as Chapter | undefined
}

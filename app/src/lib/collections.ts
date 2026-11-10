// 收藏与笔记：localStorage 持久化 + 轻量订阅（与 progress.ts 答题记录同一套模式）
// 收藏 cd.favs.v1:  { [chapterId]: { [qid]: ts } }
// 笔记 cd.notes.v1: { [chapterId]: { [qid]: { t: 正文, ts } } }
import { useSyncExternalStore } from 'react'

const FAV_KEY = 'cd.favs.v1'
const NOTE_KEY = 'cd.notes.v1'

type FavMap = Record<string, Record<string, number>>
export type NoteEntry = { t: string; ts: number }
type NoteMap = Record<string, Record<string, NoteEntry>>

let favs: FavMap | null = null
let notes: NoteMap | null = null
let version = 0
const listeners = new Set<() => void>()

function loadFavs(): FavMap {
  if (favs) return favs
  try {
    favs = JSON.parse(localStorage.getItem(FAV_KEY) ?? '{}') as FavMap
  } catch {
    favs = {}
  }
  return favs!
}

function loadNotes(): NoteMap {
  if (notes) return notes
  try {
    notes = JSON.parse(localStorage.getItem(NOTE_KEY) ?? '{}') as NoteMap
  } catch {
    notes = {}
  }
  return notes!
}

function persist() {
  version++
  try {
    if (favs) localStorage.setItem(FAV_KEY, JSON.stringify(favs))
    if (notes) localStorage.setItem(NOTE_KEY, JSON.stringify(notes))
  } catch {
    // 配额满：静默失败（本会话内存中仍可用）
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** 收藏/笔记变更版本号 —— 组件用它触发重渲染后再直接读数据 */
export function useCollectionsVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

// ---------- 收藏 ----------

export function isFavorite(chapterId: string, qid: string): boolean {
  return loadFavs()[chapterId]?.[qid] !== undefined
}

/** 切换收藏，返回切换后是否已收藏 */
export function toggleFavorite(chapterId: string, qid: string): boolean {
  const all = loadFavs()
  const ch = (all[chapterId] ??= {})
  if (ch[qid] !== undefined) {
    delete ch[qid]
    if (Object.keys(ch).length === 0) delete all[chapterId]
    persist()
    return false
  }
  ch[qid] = Date.now()
  persist()
  return true
}

export function favoriteCount(): number {
  return Object.values(loadFavs()).reduce((s, ch) => s + Object.keys(ch).length, 0)
}

export type FavoriteChapter = { chapterId: string; qids: string[]; latest: number }
/** 收藏按章聚合（最近收藏的章在前；章内保持收藏时间序，页面再按原题序排） */
export function favoriteChapters(): FavoriteChapter[] {
  const out: FavoriteChapter[] = []
  for (const [chapterId, qs] of Object.entries(loadFavs())) {
    const entries = Object.entries(qs)
    if (entries.length === 0) continue
    out.push({
      chapterId,
      qids: entries.map(([qid]) => qid),
      latest: Math.max(...entries.map(([, ts]) => ts)),
    })
  }
  return out.sort((a, b) => b.latest - a.latest)
}

// ---------- 笔记 ----------

export function getNote(chapterId: string, qid: string): string {
  return loadNotes()[chapterId]?.[qid]?.t ?? ''
}

export function hasNote(chapterId: string, qid: string): boolean {
  return getNote(chapterId, qid).trim().length > 0
}

/** 保存笔记；正文为空（去空白后）则删除该条 */
export function setNote(chapterId: string, qid: string, text: string) {
  const all = loadNotes()
  if (text.trim().length === 0) {
    if (all[chapterId]) {
      delete all[chapterId][qid]
      if (Object.keys(all[chapterId]).length === 0) delete all[chapterId]
    }
  } else {
    const ch = (all[chapterId] ??= {})
    ch[qid] = { t: text, ts: Date.now() }
  }
  persist()
}

export function deleteNote(chapterId: string, qid: string) {
  setNote(chapterId, qid, '')
}

export function noteCount(): number {
  return Object.values(loadNotes()).reduce((s, ch) => s + Object.keys(ch).length, 0)
}

export type NoteChapter = { chapterId: string; notes: { qid: string; t: string; ts: number }[]; latest: number }
/** 笔记按章聚合（最近编辑的章在前；章内最近编辑在前） */
export function noteChapters(): NoteChapter[] {
  const out: NoteChapter[] = []
  for (const [chapterId, qs] of Object.entries(loadNotes())) {
    const list = Object.entries(qs)
      .map(([qid, n]) => ({ qid, t: n.t, ts: n.ts }))
      .sort((a, b) => b.ts - a.ts)
    if (list.length === 0) continue
    out.push({ chapterId, notes: list, latest: list[0].ts })
  }
  return out.sort((a, b) => b.latest - a.latest)
}

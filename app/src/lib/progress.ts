// 答题记录：localStorage 持久化 + 轻量订阅
// 结构（紧凑优先，防超 5MB）：R[chapterId][qid] = [pickedLetterRun, ok(0/1), ts]
import { useSyncExternalStore } from 'react'
import { isPulling, registerSync, touchAndPush } from './sync'

const KEY = 'cd.records.v1'
const LAST = 'cd.last.v1'

export type Rec = [string, 0 | 1, number]
type RecMap = Record<string, Record<string, Rec>>

let cached: RecMap | null = null
let version = 0
const listeners = new Set<() => void>()

function load(): RecMap {
  if (cached) return cached
  try {
    cached = JSON.parse(localStorage.getItem(KEY) ?? '{}') as RecMap
  } catch {
    cached = {}
  }
  return cached!
}

function persist() {
  version++
  try {
    localStorage.setItem(KEY, JSON.stringify(cached))
  } catch {
    // 配额满：静默失败（记录仍在本会话内存中可用）
  }
  listeners.forEach((l) => l())
  if (!isPulling()) touchAndPush('records')
}

/** 记录变更版本号 —— 组件用它触发重渲染后再直接读数据 */
export function useRecordsVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const getSnapshot = load

export function getChapterRecords(chapterId: string): Record<string, Rec> {
  return load()[chapterId] ?? {}
}

export function recordAnswer(chapterId: string, qid: string, picked: string, ok: boolean) {
  const all = load()
  const ch = (all[chapterId] ??= {})
  ch[qid] = [picked, ok ? 1 : 0, Date.now()]
  persist()
}

/** 多选按集合比较（顺序无关） */
export function judge(picked: string[], answer: string): boolean {
  if (picked.length === 0) return false
  const want = answer.split('').sort().join('')
  return [...picked].sort().join('') === want
}

export type ChapterStat = { answered: number; correct: number }
export function chapterStat(chapterId: string): ChapterStat {
  const recs = getChapterRecords(chapterId)
  let answered = 0
  let correct = 0
  for (const [, [, ok]] of Object.entries(recs)) {
    answered++
    if (ok) correct++
  }
  return { answered, correct }
}

export type GlobalStat = { chapters: number; answered: number; correct: number }
export function globalStat(): GlobalStat {
  const all = load()
  let chapters = 0
  let answered = 0
  let correct = 0
  for (const recs of Object.values(all)) {
    if (Object.keys(recs).length === 0) continue
    chapters++
    for (const [, [, ok]] of Object.entries(recs)) {
      answered++
      if (ok) correct++
    }
  }
  return { chapters, answered, correct }
}

export type TodayStat = { answered: number; correct: number }
/** 今日答题（按记录时间戳，本地自然日） */
export function todayStat(): TodayStat {
  const d = new Date()
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  let answered = 0
  let correct = 0
  for (const recs of Object.values(load())) {
    for (const [, [, ok, ts]] of Object.entries(recs)) {
      if (ts >= start) {
        answered++
        if (ok) correct++
      }
    }
  }
  return { answered, correct }
}

export type WrongChapter = { chapterId: string; wrong: number; answered: number }
/** 错题按章聚合（错多在前） */
export function wrongChapters(): WrongChapter[] {
  const out: WrongChapter[] = []
  for (const [chapterId, recs] of Object.entries(load())) {
    let wrong = 0
    let answered = 0
    for (const [, [, ok]] of Object.entries(recs)) {
      answered++
      if (!ok) wrong++
    }
    if (wrong > 0) out.push({ chapterId, wrong, answered })
  }
  return out.sort((a, b) => b.wrong - a.wrong)
}

export function wrongStat(): { wrong: number; chapters: number } {
  const w = wrongChapters()
  return { wrong: w.reduce((s, x) => s + x.wrong, 0), chapters: w.length }
}

export function clearAll() {
  cached = {}
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(LAST)
  } catch { /* ignore */ }
  persist()
}

/** 最近刷题位置（首页「继续刷题」） */
export function setLast(chapterId: string, name: string, qIdx: number) {
  try {
    localStorage.setItem(LAST, JSON.stringify({ c: chapterId, n: name, q: qIdx }))
  } catch { /* ignore */ }
  if (!isPulling()) touchAndPush('records')
}
export function getLast(): { c: string; n: string; q: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST) ?? 'null')
    return v && typeof v.c === 'string' ? v : null
  } catch {
    return null
  }
}

// ---------- 云端同步（服务端 userdata.json 的 records kind：记录 + 最近位置） ----------
function applyRemoteRecords(data: unknown) {
  const d = data as { map?: RecMap; last?: { c: string; n: string; q: number } | null } | null
  if (!d || typeof d !== 'object') return
  cached = d.map && typeof d.map === 'object' ? d.map : {}
  version++
  try {
    localStorage.setItem(KEY, JSON.stringify(cached))
    if (d.last && typeof d.last.c === 'string') localStorage.setItem(LAST, JSON.stringify(d.last))
    else localStorage.removeItem(LAST)
  } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

registerSync('records', () => ({ map: load(), last: getLast() }), applyRemoteRecords)

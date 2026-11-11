// 用户数据云端同步：服务端整包存 /config/userdata.json（与账密同卷，跨重建保留）
// 本地 localStorage 仍是第一数据源（离线可刷）；登录后拉取一次，按 kind 的 updatedAt 新者胜；
// 本地每次变更后防抖推送对应 kind。kind: records（含最近位置）/ favs / notes

export type SyncKind = 'records' | 'favs' | 'notes'
const KINDS: SyncKind[] = ['records', 'favs', 'notes']
const META = 'cd.sync.v1'

type Meta = Partial<Record<SyncKind, number>>

function loadMeta(): Meta {
  try {
    return JSON.parse(localStorage.getItem(META) ?? '{}') as Meta
  } catch {
    return {}
  }
}
function saveMeta(m: Meta) {
  try {
    localStorage.setItem(META, JSON.stringify(m))
  } catch { /* ignore */ }
}
export function kindTs(kind: SyncKind): number {
  return loadMeta()[kind] ?? 0
}
function setKindTs(kind: SyncKind, ts: number) {
  const m = loadMeta()
  m[kind] = ts
  saveMeta(m)
}

type Provider = () => unknown
type Applier = (data: unknown) => void
const providers = new Map<SyncKind, Provider>()
const appliers = new Map<SyncKind, Applier>()

/** 各存储模块加载时自注册：provide 给出当前整包数据，apply 用远端整包覆盖本地 */
export function registerSync(kind: SyncKind, provide: Provider, apply: Applier) {
  providers.set(kind, provide)
  appliers.set(kind, apply)
}

let pulling = false
/** 拉取应用远端数据期间为真：各 persist() 据此跳过回推，防循环 */
export function isPulling(): boolean {
  return pulling
}

const timers = new Map<SyncKind, ReturnType<typeof setTimeout>>()

/** 本地变更入口：更新该 kind 的时间戳并防抖推送 */
export function touchAndPush(kind: SyncKind) {
  setKindTs(kind, Date.now())
  const old = timers.get(kind)
  if (old) clearTimeout(old)
  timers.set(
    kind,
    setTimeout(() => {
      timers.delete(kind)
      void pushKind(kind)
    }, 800),
  )
}

async function pushKind(kind: SyncKind) {
  const provide = providers.get(kind)
  if (!provide) return
  try {
    await fetch('/api/userdata', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [kind]: { data: provide(), updatedAt: kindTs(kind) } }),
    })
  } catch {
    // 离线/未登录：静默，下次变更再推
  }
}

function nonEmpty(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if ('map' in d) return nonEmpty(d.map) || d.last != null
  return Object.keys(d).length > 0
}

type RemoteEntry = { data: unknown; updatedAt: number }
let pulled = false

/** 登录后拉取一次：逐 kind 比较 updatedAt，新者覆盖旧者；本地独有的数据反向推上去（迁移） */
export async function pullSync() {
  if (pulled) return
  pulled = true
  let remote: Partial<Record<SyncKind, RemoteEntry>>
  try {
    const res = await fetch('/api/userdata', { cache: 'no-store' })
    if (!res.ok) return
    remote = (await res.json()) as Partial<Record<SyncKind, RemoteEntry>>
  } catch {
    return
  }
  pulling = true
  try {
    for (const kind of KINDS) {
      const entry = remote?.[kind]
      const local = kindTs(kind)
      if (entry && typeof entry.updatedAt === 'number' && entry.updatedAt > local) {
        appliers.get(kind)?.(entry.data)
        setKindTs(kind, entry.updatedAt)
      } else {
        const provide = providers.get(kind)
        if (!provide) continue
        const hasLocal = nonEmpty(provide())
        if (!hasLocal) continue
        if (!entry) {
          // 服务端还没有这个 kind：本地数据迁移上行
          if (local === 0) setKindTs(kind, Date.now())
          await pushKind(kind)
        } else if (local > entry.updatedAt) {
          await pushKind(kind)
        }
      }
    }
  } finally {
    pulling = false
  }
}

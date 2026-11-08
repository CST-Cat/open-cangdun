import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, ArrowRightIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getCatalog, getSections, getTikus, prefetchCatalog, prefetchChapter } from '@/lib/data'
import { chapterStat, useRecordsVersion } from '@/lib/progress'
import type { Book, Catalog, SectionEntry, Sections, Tikus } from '@/lib/types'
import { cn } from '@/lib/utils'

/** 章节行 */
function ChapterRow({
  id,
  name,
  count,
  onClick,
}: {
  id: string
  name: string
  count: number
  onClick: () => void
}) {
  const st = chapterStat(id)
  const pct = count ? Math.round((st.answered / count) * 100) : 0
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => prefetchChapter(id)}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary active:bg-secondary"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] leading-snug">{name}</div>
        {st.answered > 0 && (
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {st.answered}/{count}
            </span>
          </div>
        )}
      </div>
      <Badge variant="secondary" className="shrink-0 tabular-nums">
        {count} 题
      </Badge>
    </button>
  )
}

/** 一本书：科目 chips + 章节列表（普通渲染，无手风琴，杜绝裁剪） */
function BookCard({
  book,
  displayName,
  tikuIdx,
  onNavigate,
}: {
  book: Book
  displayName?: string
  tikuIdx: Map<string, number>
  onNavigate: (tiku: string, subj: string, ids: string[], sIdx: number) => void
}) {
  const idx = tikuIdx.get(book.tiku)
  const [cata, setCata] = useState<Catalog | null>(null)
  const [failed, setFailed] = useState(false)
  const [openSubj, setOpenSubj] = useState<string | null>(null)

  useEffect(() => {
    if (idx === undefined) return
    let alive = true
    setFailed(false)
    void getCatalog(idx)
      .then((c) => alive && setCata(c))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [idx])

  const subjects = useMemo(() => Object.entries(cata ?? {}), [cata])
  // 每个科目只有一章时直接平铺（如真题章节版），否则显示科目 chips
  const flat = useMemo(() => {
    if (!cata) return null
    const entries = Object.entries(cata)
    if (entries.length > 1 && entries.every(([, l]) => l.length === 1)) {
      return entries
        .flatMap(([, l]) => l)
        .sort((a, b) => Number(a.id) - Number(b.id))
    }
    return null
  }, [cata])

  const navigateTo = (subj: string, ids: string[], sIdx: number) =>
    onNavigate(book.tiku, subj, ids, sIdx)

  return (
    <Card className="rounded-2xl shadow-none" onMouseEnter={() => idx !== undefined && prefetchCatalog(idx)}>
      <CardContent className="px-4 py-3.5">
        <div className="flex items-center gap-2 pb-0.5">
          <span className="size-1.5 rounded-full bg-primary" />
          <h3 className="text-[16px] font-semibold tracking-tight">{displayName ?? book.name}</h3>
        </div>

        {failed && (
          <p className="py-3 text-sm text-muted-foreground">目录加载失败</p>
        )}
        {!cata && !failed && (
          <div className="mt-2.5 space-y-2">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-4/5 rounded-lg" />
          </div>
        )}

        {cata && flat && (
          <div className="mt-1.5 divide-y divide-border/40 overflow-hidden rounded-xl border border-border/60">
            {flat.map((ch, i) => (
              <ChapterRow
                key={ch.id}
                id={ch.id}
                name={ch.n}
                count={ch.c}
                onClick={() => navigateTo('', flat.map((x) => x.id), i)}
              />
            ))}
          </div>
        )}

        {cata && !flat && (
          <>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {subjects.map(([subj, chapters]) => (
                <button
                  key={subj}
                  onClick={() => setOpenSubj(openSubj === subj ? null : subj)}
                  onMouseEnter={() => prefetchChapter(chapters[0]?.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[13px] transition-colors',
                    openSubj === subj
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-background hover:border-primary/40 hover:bg-secondary',
                  )}
                >
                  {subj}
                  <span className="ml-1 opacity-60 tabular-nums">{chapters.length}</span>
                </button>
              ))}
            </div>
            {openSubj && cata[openSubj] && (
              <div className="mt-2.5 divide-y divide-border/40 overflow-hidden rounded-xl border border-border/60">
                {cata[openSubj].map((ch, i) => (
                  <ChapterRow
                    key={ch.id}
                    id={ch.id}
                    name={ch.n}
                    count={ch.c}
                    onClick={() => navigateTo(openSubj, cata[openSubj].map((x) => x.id), i)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

const SECTION_NAME: Record<string, string> = {
  qianghua: '强化题库',
  chongci: '冲刺模拟',
  jingxuan: '精选题库',
  zhuanti: '专题模块',
}

export default function SectionPage() {
  const { key = '' } = useParams()
  const navigate = useNavigate()
  useRecordsVersion()
  const [sections, setSections] = useState<Sections | null>(null)
  const [tikus, setTikus] = useState<Tikus | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([getSections(), getTikus()])
      .then(([s, t]) => {
        if (alive) {
          setSections(s)
          setTikus(t)
        }
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const tikuIdx = useMemo(
    () => new Map((tikus ?? []).map((n, i) => [n, i])),
    [tikus],
  )

  const onNavigate = (tiku: string, subj: string, ids: string[], sIdx: number) =>
    navigate(`/ch/${ids[sIdx]}`, { state: { tiku, subj, siblings: ids, sIdx } })

  const entriesOf = (key: string): SectionEntry[] => {
    if (!sections) return []
    if (key === 'qianghua') return sections.qianghua as SectionEntry[]
    if (key === 'jingxuan') return sections.jingxuan
    if (key === 'zhuanti') return sections.zhuanti
    return []
  }

  const renderBook = (b: Book, display?: string) => (
    <BookCard key={b.tiku + (b.subject ?? '')} book={b} displayName={display} tikuIdx={tikuIdx} onNavigate={onNavigate} />
  )

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24">
      <div className="sticky top-11 z-40 -mx-4 bg-background/80 px-4 pb-2 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
            <Link to="/" aria-label="返回首页">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div className="text-[17px] font-semibold tracking-tight">
            {SECTION_NAME[key] ?? '题库'}
          </div>
        </div>
      </div>

      {failed && (
        <Card className="rounded-2xl shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <WarningCircleIcon className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">加载失败</p>
            <Button variant="outline" className="rounded-full" onClick={() => location.reload()}>
              重试
            </Button>
          </CardContent>
        </Card>
      )}

      {!sections && !failed && (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {sections && tikus && (
        <div className="space-y-3">
          {key === 'chongci'
            ? sections.chongci.map((g) => (
                <div key={g.group} className="space-y-3">
                  <h2 className="px-1 pt-1 text-[15px] font-semibold text-muted-foreground">{g.group}</h2>
                  {g.books.map((b) => renderBook(b))}
                </div>
              ))
            : entriesOf(key).map((e) => {
                if ('href' in e) {
                  return (
                    <Link
                      key={e.name}
                      to={e.href}
                      className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3.5 transition-colors hover:bg-secondary"
                    >
                      <div className="text-[15px] font-semibold">{e.name}</div>
                      <ArrowRightIcon className="size-4 text-muted-foreground" />
                    </Link>
                  )
                }
                if ('multi' in e) {
                  return (
                    <Card key={e.name} className="rounded-2xl shadow-none">
                      <CardContent className="space-y-3 px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-primary" />
                          <h3 className="text-[16px] font-semibold tracking-tight">{e.name}</h3>
                        </div>
                        {e.multi.map((b) => renderBook(b))}
                      </CardContent>
                    </Card>
                  )
                }
                return renderBook(e as Book)
              })}
        </div>
      )}
    </main>
  )
}

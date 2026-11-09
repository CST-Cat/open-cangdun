import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getCatalog, getSections, getTikus, prefetchCatalog, prefetchChapter } from '@/lib/data'
import { chapterStat, useRecordsVersion } from '@/lib/progress'
import { useIsWide } from '@/lib/use-media'
import { cn } from '@/lib/utils'
import type { Book, Catalog, SectionEntry, Sections, Tikus } from '@/lib/types'

const SECTION_NAME: Record<string, string> = {
  qianghua: '强化题库',
  chongci: '冲刺模拟',
  jingxuan: '精选题库',
  zhuanti: '专题模块',
}

/** 章节列表：进度条 + 正确率 + 错题数 */
function ChapterList({
  chapters,
  onPick,
  cols,
}: {
  chapters: { id: string; n: string; c: number }[]
  onPick: (idx: number) => void
  cols?: boolean
}) {
  return (
    <div className={cn('grid gap-2 [&>*]:min-w-0', cols && 'xl:grid-cols-2')}>
      {chapters.map((ch, i) => {
        const st = chapterStat(ch.id)
        const pct = ch.c ? Math.round((st.answered / ch.c) * 100) : 0
        const wrong = st.answered - st.correct
        const acc = st.answered ? Math.round((st.correct / st.answered) * 100) : 0
        const done = ch.c > 0 && st.answered >= ch.c
        return (
          <Item asChild key={ch.id} variant="outline" size="sm" className="flex-nowrap rounded-xl text-left">
            <button type="button" onClick={() => onPick(i)} onMouseEnter={() => prefetchChapter(ch.id)}>
              <ItemContent className="min-w-0">
                <ItemTitle className="w-full min-w-0 text-[14px] font-normal"><span className="min-w-0 flex-1 truncate">{ch.n}</span></ItemTitle>
                {st.answered > 0 && (
                  <>
                    <Progress value={pct} className="mt-1.5 h-1 w-full max-w-56" />
                    <ItemTitle className="mt-1 w-full text-xs font-normal text-muted-foreground tabular-nums">
                      已做 {st.answered}/{ch.c} · 正确率 {acc}%
                      {wrong > 0 && <span className="text-destructive"> · 错 {wrong}</span>}
                    </ItemTitle>
                  </>
                )}
              </ItemContent>
              <ItemActions className="shrink-0">
                {done ? (
                  <CheckCircleIcon className="size-5 text-success" weight="fill" />
                ) : (
                  <Badge variant="secondary" className="tabular-nums">{ch.c} 题</Badge>
                )}
              </ItemActions>
            </button>
          </Item>
        )
      })}
    </div>
  )
}

/** 一本书的目录数据（窄屏卡片与宽屏面板共用） */
function useBookCatalog(book: Book, tikuIdx: Map<string, number>) {
  const idx = tikuIdx.get(book.tiku)
  const [cata, setCata] = useState<Catalog | null>(null)
  const [failed, setFailed] = useState(false)

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
  // 每个科目只有一章时直接平铺（如真题章节版），否则科目 chips 选择
  const flat = useMemo(() => {
    if (!cata) return null
    const entries = Object.entries(cata)
    if (entries.length > 1 && entries.every(([, l]) => l.length === 1)) {
      return entries.flatMap(([, l]) => l).sort((a, b) => Number(a.id) - Number(b.id))
    }
    return null
  }, [cata])
  const bookProg = useMemo(() => {
    if (!cata) return null
    let answered = 0
    let total = 0
    for (const chapters of Object.values(cata)) {
      for (const ch of chapters) {
        total += ch.c
        answered += chapterStat(ch.id).answered
      }
    }
    return { answered, total }
  }, [cata])

  return { idx, cata, setCata, failed, subjects, flat, bookProg }
}

/** 一本书（窄屏）：Card + ToggleGroup 科目 chips + Item 章节列表 */
function BookCard({
  book,
  tikuIdx,
  onPick,
}: {
  book: Book
  tikuIdx: Map<string, number>
  onPick: (tiku: string, subj: string, ids: string[], sIdx: number) => void
}) {
  const { idx, cata, setCata, failed, subjects, flat, bookProg } = useBookCatalog(book, tikuIdx)
  const [openSubj, setOpenSubj] = useState<string>('')
  const [chapQuery, setChapQuery] = useState('')
  const filterCh = (list: { id: string; n: string; c: number }[]) => {
    const kw = chapQuery.trim()
    return kw ? list.filter((ch) => ch.n.includes(kw)) : list
  }

  const pickFrom = (ids: string[], sIdx: number) => onPick(book.tiku, openSubj, ids, sIdx)

  return (
    <Card className="rounded-xl py-4 shadow-none" onMouseEnter={() => idx !== undefined && prefetchCatalog(idx)}>
      <CardHeader className="px-4">
        <CardTitle className="font-display text-[18px] font-normal tracking-tight">{book.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        {bookProg && bookProg.total > 0 && (
          <div className="flex items-center gap-2">
            <Progress value={Math.round((bookProg.answered / bookProg.total) * 100)} className="h-1 flex-1" />
            <span className="text-[11px] text-muted-foreground tabular-nums">
              本书 {bookProg.answered}/{bookProg.total.toLocaleString()}
            </span>
          </div>
        )}
        {failed && (
          <Empty className="border border-dashed rounded-xl py-6">
            <EmptyHeader>
              <EmptyTitle>目录加载失败</EmptyTitle>
              <EmptyDescription>点击重试重新加载该书目录</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => idx !== undefined && getCatalog(idx).then(setCata).catch(() => {})}>
                重试
              </Button>
            </EmptyContent>
          </Empty>
        )}

        {!cata && !failed && (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-4/5 rounded-lg" />
          </div>
        )}

        {cata && ((flat && flat.length > 12) || (openSubj && (cata[openSubj]?.length ?? 0) > 12)) && (
          <div className="relative">
            <MagnifyingGlassIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={chapQuery}
              onChange={(e) => setChapQuery(e.target.value)}
              placeholder="搜本册章节…"
              className="h-9 rounded-lg pl-9"
            />
          </div>
        )}

        {cata && flat && <ChapterList chapters={filterCh(flat)} onPick={(i) => { const f = filterCh(flat); pickFrom(f.map((x) => x.id), i) }} />}

        {cata && !flat && (
          <>
            <ToggleGroup
              type="single"
              variant="outline"
              className="flex-wrap"
              value={openSubj}
              onValueChange={(v) => setOpenSubj(v ?? '')}
            >
              {subjects.map(([subj, chapters]) => (
                <ToggleGroupItem key={subj} value={subj} onMouseEnter={() => prefetchChapter(chapters[0]?.id)}>
                  {subj}
                  <Badge variant="secondary" className="ml-1 tabular-nums">{chapters.length}</Badge>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {openSubj && cata[openSubj] && (
              <ChapterList
                chapters={filterCh(cata[openSubj])}
                onPick={(i) => { const f = filterCh(cata[openSubj]); pickFrom(f.map((x) => x.id), i) }}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function SectionPage() {
  const { key = '' } = useParams()
  const wide = useIsWide()
  const navigate = useNavigate()
  useRecordsVersion()
  const [sections, setSections] = useState<Sections | null>(null)
  const [tikus, setTikus] = useState<Tikus | null>(null)
  const [bookQuery, setBookQuery] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([getSections(), getTikus()])
      .then(([s, t]) => alive && (setSections(s), setTikus(t)))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const tikuIdx = useMemo(() => new Map((tikus ?? []).map((n, i) => [n, i])), [tikus])

  const onPick = (tiku: string, subj: string, ids: string[], sIdx: number) =>
    navigate(`/ch/${ids[sIdx]}`, { state: { tiku, subj, siblings: ids, sIdx } })

  if (wide && sections && tikus) {
    return <WideSection sectionKey={key} sections={sections} tikuIdx={tikuIdx} onPick={onPick} />
  }

  const entriesOf = (k: string): SectionEntry[] => {
    if (!sections) return []
    if (k === 'qianghua') return sections.qianghua as SectionEntry[]
    if (k === 'jingxuan') return sections.jingxuan
    if (k === 'zhuanti') return sections.zhuanti
    return []
  }

  const bookVisible = (b: Book) => !bookQuery.trim() || b.name.includes(bookQuery.trim())
  const renderBook = (b: Book) =>
    bookVisible(b) ? <BookCard key={b.tiku + (b.subject ?? '')} book={b} tikuIdx={tikuIdx} onPick={onPick} /> : null

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24">
      <div className="sticky top-11 z-40 -mx-4 bg-background/80 px-4 pb-2 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
            <Link to="/" aria-label="返回首页">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div className="font-display text-[19px] font-normal tracking-tight">{SECTION_NAME[key] ?? '题库'}</div>
        </div>
        <div className="relative pt-2">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 mt-[4px] size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={bookQuery}
            onChange={(e) => setBookQuery(e.target.value)}
            placeholder="搜题库名，如：肖1000、腿姐、徐涛…"
            className="h-10 rounded-full bg-background pl-9"
          />
        </div>
      </div>

      {failed && (
        <Empty className="rounded-xl border py-12">
          <EmptyHeader>
            <EmptyTitle>加载失败</EmptyTitle>
            <EmptyDescription>分区数据暂时无法获取</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" className="rounded-full" onClick={() => location.reload()}>
              重试
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {!sections && !failed && (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {sections && tikus && (
        <div className="space-y-3">
          {key === 'chongci'
            ? sections.chongci
                .filter((g) => g.books.some(bookVisible))
                .map((g) => (
                  <div key={g.group} className="space-y-3">
                    <h2 className="px-1 pt-1 text-[15px] font-semibold text-muted-foreground">{g.group}</h2>
                    {g.books.map(renderBook)}
                  </div>
                ))
            : entriesOf(key).map((e) => {
                if ('href' in e) {
                  return (
                    <Item asChild key={e.name} variant="outline" className="rounded-xl text-left">
                      <Link to={e.href}>
                        <ItemContent>
                          <ItemTitle className="w-full min-w-0 text-[15px] font-semibold"><span className="min-w-0 flex-1 truncate">{e.name}</span></ItemTitle>
                        </ItemContent>
                        <ItemActions>
                          <ArrowRightIcon className="size-4 text-muted-foreground" />
                        </ItemActions>
                      </Link>
                    </Item>
                  )
                }
                if ('multi' in e) {
                  return (
                    <Card key={e.name} className="rounded-xl py-4 shadow-none">
                      <CardHeader className="px-4">
                        <CardTitle className="text-[16px] tracking-tight">{e.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 px-4">
                        {e.multi.map(renderBook)}
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


/** 宽屏主从两栏：左选书，右展章节 */
type WideEntry = { id: string; name: string; book?: Book; href?: string; group?: string }

function WideBookPanel({
  book,
  tikuIdx,
  onPick,
}: {
  book: Book
  tikuIdx: Map<string, number>
  onPick: (tiku: string, subj: string, ids: string[], sIdx: number) => void
}) {
  const { cata, failed, subjects, flat, bookProg } = useBookCatalog(book, tikuIdx)
  const [openSubj, setOpenSubj] = useState<string>('')
  const [chapQuery, setChapQuery] = useState('')
  const filterCh = (list: { id: string; n: string; c: number }[]) => {
    const kw = chapQuery.trim()
    return kw ? list.filter((ch) => ch.n.includes(kw)) : list
  }
  const pickFrom = (ids: string[], sIdx: number) => onPick(book.tiku, openSubj, ids, sIdx)

  return (
    <section className="rounded-xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-display text-[22px] font-normal tracking-tight">{book.name}</h2>
        {bookProg && bookProg.total > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            本书已答 {bookProg.answered} / {bookProg.total.toLocaleString()}
          </span>
        )}
      </div>
      {bookProg && bookProg.total > 0 && (
        <Progress value={Math.round((bookProg.answered / bookProg.total) * 100)} className="mt-2.5 h-1" />
      )}

      <div className="mt-4 space-y-3">
        {failed && (
          <Empty className="rounded-xl border border-dashed py-6">
            <EmptyHeader>
              <EmptyTitle>目录加载失败</EmptyTitle>
              <EmptyDescription>点击重试重新加载该书目录</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => location.reload()}>
                重试
              </Button>
            </EmptyContent>
          </Empty>
        )}
        {!cata && !failed && (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-4/5 rounded-lg" />
          </div>
        )}
        {cata && !flat && (
          <ToggleGroup
            type="single"
            variant="outline"
            className="flex-wrap"
            value={openSubj}
            onValueChange={(v) => setOpenSubj(v ?? '')}
          >
            {subjects.map(([subj, chapters]) => (
              <ToggleGroupItem key={subj} value={subj} onMouseEnter={() => prefetchChapter(chapters[0]?.id)}>
                {subj}
                <Badge variant="secondary" className="ml-1 tabular-nums">{chapters.length}</Badge>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        {cata && ((flat && flat.length > 12) || (openSubj && (cata[openSubj]?.length ?? 0) > 12)) && (
          <div className="relative max-w-sm">
            <MagnifyingGlassIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={chapQuery}
              onChange={(e) => setChapQuery(e.target.value)}
              placeholder="搜本册章节…"
              className="h-9 rounded-lg pl-9"
            />
          </div>
        )}
        {cata && flat && (
          <ChapterList cols chapters={filterCh(flat)} onPick={(i) => { const f = filterCh(flat); pickFrom(f.map((x) => x.id), i) }} />
        )}
        {cata && !flat && openSubj && cata[openSubj] && (
          <ChapterList
            cols
            chapters={filterCh(cata[openSubj])}
            onPick={(i) => { const f = filterCh(cata[openSubj]); pickFrom(f.map((x) => x.id), i) }}
          />
        )}
        {cata && !flat && !openSubj && (
          <p className="px-1 py-6 text-sm text-muted-foreground">先选一个科目，下面会展开它的章节。</p>
        )}
      </div>
    </section>
  )
}

function WideSection({
  sectionKey,
  sections,
  tikuIdx,
  onPick,
}: {
  sectionKey: string
  sections: Sections
  tikuIdx: Map<string, number>
  onPick: (tiku: string, subj: string, ids: string[], sIdx: number) => void
}) {
  const [activeId, setActiveId] = useState('')
  const [query, setQuery] = useState('')

  const entries = useMemo<WideEntry[]>(() => {
    const out: WideEntry[] = []
    const pushBook = (b: Book, group?: string) =>
      out.push({ id: 'b:' + b.tiku + (b.subject ?? ''), name: b.name, book: b, group })
    if (sectionKey === 'chongci') {
      for (const g of sections.chongci) {
        out.push({ id: 'g:' + g.group, name: g.group, group: g.group })
        g.books.forEach((b) => pushBook(b, g.group))
      }
      return out
    }
    const list: SectionEntry[] =
      sectionKey === 'qianghua' ? sections.qianghua : sectionKey === 'jingxuan' ? sections.jingxuan : sections.zhuanti
    for (const e of list) {
      if ('href' in e) out.push({ id: 'h:' + e.name, name: e.name, href: e.href })
      else if ('multi' in e) {
        out.push({ id: 'g:' + e.name, name: e.name, group: e.name })
        e.multi.forEach((b) => pushBook(b, e.name))
      } else pushBook(e as Book)
    }
    return out
  }, [sections, sectionKey])

  const visible = entries.filter((e) => !e.book || !query.trim() || e.name.includes(query.trim()))
  const active = visible.find((e) => e.id === activeId && e.book) ?? visible.find((e) => e.book)

  return (
    <main className="mx-auto w-full max-w-6xl px-8 pb-20">
      <div className="flex items-center gap-3 pt-8">
        <h1 className="font-display text-[26px] font-normal tracking-tight">{SECTION_NAME[sectionKey] ?? '题库'}</h1>
        <div className="relative ml-auto w-80">
          <MagnifyingGlassIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜题库名，如：肖1000、腿姐、徐涛…"
            className="h-10 rounded-full bg-card pl-9"
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[280px_minmax(0,1fr)] items-start gap-5">
        <div className="sticky top-6 max-h-[calc(100vh-120px)] space-y-0.5 overflow-y-auto rounded-xl border border-border/70 bg-card p-2">
          {visible.map((e) => {
            if (!e.book && !e.href) {
              return (
                <div key={e.id} className="px-2.5 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground first:pt-1">
                  {e.name}
                </div>
              )
            }
            if (e.href) {
              return (
                <Link
                  key={e.id}
                  to={e.href}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[14px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  <ArrowRightIcon className="size-3.5 shrink-0" />
                </Link>
              )
            }
            const isActive = active?.id === e.id
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setActiveId(e.id)}
                className={cn(
                  'flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[14px] transition-colors',
                  isActive ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{e.name}</span>
              </button>
            )
          })}
          {visible.filter((e) => e.book).length === 0 && (
            <p className="px-2.5 py-4 text-sm text-muted-foreground">没有匹配的题库</p>
          )}
        </div>

        <div>
          {active?.book ? (
            <WideBookPanel key={active.id} book={active.book} tikuIdx={tikuIdx} onPick={onPick} />
          ) : (
            <Empty className="rounded-xl border py-16">
              <EmptyHeader>
                <EmptyTitle>从左侧选一本题库</EmptyTitle>
                <EmptyDescription>章节会在这里展开</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>
    </main>
  )
}

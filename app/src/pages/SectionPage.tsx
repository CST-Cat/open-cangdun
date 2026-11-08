import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getCatalog, getSections, getTikus, prefetchCatalog, prefetchChapter } from '@/lib/data'
import { chapterStat, useRecordsVersion } from '@/lib/progress'
import type { Book, Catalog, SectionEntry, Sections, Tikus } from '@/lib/types'

const SECTION_NAME: Record<string, string> = {
  qianghua: '强化题库',
  chongci: '冲刺模拟',
  jingxuan: '精选题库',
  zhuanti: '专题模块',
}

/** 章节列表：shadcn Item 行 */
function ChapterList({
  chapters,
  onPick,
}: {
  chapters: { id: string; n: string; c: number }[]
  onPick: (idx: number) => void
}) {
  return (
    <div className="grid gap-2">
      {chapters.map((ch, i) => {
        const st = chapterStat(ch.id)
        const pct = ch.c ? Math.round((st.answered / ch.c) * 100) : 0
        return (
          <Item asChild key={ch.id} variant="outline" size="sm" className="rounded-xl">
            <button type="button" onClick={() => onPick(i)} onMouseEnter={() => prefetchChapter(ch.id)}>
              <ItemContent>
                <ItemTitle className="truncate text-[14px] font-normal">{ch.n}</ItemTitle>
                {st.answered > 0 && (
                  <ItemTitle className="text-xs font-normal text-muted-foreground tabular-nums">
                    已做 {st.answered}/{ch.c} · {pct}%
                  </ItemTitle>
                )}
              </ItemContent>
              <ItemActions>
                <Badge variant="secondary" className="tabular-nums">{ch.c} 题</Badge>
              </ItemActions>
            </button>
          </Item>
        )
      })}
    </div>
  )
}

/** 一本书：Card + ToggleGroup 科目 chips + Item 章节列表 */
function BookCard({
  book,
  tikuIdx,
  onPick,
}: {
  book: Book
  tikuIdx: Map<string, number>
  onPick: (tiku: string, subj: string, ids: string[], sIdx: number) => void
}) {
  const idx = tikuIdx.get(book.tiku)
  const [cata, setCata] = useState<Catalog | null>(null)
  const [failed, setFailed] = useState(false)
  const [openSubj, setOpenSubj] = useState<string>('')

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

  const pickFrom = (ids: string[], sIdx: number) => onPick(book.tiku, openSubj, ids, sIdx)

  return (
    <Card className="rounded-2xl py-4 shadow-none" onMouseEnter={() => idx !== undefined && prefetchCatalog(idx)}>
      <CardHeader className="px-4">
        <CardTitle className="text-[16px] tracking-tight">{book.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
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

        {cata && flat && <ChapterList chapters={flat} onPick={(i) => pickFrom(flat.map((x) => x.id), i)} />}

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
                chapters={cata[openSubj]}
                onPick={(i) => pickFrom(cata[openSubj].map((x) => x.id), i)}
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
  const navigate = useNavigate()
  useRecordsVersion()
  const [sections, setSections] = useState<Sections | null>(null)
  const [tikus, setTikus] = useState<Tikus | null>(null)
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

  const entriesOf = (k: string): SectionEntry[] => {
    if (!sections) return []
    if (k === 'qianghua') return sections.qianghua as SectionEntry[]
    if (k === 'jingxuan') return sections.jingxuan
    if (k === 'zhuanti') return sections.zhuanti
    return []
  }

  const renderBook = (b: Book) => <BookCard key={b.tiku + (b.subject ?? '')} book={b} tikuIdx={tikuIdx} onPick={onPick} />

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24">
      <div className="sticky top-11 z-40 -mx-4 bg-background/80 px-4 pb-2 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
            <Link to="/" aria-label="返回首页">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div className="text-[17px] font-semibold tracking-tight">{SECTION_NAME[key] ?? '题库'}</div>
        </div>
      </div>

      {failed && (
        <Empty className="rounded-2xl border py-12">
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
                  {g.books.map(renderBook)}
                </div>
              ))
            : entriesOf(key).map((e) => {
                if ('href' in e) {
                  return (
                    <Item asChild key={e.name} variant="outline" className="rounded-2xl">
                      <Link to={e.href}>
                        <ItemContent>
                          <ItemTitle className="text-[15px] font-semibold">{e.name}</ItemTitle>
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
                    <Card key={e.name} className="rounded-2xl py-4 shadow-none">
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

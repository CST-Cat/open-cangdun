import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRightIcon,
  BooksIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ChartBarIcon,
  LightningIcon,
} from '@phosphor-icons/react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getCatalog, getTikus, prefetchCatalog, prefetchChapter } from '@/lib/data'
import { chapterStat, getLast, globalStat, useRecordsVersion } from '@/lib/progress'
import type { Catalog, Tikus } from '@/lib/types'
import { cn } from '@/lib/utils'

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="rounded-2xl border-border/70 bg-secondary/60 shadow-none">
      <CardContent className="flex items-center gap-3 px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[17px] leading-tight font-semibold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

/** 题库条目（accordion 触发行）：hover 即预取该题库目录 */
function TikuTrigger({
  name,
  chapterTotal,
  idx,
}: {
  name: string
  chapterTotal?: number
  idx: number
}) {
  return (
    <AccordionTrigger
      onMouseEnter={() => prefetchCatalog(idx)}
      className="py-4 text-[17px] font-semibold tracking-tight hover:no-underline"
    >
      <span className="flex w-full items-center justify-between gap-2 pr-2">
        <span>{name}</span>
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          {chapterTotal === undefined ? '' : `${chapterTotal} 章`}
        </span>
      </span>
    </AccordionTrigger>
  )
}

export default function Home() {
  const [tikus, setTikus] = useState<Tikus | null>(null)
  const [error, setError] = useState(false)
  const [catas, setCatas] = useState<Record<number, Catalog>>({})
  const navigate = useNavigate()
  useRecordsVersion() // 记录变化时重渲染进度

  useEffect(() => {
    let alive = true
    getTikus().then(setTikus).catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  const loadCatalog = (idx: number) => {
    if (catas[idx]) return
    void getCatalog(idx).then((c) => setCatas((prev) => ({ ...prev, [idx]: c })))
  }

  const openChapter = (tiku: string, subj: string, ids: string[], idx: number) => {
    void navigate(`/ch/${ids[idx]}`, { state: { tiku, subj, siblings: ids, sIdx: idx } })
  }

  const last = getLast()
  const stats = globalStat()

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24">
      {/* 头部 */}
      <section className="pt-8 pb-6 text-center sm:pt-12">
        <h1 className="text-[32px] leading-tight font-semibold tracking-tight sm:text-[40px]">
          考研政治，刷完为止
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          34,784 道题 · 24 个题库 · 答案解析全收录
        </p>
      </section>

      {/* 统计 + 继续刷题 */}
      <section className="space-y-3">
        {last && (
          <Card className="rounded-2xl shadow-none">
            <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LightningIcon className="size-3.5 text-primary" weight="fill" />
                  继续刷题
                </div>
                <div className="truncate text-[15px] font-medium">{last.n}</div>
              </div>
              <Button size="sm" className="rounded-full px-4" asChild>
                <Link to={`/ch/${last.c}`}>
                  继续
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<BooksIcon className="size-5" weight="duotone" />}
            label="已刷章节"
            value={`${stats.chapters}`}
          />
          <StatCard
            icon={<CheckCircleIcon className="size-5" weight="duotone" />}
            label="答题数"
            value={`${stats.answered}`}
          />
          <StatCard
            icon={<ChartBarIcon className="size-5" weight="duotone" />}
            label="正确率"
            value={stats.answered ? `${Math.round((stats.correct / stats.answered) * 100)}%` : '—'}
          />
        </div>
      </section>

      {/* 题库目录 */}
      <section className="pt-8">
        <h2 className="mb-1 px-1 text-[21px] font-semibold tracking-tight">题库目录</h2>
        {error && (
          <Card className="mt-3 rounded-2xl shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-muted-foreground">目录加载失败</p>
              <Button variant="outline" className="rounded-full" onClick={() => location.reload()}>
                重试
              </Button>
            </CardContent>
          </Card>
        )}
        {!tikus && !error && (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        )}
        {tikus && (
          <Accordion type="single" collapsible className="mt-2" onValueChange={(v) => {
            const idx = v ? Number(v) : -1
            if (idx >= 0) loadCatalog(idx)
          }}>
            {tikus.map((name, idx) => {
              const cata = catas[idx]
              const chapterTotal = cata
                ? Object.values(cata).reduce((s, l) => s + l.length, 0)
                : undefined
              return (
                <AccordionItem key={name} value={`${idx}`} className="border-border/70">
                  <TikuTrigger name={name} chapterTotal={chapterTotal} idx={idx} />
                  <AccordionContent className="pb-3">
                    {!cata && (
                      <div className="space-y-2 py-1">
                        {Array.from({ length: 3 }, (_, i) => (
                          <Skeleton key={i} className="h-10 w-full rounded-lg" />
                        ))}
                      </div>
                    )}
                    {cata &&
                      Object.entries(cata).map(([subj, chapters]) => {
                        const ids = chapters.map((c) => c.id)
                        return (
                          <div key={subj} className="mb-3 last:mb-0">
                            <div className="px-1 pb-1 text-xs font-semibold text-muted-foreground">
                              {subj}
                            </div>
                            <div className="overflow-hidden rounded-xl border border-border/70">
                              {chapters.map((ch, i) => {
                                const st = chapterStat(ch.id)
                                const pct = ch.c ? Math.round((st.answered / ch.c) * 100) : 0
                                return (
                                  <button
                                    key={ch.id}
                                    onClick={() => openChapter(name, subj, ids, i)}
                                    onMouseEnter={() => prefetchChapter(ch.id)}
                                    className={cn(
                                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary active:bg-secondary',
                                      'border-border/50 not-last:border-b',
                                    )}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-[15px] leading-snug">{ch.n}</div>
                                      {st.answered > 0 && (
                                        <div className="mt-1 flex items-center gap-1.5">
                                          <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                                            <div
                                              className="h-full rounded-full bg-primary"
                                              style={{ width: `${pct}%` }}
                                            />
                                          </div>
                                          <span className="text-[11px] text-muted-foreground tabular-nums">
                                            {st.answered}/{ch.c}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                                      {ch.c} 题
                                    </Badge>
                                    <CaretRightIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
      </section>
    </main>
  )
}

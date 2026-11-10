import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRightIcon,
  BookBookmarkIcon,
  BooksIcon,
  CrosshairIcon,
  LightningIcon,
  PuzzlePieceIcon,
  XCircleIcon,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { getCatalog, getSections, getTikus, prefetchSections } from '@/lib/data'
import { chapterStat, getLast, globalStat, todayStat, useRecordsVersion, wrongStat } from '@/lib/progress'
import { useIsWide } from '@/lib/use-media'
import type { Book, Sections } from '@/lib/types'
import { cn } from '@/lib/utils'

// 四大分区（对应原小程序：强化题库/冲刺模拟/精选题库/VIP题库）
const SECTION_META = [
  { key: 'qianghua', name: '强化题库', en: 'Intensive', icon: BooksIcon },
  { key: 'chongci', name: '冲刺模拟', en: 'Sprint', icon: LightningIcon },
  { key: 'jingxuan', name: '精选题库', en: 'Selection', icon: CrosshairIcon },
  { key: 'zhuanti', name: 'VIP 题库', en: 'VIP', icon: PuzzlePieceIcon },
] as const

const TOTAL_QUESTIONS = 34784
const EXAM = new Date(2026, 11, 19) // 2026-12-19 初试（政治 08:30）

function daysToExam(): number {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((EXAM.getTime() - today.getTime()) / 86400000))
}

function booksOf(sections: Sections, key: string): Book[] {
  if (key === 'qianghua') return sections.qianghua
  if (key === 'chongci') return sections.chongci.flatMap((g) => g.books)
  const entries = key === 'jingxuan' ? sections.jingxuan : sections.zhuanti
  return entries.flatMap((e) =>
    'multi' in e ? e.multi.filter((b): b is Book => 'tiku' in b) : 'href' in e || 'notice' in e ? [] : [e as Book],
  )
}

function countOf(sections: Sections, key: string): number {
  if (key === 'chongci') return sections.chongci.reduce((s, g) => s + g.books.length, 0)
  return (sections[key as keyof Sections] as unknown[]).length
}

type SecProg = { answered: number; total: number }

export default function Home() {
  const [sections, setSections] = useState<Sections | null>(null)
  const [error, setError] = useState(false)
  const [secProg, setSecProg] = useState<Record<string, SecProg>>({})
  const wide = useIsWide()
  useRecordsVersion()

  useEffect(() => {
    prefetchSections()
    let alive = true
    getSections()
      .then((s) => alive && setSections(s))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  // 分区进度：空闲时拉全目录（目录文件小且不可变），按记录聚合已答/总量（按章节去重）
  useEffect(() => {
    if (!sections) return
    let alive = true
    const run = async () => {
      try {
        const tikus = await getTikus()
        const idx = new Map(tikus.map((n, i) => [n, i]))
        const out: Record<string, SecProg> = {}
        for (const { key } of SECTION_META) {
          const books = booksOf(sections, key)
          let answered = 0
          let total = 0
          const seen = new Set<string>()
          await Promise.all(
            books.map(async (b) => {
              const i = idx.get(b.tiku)
              if (i === undefined) return
              try {
                const cata = await getCatalog(i)
                for (const chapters of Object.values(cata)) {
                  for (const ch of chapters) {
                    if (seen.has(ch.id)) continue
                    seen.add(ch.id)
                    total += ch.c
                    answered += chapterStat(ch.id).answered
                  }
                }
              } catch { /* 单本目录失败不拖垮整页 */ }
            }),
          )
          out[key] = { answered, total }
        }
        if (alive) setSecProg(out)
      } catch { /* 进度是增强项，失败静默 */ }
    }
    const t = setTimeout(run, 350)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [sections])

  const last = getLast()
  const stats = globalStat()
  const today = todayStat()
  const wrong = wrongStat()
  const days = useMemo(daysToExam, [])
  const overallPct = Math.min(100, Math.round((stats.answered / TOTAL_QUESTIONS) * 1000) / 10)

  // ---------- 共用块 ----------
  const overview = (
    <section className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="font-display text-[24px] leading-tight font-medium tabular-nums">{today.answered}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            今日答题{today.answered > 0 && <> · 对 {Math.round((today.correct / today.answered) * 100)}%</>}
          </div>
        </div>
        <div>
          <div className="font-display text-[24px] leading-tight font-medium tabular-nums">{stats.answered}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            累计答题{stats.answered > 0 && <> · 对 {Math.round((stats.correct / stats.answered) * 100)}%</>}
          </div>
        </div>
        <div>
          <div className="font-display text-[24px] leading-tight font-medium tabular-nums">{stats.chapters}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">已刷章节</div>
        </div>
      </div>
      <div className="mt-3.5 border-t border-border/70 pt-3">
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span>全题库进度</span>
          <span className="tabular-nums">
            {stats.answered} / {TOTAL_QUESTIONS.toLocaleString()} · {overallPct}%
          </span>
        </div>
        <Progress value={overallPct} className="mt-1.5 h-1.5" />
      </div>
    </section>
  )

  const continueCard = last && (
    <Link
      to={`/ch/${last.c}`}
      className="flex items-center gap-3 rounded-xl bg-primary px-4 py-3.5 text-primary-foreground transition-transform active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs opacity-80">
          <LightningIcon className="size-3.5" weight="fill" />
          继续刷题 · 第 {last.q + 1} 题
        </div>
        <div className="mt-0.5 truncate text-[16px] font-medium">{last.n}</div>
      </div>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20">
        <ArrowRightIcon className="size-4.5" />
      </span>
    </Link>
  )

  const wrongRow = wrong.wrong > 0 && (
    <Link
      to="/wrong"
      className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5 shadow-sm transition-transform active:scale-[0.99]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/75 shadow-sm dark:bg-accent">
        <XCircleIcon className="size-5.5" weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium">错题本</div>
        <div className="text-[13px] text-foreground/65 tabular-nums">
          {wrong.wrong} 道待订正 · 分布在 {wrong.chapters} 章
        </div>
      </div>
      <ArrowRightIcon className="size-4 shrink-0 text-foreground/45" />
    </Link>
  )

  const sectionsError = error && (
    <Empty className="rounded-xl border py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BooksIcon />
        </EmptyMedia>
        <EmptyTitle>分区加载失败</EmptyTitle>
        <EmptyDescription>数据暂时无法获取，请重试</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={() => location.reload()}>
          重试
        </Button>
      </EmptyContent>
    </Empty>
  )

  const sectionsSkeleton = !sections && !error && (
    <div className={cn('gap-2', wide ? 'grid grid-cols-2 gap-3' : 'space-y-2')}>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className={cn('w-full rounded-xl', wide ? 'h-32' : 'h-[68px]')} />
      ))}
    </div>
  )

  // 窄屏：分区列表行
  const sectionRow = ({ key, name, en, icon: Icon }: (typeof SECTION_META)[number]) => {
    const prog = secProg[key]
    const pct = prog && prog.total > 0 ? Math.round((prog.answered / prog.total) * 1000) / 10 : 0
    return (
      <Link
        key={key}
        to={`/s/${key}`}
        className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5 shadow-sm transition-transform active:scale-[0.99]"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/75 shadow-sm dark:bg-accent">
          <Icon className="size-5.5" weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[16px] font-medium">{name}</span>
            <span className="text-xs text-foreground/55">{en}</span>
            <span className="ml-auto text-xs text-foreground/55 tabular-nums">{sections && countOf(sections, key)} 项</span>
          </div>
          {prog && prog.total > 0 ? (
            <div className="mt-2 flex items-center gap-2">
              <Progress value={pct} className="h-1 flex-1" />
              <span className="shrink-0 text-xs text-foreground/60 tabular-nums">
                {prog.answered}/{prog.total.toLocaleString()} · {pct}%
              </span>
            </div>
          ) : (
            <div className="mt-2 h-1" />
          )}
        </div>
        <ArrowRightIcon className="size-4 shrink-0 text-foreground/45" />
      </Link>
    )
  }

  // 宽屏：分区仪表卡（竖向，信息密度更高）
  const sectionCard = ({ key, name, en, icon: Icon }: (typeof SECTION_META)[number]) => {
    const prog = secProg[key]
    const pct = prog && prog.total > 0 ? Math.round((prog.answered / prog.total) * 1000) / 10 : 0
    return (
      <Link
        key={key}
        to={`/s/${key}`}
        className="group flex min-h-32 flex-col rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-foreground/30"
      >
        <div className="flex items-start justify-between">
          <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground/75 shadow-sm dark:bg-accent">
            <Icon className="size-5.5" weight="duotone" />
          </span>
          <span className="text-xs text-foreground/55 tabular-nums">{sections && countOf(sections, key)} 项</span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-[18px] font-normal">{name}</span>
          <span className="text-xs text-foreground/55">{en}</span>
        </div>
        <div className="mt-auto pt-3">
          {prog && prog.total > 0 ? (
            <>
              <Progress value={pct} className="h-1" />
              <div className="mt-1.5 text-xs text-foreground/65 tabular-nums">
                已答 {prog.answered} / {prog.total.toLocaleString()} · {pct}%
              </div>
            </>
          ) : (
            <div className="text-xs text-foreground/55">进度统计中…</div>
          )}
        </div>
      </Link>
    )
  }

  const kaodianRow = (
    <Link
      to="/kd"
      className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5 shadow-sm transition-transform active:scale-[0.99]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/75 shadow-sm dark:bg-accent">
        <BookBookmarkIcon className="size-5.5" weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-medium">考点教材</div>
        <div className="text-[13px] text-foreground/65">484 个考点 · 教材内容整理</div>
      </div>
      <ArrowRightIcon className="size-4 shrink-0 text-foreground/45" />
    </Link>
  )

  const footer = (
    <footer className="pt-10 pb-2 text-center text-xs text-foreground/55/70">
      数据仅供个人学习交流 · 来源苍盾题库
    </footer>
  )

  // ================= 宽屏布局 =================
  if (wide) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-10 pb-20">
        <section className="flex items-end justify-between gap-4 pt-9 pb-6">
          <div>
            <h1 className="font-display text-[34px] leading-tight font-normal tracking-tight">考研政治</h1>
            <p className="mt-1 text-sm text-muted-foreground">12 月 19 日开考 · 政治 08:30–11:30 · 全题库 {TOTAL_QUESTIONS.toLocaleString()} 题</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-[40px] leading-none font-normal tabular-nums">{days}</div>
            <div className="mt-1 text-xs text-foreground/55">距初试（天）</div>
          </div>
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-8">
          {/* 右轨：总览 + 行动 */}
          <div className="order-2 space-y-3">
            {overview}
            {continueCard}
            {wrongRow}
          </div>

          {/* 左：分区仪表卡网格（主体） */}
          <section className="order-1">
            <h2 className="font-display mb-3 px-1 text-[22px] font-normal tracking-tight">题库分区</h2>
            {sectionsError}
            {sectionsSkeleton}
            {sections && (
              <div className="grid grid-cols-2 gap-3">
                {SECTION_META.map(sectionCard)}
                <div className="col-span-2">{kaodianRow}</div>
              </div>
            )}
          </section>
        </div>
        {footer}
      </main>
    )
  }

  // ================= 窄屏布局 =================
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24">
      <section className="flex items-end justify-between gap-4 pt-8 pb-5">
        <div>
          <h1 className="font-display text-[30px] leading-tight font-normal tracking-tight">考研政治</h1>
          <p className="mt-1 text-sm text-muted-foreground">12 月 19 日开考 · 政治 08:30–11:30</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-[34px] leading-none font-normal tabular-nums">{days}</div>
          <div className="mt-1 text-xs text-foreground/55">距初试（天）</div>
        </div>
      </section>

      {overview}
      {last && <div className="mt-3">{continueCard}</div>}
      {wrong.wrong > 0 && <div className="mt-3">{wrongRow}</div>}

      <section className="pt-7">
        <h2 className="font-display mb-3 px-1 text-[22px] font-normal tracking-tight">题库分区</h2>
        {sectionsError}
        {sectionsSkeleton}
        {sections && (
          <div className="space-y-2">
            {SECTION_META.map(sectionRow)}
            {kaodianRow}
          </div>
        )}
      </section>
      {footer}
    </main>
  )
}

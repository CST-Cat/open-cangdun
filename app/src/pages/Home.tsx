import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRightIcon,
  BooksIcon,
  CrosshairIcon,
  GraduationCapIcon,
  LightningIcon,
  TargetIcon,
  CheckCircleIcon,
  ChartBarIcon,
  BookBookmarkIcon,
  PuzzlePieceIcon,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getSections, prefetchSections } from '@/lib/data'
import { getLast, globalStat, useRecordsVersion } from '@/lib/progress'
import type { Sections } from '@/lib/types'

// 四大分区（对应原小程序：强化题库/冲刺模拟/精选题库/专题模块）
const SECTION_META = [
  { key: 'qianghua', name: '强化题库', en: 'Intensive', icon: BooksIcon, cls: 'bg-[#3b7cf0]' },
  { key: 'chongci', name: '冲刺模拟', en: 'Sprint', icon: LightningIcon, cls: 'bg-[#7c5cf0]' },
  { key: 'jingxuan', name: '精选题库', en: 'Selection', icon: CrosshairIcon, cls: 'bg-[#2aa8a0]' },
  { key: 'zhuanti', name: '专题模块', en: 'Topics', icon: PuzzlePieceIcon, cls: 'bg-[#34a853]' },
] as const

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

export default function Home() {
  const [sections, setSections] = useState<Sections | null>(null)
  const [error, setError] = useState(false)
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

  const last = getLast()
  const stats = globalStat()

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24">
      {/* 头部 */}
      <section className="pt-8 pb-6 text-center sm:pt-10">
        <h1 className="text-[30px] leading-tight font-semibold tracking-tight sm:text-[36px]">
          考研政治，刷完为止
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          34,784 道题 · 四大题库 · 按原版分区
        </p>
      </section>

      {/* 继续刷题 + 统计 */}
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
            icon={<GraduationCapIcon className="size-5" weight="duotone" />}
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

      {/* 四大分区入口 */}
      <section className="pt-7">
        <h2 className="mb-3 px-1 text-[21px] font-semibold tracking-tight">题库分区</h2>
        {error && (
          <Card className="rounded-2xl shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-muted-foreground">分区加载失败</p>
              <Button variant="outline" className="rounded-full" onClick={() => location.reload()}>
                重试
              </Button>
            </CardContent>
          </Card>
        )}
        {!sections && !error && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        )}
        {sections && (
          <div className="grid grid-cols-2 gap-3">
            {SECTION_META.map(({ key, name, en, icon: Icon, cls }) => {
              const count =
                key === 'chongci'
                  ? sections.chongci.reduce((s, g) => s + g.books.length, 0)
                  : (sections[key as keyof Sections] as unknown[]).length
              return (
                <Link
                  key={key}
                  to={`/s/${key}`}
                  onMouseEnter={prefetchSections}
                  className={`${cls} relative overflow-hidden rounded-2xl p-4 text-white transition-transform active:scale-[0.98]`}
                >
                  <div className="flex items-start justify-between">
                    <div className="text-[19px] leading-tight font-semibold tracking-tight">{name}</div>
                    <Icon className="size-6 opacity-80" weight="duotone" />
                  </div>
                  <div className="mt-6 flex items-end justify-between">
                    <span className="text-[13px] font-medium opacity-80 first-letter:text-[17px]">{en}</span>
                    <span className="text-xs opacity-75 tabular-nums">{count} 项</span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30" />
                </Link>
              )
            })}
          </div>
        )}

        {/* 考点教材 */}
        {sections && (
          <Link
            to="/kd"
            className="mt-3 flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3.5 transition-colors hover:bg-secondary"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BookBookmarkIcon className="size-5" weight="duotone" />
              </div>
              <div>
                <div className="text-[15px] font-semibold">考点教材</div>
                <div className="text-xs text-muted-foreground">484 个考点 · 教材内容整理</div>
              </div>
            </div>
            <ArrowRightIcon className="size-4 text-muted-foreground" />
          </Link>
        )}
      </section>

      <footer className="pt-10 pb-2 text-center text-[11px] text-muted-foreground/70">
        <TargetIcon className="mr-1 inline size-3" />
        数据仅供个人学习交流 · 来源苍盾题库
      </footer>
    </main>
  )
}

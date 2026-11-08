import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRightIcon,
  BooksIcon,
  CrosshairIcon,
  GraduationCapIcon,
  LightningIcon,
  CheckCircleIcon,
  ChartBarIcon,
  BookBookmarkIcon,
  PuzzlePieceIcon,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { getSections, prefetchSections } from '@/lib/data'
import { getLast, globalStat, useRecordsVersion } from '@/lib/progress'
import type { Sections } from '@/lib/types'

// 四大分区（对应原小程序：强化题库/冲刺模拟/精选题库/专题模块）
const SECTION_META = [
  { key: 'qianghua', name: '强化题库', en: 'Intensive', icon: BooksIcon, cls: 'bg-[#3b7cf0] text-white' },
  { key: 'chongci', name: '冲刺模拟', en: 'Sprint', icon: LightningIcon, cls: 'bg-[#7c5cf0] text-white' },
  { key: 'jingxuan', name: '精选题库', en: 'Selection', icon: CrosshairIcon, cls: 'bg-[#2aa8a0] text-white' },
  { key: 'zhuanti', name: '专题模块', en: 'Topics', icon: PuzzlePieceIcon, cls: 'bg-[#34a853] text-white' },
] as const

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="rounded-2xl border-border/70 bg-secondary/60 py-3 shadow-none">
      <CardContent className="flex items-center gap-3 px-4">
        <ItemMedia variant="icon" className="bg-primary/10 text-primary">
          {icon}
        </ItemMedia>
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
          <Card className="rounded-2xl py-3 shadow-none">
            <CardContent className="flex items-center justify-between gap-3 px-4">
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
          <Empty className="rounded-2xl border py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BooksIcon />
              </EmptyMedia>
              <EmptyTitle>分区加载失败</EmptyTitle>
              <EmptyDescription>数据暂时无法获取，请重试</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" className="rounded-full" onClick={() => location.reload()}>
                重试
              </Button>
            </EmptyContent>
          </Empty>
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
                <Link key={key} to={`/s/${key}`} className="block transition-transform active:scale-[0.98]">
                  <Card className={`${cls} rounded-2xl border-0 py-4 shadow-none`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-[19px] tracking-tight">{name}</CardTitle>
                        <Icon className="size-6 opacity-80" weight="duotone" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="flex items-end justify-between text-white/75">
                        <span className="text-[13px] font-medium">{en}</span>
                        <Badge variant="outline" className="border-white/30 bg-transparent text-white tabular-nums">
                          {count} 项
                        </Badge>
                      </CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}

        {/* 考点教材 */}
        {sections && (
          <Item asChild variant="outline" className="mt-3 rounded-2xl">
            <Link to="/kd">
              <ItemMedia variant="icon" className="bg-primary/10 text-primary">
                <BookBookmarkIcon className="size-5" weight="duotone" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="text-[15px] font-semibold">考点教材</ItemTitle>
                <ItemDescription>484 个考点 · 教材内容整理</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ArrowRightIcon className="size-4 text-muted-foreground" />
              </ItemActions>
            </Link>
          </Item>
        )}
      </section>

      <footer className="pt-10 pb-2 text-center text-[11px] text-muted-foreground/70">
        数据仅供个人学习交流 · 来源苍盾题库
      </footer>
    </main>
  )
}

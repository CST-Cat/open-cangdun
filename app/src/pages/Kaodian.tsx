import { useEffect, useMemo, useState } from 'react'
import { BookOpenIcon, MagnifyingGlassIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { getKaodian, getKaodianIndex, prefetchKaodian } from '@/lib/data'
import { cleanHTML } from '@/lib/html'
import type { KaodianIndexItem } from '@/lib/types'
import { useIsWide } from '@/lib/use-media'
import { cn } from '@/lib/utils'

export default function Kaodian() {
  const [index, setIndex] = useState<KaodianIndexItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<{ item: KaodianIndexItem } | null>(null)
  const [detail, setDetail] = useState<{ t: string; h: string } | null>(null)
  const [detailFailed, setDetailFailed] = useState(false)
  const isDesktop = useIsWide()

  useEffect(() => {
    let alive = true
    getKaodianIndex()
      .then((d) => alive && setIndex(d))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const openDetail = (item: KaodianIndexItem) => {
    setActive({ item })
    setDetail(null)
    setDetailFailed(false)
    void getKaodian(item.i)
      .then(setDetail)
      .catch(() => setDetailFailed(true))
  }

  // URL 带 ?focus=<id> 时直接打开对应考点（刷题页解析跳入）
  useEffect(() => {
    if (!index) return
    const focus = new URLSearchParams(location.search).get('focus')
    if (!focus) return
    const item = index.find((x) => x.i === focus)
    if (item) openDetail(item)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const filtered = useMemo(() => {
    if (!index) return []
    const kw = query.trim()
    if (!kw) return index
    return index.filter((x) => x.t.includes(kw) || x.i === kw)
  }, [index, query])

  const detailBody = (
    <>
      {detailFailed && (
        <Empty className="rounded-xl border py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WarningCircleIcon />
            </EmptyMedia>
            <EmptyTitle>内容加载失败</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" className="rounded-full" onClick={() => active && openDetail(active.item)}>
              重试
            </Button>
          </EmptyContent>
        </Empty>
      )}
      {!detail && !detailFailed && (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" style={{ width: `${95 - i * 9}%` }} />
          ))}
        </div>
      )}
      {detail && (
        <div>
          {!detail.h ? (
            <Empty className="rounded-xl border py-8">
              <EmptyHeader>
                <EmptyTitle>该考点暂无教材内容</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="prose-cd max-w-[72ch] text-[16px] leading-[1.85]" dangerouslySetInnerHTML={{ __html: cleanHTML(detail.h) }} />
          )}
          <Badge variant="secondary" className="mt-3 rounded-full">
            考点 ID {active?.item.i}
          </Badge>
        </div>
      )}
    </>
  )

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 lg:max-w-6xl lg:px-8 lg:pb-20">
      <section className="pt-8 pb-4">
        <h1 className="font-display text-[30px] leading-tight font-normal tracking-tight">考点教材</h1>
        <p className="mt-1 text-sm text-muted-foreground">484 个考点 · 按教材体系整理</p>
      </section>

      {/* 搜索 */}
      <div className="sticky top-11 z-40 -mx-4 bg-background/80 px-4 pb-2 pt-1 backdrop-blur-xl">
        <div className="relative max-w-xl">
          <MagnifyingGlassIcon className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索考点，如：物质、矛盾、剩余价值…"
            className="h-11 rounded-full pl-10"
          />
        </div>
      </div>

      {failed && (
        <Empty className="mt-4 rounded-xl border py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WarningCircleIcon />
            </EmptyMedia>
            <EmptyTitle>考点索引加载失败</EmptyTitle>
            <EmptyDescription>数据暂时无法获取</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" className="rounded-full" onClick={() => location.reload()}>
              重试
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {!index && !failed && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      )}

      {index && (
        <div className="lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* 左：考点列表 */}
          <div className="lg:sticky lg:top-6">
            <p className="px-1 pb-2 text-xs text-muted-foreground tabular-nums">{filtered.length} 个考点</p>
            <div className="grid gap-2 [&>*]:min-w-0 lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto lg:pr-1.5">
              {filtered.map((item, i) => (
                <Item
                  asChild
                  key={item.i}
                  variant="outline"
                  size="sm"
                  className={cn(
                    'flex-nowrap rounded-xl text-left',
                    active?.item.i === item.i && 'border-primary/60 bg-secondary',
                  )}
                  onMouseEnter={() => prefetchKaodian(item.i)}
                >
                  <button type="button" onClick={() => openDetail(item)}>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="w-full min-w-0 text-[14px] font-normal"><span className="min-w-0 flex-1 truncate">{item.t}</span></ItemTitle>
                    </ItemContent>
                    <ItemActions className="shrink-0">
                      <Badge variant="secondary" className="tabular-nums">#{i + 1}</Badge>
                    </ItemActions>
                  </button>
                </Item>
              ))}
              {filtered.length > 0 && <IdlePrefetch items={filtered.slice(0, 20)} />}
            </div>
            {filtered.length === 0 && (
              <Empty className="mt-4 rounded-xl border py-10">
                <EmptyHeader>
                  <EmptyTitle>没有匹配的考点</EmptyTitle>
                  <EmptyDescription>换个关键词试试</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>

          {/* 右：阅读栏（仅桌面） */}
          <div className="sticky top-6 hidden lg:block">
            {!active ? (
              <Empty className="rounded-xl border border-dashed py-20">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BookOpenIcon />
                  </EmptyMedia>
                  <EmptyTitle>从左侧选一个考点开始读</EmptyTitle>
                  <EmptyDescription>教材内容会在这里整页展开，不用弹窗来回开</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <article className="rounded-xl border border-border/70 bg-card px-6 py-5">
                <h2 className="font-display text-[22px] leading-snug font-normal tracking-tight">{active.item.t}</h2>
                <div className="mt-3">{detailBody}</div>
              </article>
            )}
          </div>
        </div>
      )}

      {/* 详情弹窗（仅手机/平板） */}
      <Dialog open={Boolean(active) && !isDesktop} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-left text-[20px] leading-snug font-normal tracking-tight">
              {active?.item.t}
            </DialogTitle>
            <DialogDescription className="sr-only">考点教材内容</DialogDescription>
          </DialogHeader>
          {detailBody}
        </DialogContent>
      </Dialog>
    </main>
  )
}

/** 列表渲染后空闲预取前 N 个详情 */
function IdlePrefetch({ items }: { items: KaodianIndexItem[] }) {
  useEffect(() => {
    const t = setTimeout(() => {
      for (const it of items) prefetchKaodian(it.i)
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

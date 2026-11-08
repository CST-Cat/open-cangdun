import { useEffect, useMemo, useState } from 'react'
import { CaretRightIcon, MagnifyingGlassIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { getKaodian, getKaodianIndex, prefetchKaodian } from '@/lib/data'
import { cleanHTML } from '@/lib/html'
import type { KaodianIndexItem } from '@/lib/types'

export default function Kaodian() {
  const [index, setIndex] = useState<KaodianIndexItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<{ item: KaodianIndexItem } | null>(null)
  const [detail, setDetail] = useState<{ t: string; h: string } | null>(null)
  const [detailFailed, setDetailFailed] = useState(false)

  useEffect(() => {
    let alive = true
    getKaodianIndex()
      .then((d) => alive && setIndex(d))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  // 打开详情：先展示标题骨架，内容到了即渲染
  const openDetail = (item: KaodianIndexItem) => {
    setActive({ item })
    setDetail(null)
    setDetailFailed(false)
    void getKaodian(item.i)
      .then(setDetail)
      .catch(() => setDetailFailed(true))
  }

  // URL 带 ?focus=<id> 时直接打开对应考点
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

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24">
      <section className="pt-8 pb-4 text-center">
        <h1 className="text-[32px] leading-tight font-semibold tracking-tight sm:text-[36px]">考点教材</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">484 个考点 · 按教材体系整理</p>
      </section>

      {/* 搜索 */}
      <div className="sticky top-11 z-40 -mx-4 bg-background/80 px-4 pb-2 pt-1 backdrop-blur-xl">
        <div className="relative">
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
        <Card className="mt-4 rounded-2xl shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <WarningCircleIcon className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">考点索引加载失败</p>
            <Button variant="outline" className="rounded-full" onClick={() => location.reload()}>
              重试
            </Button>
          </CardContent>
        </Card>
      )}

      {!index && !failed && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      )}

      {index && (
        <>
          <p className="px-1 pb-2 text-xs text-muted-foreground tabular-nums">{filtered.length} 个考点</p>
          <div className="overflow-hidden rounded-2xl border border-border/70">
            {filtered.map((item, i) => (
              <button
                key={item.i}
                onClick={() => openDetail(item)}
                onMouseEnter={() => prefetchKaodian(item.i)}
                className="flex w-full items-center gap-3 border-border/50 px-3.5 py-3 text-left transition-colors hover:bg-secondary active:bg-secondary not-last:border-b"
              >
                <span className="min-w-0 flex-1 truncate text-[15px]">{item.t}</span>
                <CaretRightIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
                {/* 首屏空闲后由浏览器预热前 20 个详情 */}
                {i === 0 && <IdlePrefetch items={filtered.slice(0, 20)} />}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">没有匹配的考点</div>
            )}
          </div>
        </>
      )}

      {/* 详情弹窗 */}
      <Dialog open={Boolean(active)} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-left text-lg leading-snug tracking-tight">
              {active?.item.t}
            </DialogTitle>
            <DialogDescription className="sr-only">考点教材内容</DialogDescription>
          </DialogHeader>
          {detailFailed && (
            <div className="flex flex-col items-center gap-3 py-8">
              <WarningCircleIcon className="size-7 text-destructive" />
              <p className="text-sm text-muted-foreground">内容加载失败</p>
              <Button variant="outline" className="rounded-full" onClick={() => active && openDetail(active.item)}>
                重试
              </Button>
            </div>
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
                <p className="py-6 text-center text-sm text-muted-foreground">该考点暂无教材内容</p>
              ) : (
                <div className="prose-cd" dangerouslySetInnerHTML={{ __html: cleanHTML(detail.h) }} />
              )}
              <Badge variant="secondary" className="mt-2 rounded-full">
                考点 ID {active?.item.i}
              </Badge>
            </div>
          )}
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

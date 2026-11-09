import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { getChapter } from '@/lib/data'
import { useRecordsVersion, wrongChapters } from '@/lib/progress'
import { useIsWide } from '@/lib/use-media'
import { cn } from '@/lib/utils'

type Row = { chapterId: string; wrong: number; answered: number; name: string; total: number }

/** 错题本：按章聚合错题，点进章节进入「只刷错题」订正模式 */
export default function WrongPage() {
  useRecordsVersion()
  const wide = useIsWide()
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)

  const wrong = wrongChapters()
  const totalWrong = wrong.reduce((s, w) => s + w.wrong, 0)

  useEffect(() => {
    let alive = true
    if (wrong.length === 0) {
      setRows([])
      return
    }
    Promise.all(
      wrong.map(async (w) => {
        let name = `章节 ${w.chapterId}`
        let total = 0
        try {
          const ch = await getChapter(w.chapterId)
          name = ch.n
          total = ch.qs.length
        } catch { /* 名称拉不到时用 id 兜底 */ }
        return { ...w, name, total }
      }),
    ).then((r) => alive && setRows(r))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrong.length, totalWrong])

  return (
    <main className={cn('mx-auto w-full px-4', wide ? 'max-w-5xl px-8 pb-20' : 'max-w-2xl pb-24')}>
      <div className={cn(wide ? 'pt-8 pb-4' : 'sticky top-11 z-40 -mx-4 bg-background/80 px-4 pb-2 pt-3 backdrop-blur-xl')}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
            <Link to="/" aria-label="返回首页">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div className="font-display text-[19px] font-normal tracking-tight">错题本</div>
          {totalWrong > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {totalWrong} 道 · {wrong.length} 章
            </span>
          )}
        </div>
      </div>

      {!rows && (
        <div className="space-y-2 pt-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {rows && rows.length === 0 && (
        <Empty className="mt-6 rounded-xl border py-12">
          <EmptyHeader>
            <CheckCircleIcon className="size-10 text-success" weight="duotone" />
            <EmptyTitle>暂无错题</EmptyTitle>
            <EmptyDescription>答错的题会自动收进这里，随时回来订正</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {rows && rows.length > 0 && (
        <div className={cn('grid gap-2 pt-2 [&>*]:min-w-0', wide && 'grid-cols-2 gap-3')}>
          {rows.map((r) => (
            <Item asChild key={r.chapterId} variant="outline" className="flex-nowrap rounded-xl text-left">
              <button
                type="button"
                onClick={() => navigate(`/ch/${r.chapterId}`, { state: { onlyWrong: true } })}
              >
                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full min-w-0 text-left text-[15px] font-medium"><span className="min-w-0 flex-1 truncate">{r.name}</span></ItemTitle>
                  <ItemDescription className="tabular-nums">
                    错 <span className="font-semibold text-destructive">{r.wrong}</span> 题
                    {r.total > 0 && <> · 已答 {r.answered}/{r.total}</>}
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="shrink-0">
                  <span className="flex items-center gap-1 text-sm font-medium text-primary">
                    订正
                    <ArrowRightIcon className="size-4" />
                  </span>
                </ItemActions>
              </button>
            </Item>
          ))}
        </div>
      )}
    </main>
  )
}

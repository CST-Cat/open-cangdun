import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, ArrowRightIcon, BookmarkSimpleIcon } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { favoriteChapters, toggleFavorite, useCollectionsVersion } from '@/lib/collections'
import { getChapter } from '@/lib/data'
import type { Question } from '@/lib/types'
import { useIsWide } from '@/lib/use-media'
import { cn } from '@/lib/utils'

type FavQ = { chapterId: string; chapterName: string; q: Question }
type Group = { chapterId: string; name: string; items: FavQ[] }

/** 收藏题目：按章分组（章按最近收藏序，题按原题序），点题直达刷题页该题 */
export default function FavoritesPage() {
  useCollectionsVersion()
  const wide = useIsWide()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<Group[] | null>(null)

  const favs = favoriteChapters()
  const total = favs.reduce((s, f) => s + f.qids.length, 0)
  const favKey = favs.map((f) => `${f.chapterId}:${f.qids.join(',')}`).join('|')

  useEffect(() => {
    let alive = true
    if (favs.length === 0) {
      setGroups([])
      return
    }
    Promise.all(
      favs.map(async (f) => {
        let name = `章节 ${f.chapterId}`
        let items: FavQ[] = []
        try {
          const ch = await getChapter(f.chapterId)
          name = ch.n
          const want = new Set(f.qids)
          items = ch.qs.filter((q) => want.has(q.i)).map((q) => ({ chapterId: f.chapterId, chapterName: ch.n, q }))
        } catch { /* 章节拉不到时只显示章名 */ }
        return { chapterId: f.chapterId, name, items }
      }),
    ).then((r) => alive && setGroups(r))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favKey])

  return (
    <main className={cn('mx-auto w-full px-4', wide ? 'max-w-[1200px] px-10 pb-20' : 'max-w-2xl pb-24')}>
      <div className={cn(wide ? 'pt-8 pb-4' : 'sticky top-11 z-40 -mx-4 bg-background/80 px-4 pb-2 pt-3 backdrop-blur-xl')}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
            <Link to="/" aria-label="返回首页">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div className="font-display text-[19px] font-normal tracking-tight">收藏题目</div>
          {total > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {total} 道 · {favs.length} 章
            </span>
          )}
        </div>
      </div>

      {!groups && (
        <div className="space-y-2 pt-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {groups && groups.length === 0 && (
        <Empty className="mt-6 rounded-xl border py-12">
          <EmptyHeader>
            <BookmarkSimpleIcon className="size-10 text-primary" weight="duotone" />
            <EmptyTitle>暂无收藏</EmptyTitle>
            <EmptyDescription>刷题时点题目下方的「收藏」，题目就会收进这里</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {groups && groups.map((g) => (
        <section key={g.chapterId} className="pt-4">
          <h2 className="truncate text-sm font-medium text-muted-foreground">{g.name}</h2>
          <div className="grid gap-2 pt-2 [&>*]:min-w-0">
            {g.items.map(({ q }) => (
              <Item asChild key={q.i} variant="outline" className="h-full flex-nowrap rounded-xl text-left">
                <button
                  type="button"
                  onClick={() => navigate(`/ch/${g.chapterId}`, { state: { startQid: q.i } })}
                >
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full min-w-0 text-left text-[15px] font-medium">
                      <span className="line-clamp-2 min-w-0 flex-1 whitespace-pre-wrap">{q.q}</span>
                    </ItemTitle>
                    <ItemDescription className="flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-full px-2">{q.t}</Badge>
                      {q.k && <span className="truncate">{q.k}</span>}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="shrink-0">
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="取消收藏"
                      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(g.chapterId, q.i)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleFavorite(g.chapterId, q.i)
                        }
                      }}
                    >
                      <BookmarkSimpleIcon className="size-4 text-primary" weight="fill" />
                      取消
                    </span>
                    <span className="flex items-center gap-1 text-sm font-medium text-primary">
                      去刷题
                      <ArrowRightIcon className="size-4" />
                    </span>
                  </ItemActions>
                </button>
              </Item>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}

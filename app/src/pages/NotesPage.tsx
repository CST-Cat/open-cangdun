import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, ArrowRightIcon, NotePencilIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import NoteDialog from '@/components/NoteDialog'
import { noteChapters, useCollectionsVersion } from '@/lib/collections'
import { getChapter } from '@/lib/data'
import { useIsWide } from '@/lib/use-media'
import { cn } from '@/lib/utils'

type NoteRow = { qid: string; t: string; ts: number; stem: string }
type Group = { chapterId: string; name: string; rows: NoteRow[] }

const fmtDay = (ts: number) => {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 我的笔记：按章分组（最近编辑在前），可直接编辑，点条目直达刷题页该题 */
export default function NotesPage() {
  useCollectionsVersion()
  const wide = useIsWide()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [editing, setEditing] = useState<{ chapterId: string; qid: string; stem: string } | null>(null)

  const chapters = noteChapters()
  const total = chapters.reduce((s, c) => s + c.notes.length, 0)
  const noteKey = chapters.map((c) => `${c.chapterId}:${c.notes.map((n) => `${n.qid}@${n.ts}`).join(',')}`).join('|')

  useEffect(() => {
    let alive = true
    if (chapters.length === 0) {
      setGroups([])
      return
    }
    Promise.all(
      chapters.map(async (c) => {
        let name = `章节 ${c.chapterId}`
        const stems = new Map<string, string>()
        try {
          const ch = await getChapter(c.chapterId)
          name = ch.n
          for (const q of ch.qs) stems.set(q.i, q.q)
        } catch { /* 章节拉不到时只显示章名 */ }
        return {
          chapterId: c.chapterId,
          name,
          rows: c.notes.map((n) => ({ ...n, stem: stems.get(n.qid) ?? '' })),
        }
      }),
    ).then((r) => alive && setGroups(r))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteKey])

  return (
    <main className={cn('mx-auto w-full px-4', wide ? 'max-w-[1200px] px-10 pb-20' : 'max-w-2xl pb-24')}>
      <div className={cn(wide ? 'pt-8 pb-4' : 'sticky top-11 z-40 -mx-4 bg-background/80 px-4 pb-2 pt-3 backdrop-blur-xl')}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
            <Link to="/" aria-label="返回首页">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div className="font-display text-[19px] font-normal tracking-tight">我的笔记</div>
          {total > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {total} 条 · {chapters.length} 章
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
            <NotePencilIcon className="size-10 text-primary" weight="duotone" />
            <EmptyTitle>暂无笔记</EmptyTitle>
            <EmptyDescription>刷题时点题目下方的「笔记」，写下的内容会收进这里</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {groups && groups.map((g) => (
        <section key={g.chapterId} className="pt-4">
          <h2 className="truncate text-sm font-medium text-muted-foreground">{g.name}</h2>
          <div className="grid gap-2 pt-2 [&>*]:min-w-0">
            {g.rows.map((r) => (
              <Item asChild key={r.qid} variant="outline" className="h-full flex-nowrap rounded-xl text-left">
                <button
                  type="button"
                  onClick={() => navigate(`/ch/${g.chapterId}`, { state: { startQid: r.qid } })}
                >
                  <ItemContent className="min-w-0">
                    {r.stem && (
                      <ItemTitle className="w-full min-w-0 text-left text-[13px] font-normal text-muted-foreground">
                        <span className="line-clamp-1 min-w-0 flex-1 whitespace-pre-wrap">{r.stem}</span>
                      </ItemTitle>
                    )}
                    <p className="line-clamp-3 text-[15px] leading-relaxed whitespace-pre-wrap">{r.t}</p>
                    <ItemDescription className="tabular-nums">{fmtDay(r.ts)} 编辑</ItemDescription>
                  </ItemContent>
                  <ItemActions className="shrink-0">
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="编辑笔记"
                      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing({ chapterId: g.chapterId, qid: r.qid, stem: r.stem })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          setEditing({ chapterId: g.chapterId, qid: r.qid, stem: r.stem })
                        }
                      }}
                    >
                      <NotePencilIcon className="size-4" />
                      编辑
                    </span>
                    <span className="flex items-center gap-1 text-sm font-medium text-primary">
                      去看题
                      <ArrowRightIcon className="size-4" />
                    </span>
                  </ItemActions>
                </button>
              </Item>
            ))}
          </div>
        </section>
      ))}

      {editing && (
        <NoteDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          chapterId={editing.chapterId}
          qid={editing.qid}
          stem={editing.stem}
        />
      )}
    </main>
  )
}

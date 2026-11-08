import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ListIcon,
} from '@phosphor-icons/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getChapter, prefetchChapter } from '@/lib/data'
import { cleanHTML } from '@/lib/html'
import { getChapterRecords, judge, recordAnswer, setLast, useRecordsVersion } from '@/lib/progress'
import type { Question } from '@/lib/types'
import { cn } from '@/lib/utils'

const idle = (fn: () => void) => {
  if ('requestIdleCallback' in window) requestIdleCallback(fn)
  else setTimeout(fn, 300)
}

/** 去掉选项自带的 "A." / "A、" 前缀，字母交给 Badge */
const stripPrefix = (s: string) => s.replace(/^[A-D]\s*[.、．:：]\s*/, '')

const pct = (r: number, tot: number) => (tot > 0 ? `${Math.round((r / tot) * 100)}%` : null)

/** 判分后选项配色（仅 shadcn 组件 + 状态类） */
function judgedClass(letter: string, pickedNow: string[], answer: string): string {
  const isAnswer = answer.includes(letter)
  const isPicked = pickedNow.includes(letter)
  if (isAnswer) return 'border-success! bg-success/15! text-success!'
  if (isPicked) return 'border-destructive! bg-destructive/15! text-destructive!'
  return 'opacity-50'
}

export default function Quiz() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  useRecordsVersion()

  const state = (location.state ?? null) as
    | { tiku: string; subj: string; siblings: string[]; sIdx: number }
    | null

  const [chapter, setChapter] = useState<{ n: string; qs: Question[] } | null>(null)
  const [failed, setFailed] = useState(false)
  const [qIdx, setQIdx] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [judged, setJudged] = useState(false)
  const [gridOpen, setGridOpen] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  const records = getChapterRecords(id)

  const load = useCallback(() => {
    setFailed(false)
    setChapter(null)
    void getChapter(id)
      .then((ch) => setChapter(ch))
      .catch(() => setFailed(true))
  }, [id])

  useEffect(load, [load])

  // 章节切换（下一章/上一章）时重置到第一题
  useEffect(() => {
    setQIdx(0)
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [id])

  // 空闲预取同组上/下一章 —— 跨章刷题无等待
  useEffect(() => {
    if (!state) return
    idle(() => {
      const prev = state.siblings[state.sIdx - 1]
      const next = state.siblings[state.sIdx + 1]
      if (prev) prefetchChapter(prev)
      if (next) prefetchChapter(next)
    })
  }, [state])

  const q = chapter?.qs[qIdx]
  const total = chapter?.qs.length ?? 0
  const isMulti = q?.t === '多选'

  // 恢复历史作答 & 切题重置
  useEffect(() => {
    const rec = records[q?.i ?? '']
    setPicked(rec ? rec[0].split('') : [])
    setJudged(Boolean(rec))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.i, id])

  useEffect(() => {
    if (chapter) setLast(id, chapter.n, qIdx)
  }, [id, chapter, qIdx])

  const doJudge = useCallback(() => {
    if (!q || judged || picked.length === 0) return
    setJudged(true)
    recordAnswer(id, q.i, [...picked].sort().join(''), judge(picked, q.a))
  }, [id, q, judged, picked])

  const pick = (letter: string) => {
    if (judged || !q) return
    if (!isMulti) {
      const ok = judge([letter], q.a)
      setPicked([letter])
      setJudged(true)
      recordAnswer(id, q.i, letter, ok)
    } else {
      setPicked((p) => (p.includes(letter) ? p.filter((x) => x !== letter) : [...p, letter]))
    }
  }

  const go = (i: number) => {
    setQIdx(i)
    topRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' })
  }
  const prevQ = () => qIdx > 0 && go(qIdx - 1)
  const nextQ = () => qIdx < total - 1 && go(qIdx + 1)

  // 键盘左右切题
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevQ()
      if (e.key === 'ArrowRight') nextQ()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx, total, state])

  const gotoChapter = (delta: 1 | -1) => {
    if (!state) return
    const nextId = state.siblings[state.sIdx + delta]
    if (!nextId) return
    navigate(`/ch/${nextId}`, { state: { ...state, sIdx: state.sIdx + delta } })
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28">
      {/* 顶部：返回 / 章节名 / 题号表 */}
      <div className="sticky top-11 z-40 -mx-4 mb-4 bg-background/80 px-4 pb-2 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
            <Link to="/" aria-label="返回目录">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight">
            {chapter?.n ?? '加载中…'}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {total ? qIdx + 1 : 0}/{total}
          </span>
          <Sheet open={gridOpen} onOpenChange={setGridOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="题号列表" disabled={!chapter}>
                <ListIcon className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl">
              <SheetHeader>
                <SheetTitle className="text-left">本章题目（{total}）</SheetTitle>
              </SheetHeader>
              <ToggleGroup
                type="single"
                variant="outline"
                className="grid w-full max-h-[50vh] grid-cols-7 grid-flow-dense gap-2 overflow-y-auto px-4 pb-8 sm:grid-cols-9"
                value={String(qIdx)}
                onValueChange={(v) => {
                  if (v !== '') {
                    go(Number(v))
                    setGridOpen(false)
                  }
                }}
              >
                {chapter?.qs.map((qq, i) => {
                  const rec = records[qq.i]
                  return (
                    <ToggleGroupItem
                      key={qq.i}
                      value={String(i)}
                      className={cn(
                        'tabular-nums',
                        !rec && '',
                        rec?.[1] === 1 && 'border-success/60! bg-success/15! text-success!',
                        rec?.[1] === 0 && 'border-destructive/60! bg-destructive/15! text-destructive!',
                        i === qIdx && 'ring-2 ring-primary',
                      )}
                    >
                      {i + 1}
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
            </SheetContent>
          </Sheet>
        </div>
        <Progress value={total ? ((qIdx + 1) / total) * 100 : 0} className="mt-2 h-1" />
      </div>

      {failed && (
        <Empty className="rounded-2xl border py-12">
          <EmptyHeader>
            <EmptyTitle>章节加载失败</EmptyTitle>
            <EmptyDescription>网络或数据暂时不可用</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" className="rounded-full" onClick={load}>
              重试
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {!chapter && !failed && (
        <Card className="rounded-2xl py-6 shadow-none">
          <CardContent className="space-y-3">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </CardContent>
        </Card>
      )}

      {q && chapter && (
        <div ref={topRef} className="scroll-mt-28">
          {/* 题干 */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isMulti ? 'secondary' : 'default'} className="rounded-full px-2.5">
              {q.t}
            </Badge>
            {q.k && <Badge variant="outline" className="max-w-56 truncate rounded-full px-2.5 font-normal">{q.k}</Badge>}
          </div>
          <p className="mt-3 text-[17px] leading-relaxed font-medium tracking-tight whitespace-pre-wrap">
            {q.q}
          </p>

          {/* 选项：ToggleGroup（单选 single / 多选 multiple） */}
          {isMulti ? (
            <ToggleGroup
              type="multiple"
              variant="outline"
              className="mt-4 w-full flex-col items-stretch gap-2.5"
              value={judged ? [] : picked}
              disabled={judged}
              onValueChange={(v: string[]) => setPicked(v)}
            >
              {Object.entries(q.o).map(([letter, text]) => (
                <ToggleGroupItem
                  key={letter}
                  value={letter}
                  className={cn(
                    'h-auto justify-start gap-3 rounded-2xl px-3.5 py-3 text-left',
                    judged && judgedClass(letter, picked, q.a),
                  )}
                >
                  <Badge variant="secondary" className="shrink-0">{letter}</Badge>
                  <span className="text-[15px] leading-relaxed font-normal">{stripPrefix(text)}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : (
            <ToggleGroup
              type="single"
              variant="outline"
              className="mt-4 w-full flex-col items-stretch gap-2.5"
              value={judged ? '' : (picked[0] ?? '')}
              disabled={judged}
              onValueChange={(v: string) => {
                if (v) pick(v)
              }}
            >
              {Object.entries(q.o).map(([letter, text]) => (
                <ToggleGroupItem
                  key={letter}
                  value={letter}
                  className={cn(
                    'h-auto justify-start gap-3 rounded-2xl px-3.5 py-3 text-left',
                    judged && judgedClass(letter, picked, q.a),
                  )}
                >
                  <Badge variant="secondary" className="shrink-0">{letter}</Badge>
                  <span className="text-[15px] leading-relaxed font-normal">{stripPrefix(text)}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}

          {/* 多选确认 */}
          {isMulti && !judged && (
            <Button
              className="mt-4 w-full rounded-full py-5 text-[15px]"
              disabled={picked.length < 2}
              onClick={doJudge}
            >
              {picked.length === 0 && '选择后确认'}
              {picked.length === 1 && '多选题至少选两项'}
              {picked.length >= 2 && `确认答案（${[...picked].sort().join('')}）`}
            </Button>
          )}

          {/* 判分结果：Alert */}
          {judged && q && (
            <div className="mt-4 space-y-3">
              <Alert className={cn(judge(picked, q.a) ? 'border-success/40 bg-success/10' : 'border-destructive/40 bg-destructive/10')}>
                <AlertTitle className={cn('text-[15px] font-semibold', judge(picked, q.a) ? 'text-success' : 'text-destructive')}>
                  {judge(picked, q.a) ? '回答正确' : '回答错误'}
                </AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">正确答案 {q.a}</Badge>
                  {pct(q.r, q.tot) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="tabular-nums">全站正确率 {pct(q.r, q.tot)}</Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {q.r.toLocaleString()} / {q.tot.toLocaleString()} 人做对
                      </TooltipContent>
                    </Tooltip>
                  )}
                </AlertDescription>
              </Alert>

              {q.j && (
                <Card className="rounded-2xl bg-secondary/60 py-4 shadow-none">
                  <CardHeader className="px-4">
                    <CardTitle className="text-sm text-muted-foreground">解析</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4">
                    <div
                      className="prose-cd"
                      dangerouslySetInnerHTML={{ __html: cleanHTML(q.j) }}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* 底部导航（毛玻璃悬浮条） */}
      {chapter && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-secondary/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-2xl items-center gap-2 px-4">
            <Button
              variant="outline"
              className="flex-1 rounded-full"
              onClick={qIdx === 0 ? () => gotoChapter(-1) : prevQ}
              disabled={qIdx === 0 && !state?.siblings[state.sIdx - 1]}
            >
              <CaretLeftIcon className="size-4" />
              {qIdx === 0 ? '上一章' : '上一题'}
            </Button>
            {qIdx < total - 1 ? (
              <Button className="flex-1 rounded-full" onClick={nextQ}>
                下一题
                <CaretRightIcon className="size-4" />
              </Button>
            ) : (
              <Button
                className="flex-1 rounded-full"
                onClick={() => gotoChapter(1)}
                disabled={!state?.siblings[state.sIdx + 1]}
              >
                下一章
                <ArrowRightIcon className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

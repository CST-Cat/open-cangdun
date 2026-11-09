import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ListIcon,
  XCircleIcon,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { OptionItem, type OptionState } from '@/components/OptionItem'
import { getChapter, prefetchChapter } from '@/lib/data'
import { cleanHTML } from '@/lib/html'
import { getChapterRecords, judge, recordAnswer, setLast, useRecordsVersion } from '@/lib/progress'
import { useIsWide } from '@/lib/use-media'
import type { Question } from '@/lib/types'
import { cn } from '@/lib/utils'

const idle = (fn: () => void) => {
  if ('requestIdleCallback' in window) requestIdleCallback(fn)
  else setTimeout(fn, 300)
}

/** 去掉选项自带的 "A." / "A、" 前缀，字母交给字母徽 */
const stripPrefix = (s: string) => s.replace(/^[A-D]\s*[.、．:：]\s*/, '')

const pct = (r: number, tot: number) => (tot > 0 ? `${Math.round((r / tot) * 100)}%` : null)

type NavState = { tiku: string; subj: string; siblings: string[]; sIdx: number; onlyWrong?: boolean } | { onlyWrong: true } | null

export default function Quiz() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  useRecordsVersion()

  const wide = useIsWide()
  const state = (location.state ?? null) as NavState
  const onlyWrong = Boolean(state && 'onlyWrong' in state && state.onlyWrong)
  const siblings = state && 'siblings' in state ? state.siblings : null
  const sIdx = state && 'sIdx' in state ? state.sIdx : 0

  const [chapter, setChapter] = useState<{ n: string; qs: Question[] } | null>(null)
  const [failed, setFailed] = useState(false)
  const [qIdx, setQIdx] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [judged, setJudged] = useState(false)
  const [gridOpen, setGridOpen] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const verdictRef = useRef<HTMLDivElement>(null)

  const records = getChapterRecords(id)

  const load = useCallback(() => {
    setFailed(false)
    setChapter(null)
    void getChapter(id)
      .then((ch) => {
        if (onlyWrong) {
          // 订正模式：以进入时刻的错题快照过滤，答对后不中途缩表
          const recs = getChapterRecords(id)
          setChapter({ n: ch.n, qs: ch.qs.filter((q) => recs[q.i]?.[1] === 0) })
        } else {
          setChapter(ch)
        }
      })
      .catch(() => setFailed(true))
  }, [id, onlyWrong])

  useEffect(load, [load])

  useEffect(() => {
    setQIdx(0)
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [id])

  // 空闲预取同组上/下一章
  useEffect(() => {
    if (!siblings) return
    idle(() => {
      const prev = siblings[sIdx - 1]
      const next = siblings[sIdx + 1]
      if (prev) prefetchChapter(prev)
      if (next) prefetchChapter(next)
    })
  }, [siblings, sIdx])

  const q = chapter?.qs[qIdx]
  const total = chapter?.qs.length ?? 0
  const isMulti = q?.t === '多选'

  useEffect(() => {
    if (onlyWrong) {
      // 订正模式：不回填旧记录，从空白重做（答完即覆盖旧记录）
      setPicked([])
      setJudged(false)
      return
    }
    const rec = records[q?.i ?? '']
    setPicked(rec ? rec[0].split('') : [])
    setJudged(Boolean(rec))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.i, id])

  useEffect(() => {
    if (chapter && !onlyWrong) setLast(id, chapter.n, qIdx)
  }, [id, chapter, qIdx, onlyWrong])

  // 判分后把结论条带进视野（手机上不用再往下翻找）
  useEffect(() => {
    if (judged) {
      const t = setTimeout(() => verdictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)


  return () => clearTimeout(t)
    }
  }, [judged, q?.i])

  const doJudge = useCallback(() => {
    if (!q || judged || picked.length === 0) return
    setJudged(true)
    recordAnswer(id, q.i, [...picked].sort().join(''), judge(picked, q.a))
  }, [id, q, judged, picked])

  const pick = useCallback(
    (letter: string) => {
      if (judged || !q) return
      if (!isMulti) {
        const ok = judge([letter], q.a)
        setPicked([letter])
        setJudged(true)
        recordAnswer(id, q.i, letter, ok)
      } else {
        setPicked((p) => (p.includes(letter) ? p.filter((x) => x !== letter) : [...p, letter]))
      }
    },
    [id, q, judged, isMulti],
  )

  const go = useCallback(
    (i: number) => {
      setQIdx(i)
      topRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' })
    },
    [],
  )
  const prevQ = useCallback(() => qIdx > 0 && go(qIdx - 1), [qIdx, go])
  const nextQ = useCallback(() => qIdx < total - 1 && go(qIdx + 1), [qIdx, total, go])

  const gotoChapter = useCallback(
    (delta: 1 | -1) => {
      if (!siblings || !state || !('tiku' in state)) return
      const nextId = siblings[sIdx + delta]
      if (!nextId) return
      navigate(`/ch/${nextId}`, { state: { ...state, sIdx: sIdx + delta } })
    },
    [siblings, state, sIdx, navigate],
  )

  // 键盘：←/→ 切题，A–D / 1–4 选项，Enter 确认多选 / 判分后下一题
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowLeft') return prevQ()
      if (e.key === 'ArrowRight') return nextQ()
      if (!q || gridOpen) return
      const letters = Object.keys(q.o)
      const up = e.key.toUpperCase()
      if (letters.includes(up)) return pick(up)
      const num = Number(e.key)
      if (num >= 1 && num <= letters.length) return pick(letters[num - 1])
      if (e.key === 'Enter') {
        if (!judged && isMulti && picked.length >= 2) doJudge()
        else if (judged) qIdx < total - 1 ? nextQ() : gotoChapter(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevQ, nextQ, pick, doJudge, gotoChapter, q, judged, isMulti, picked, qIdx, total, gridOpen])

  const optionState = (letter: string): OptionState => {
    if (!q) return 'idle'
    if (!judged) return picked.includes(letter) ? 'picked' : 'idle'
    if (q.a.includes(letter)) return 'correct'
    if (picked.includes(letter)) return 'wrong'
    return 'dim'
  }

  const answeredInChapter = chapter ? chapter.qs.filter((qq) => records[qq.i]).length : 0
  const okNow = q ? judge(picked, q.a) : false

  const bodyContent = (
    <>
      {failed && (
        <Empty className="rounded-xl border py-12">
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
        <Card className="rounded-xl py-6 shadow-none">
          <CardContent className="space-y-3">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </CardContent>
        </Card>
      )}

      {chapter && total === 0 && (
        <Empty className="rounded-xl border py-12">
          <EmptyHeader>
            <EmptyTitle>{onlyWrong ? '这一章的错题都订正完了' : '本章暂无题目'}</EmptyTitle>
            <EmptyDescription>{onlyWrong ? '回到错题本继续下一章' : '换个章节试试'}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" className="rounded-full" asChild>
              <Link to={onlyWrong ? '/wrong' : '/'}>{onlyWrong ? '回错题本' : '回首页'}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {q && chapter && (
        <div ref={topRef} className="scroll-mt-28">
          {/* 题干 */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant={isMulti ? 'secondary' : 'default'} className="rounded-full px-2.5">
              {q.t}
            </Badge>
            {q.k && (
              <Badge variant="outline" className="max-w-64 truncate rounded-full px-3 font-normal">{q.k}</Badge>
            )}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {pct(q.r, q.tot) && <>全站正确率 {pct(q.r, q.tot)}</>}
            </span>
          </div>
          <p className="mt-3 text-[17px] leading-[1.8] font-medium tracking-tight whitespace-pre-wrap">
            {q.q}
          </p>

          {/* 选项：自有 OptionItem（状态色 + 字母徽） */}
          <div className="mt-4 flex flex-col gap-2.5">
            {Object.entries(q.o).map(([letter, text]) => (
              <OptionItem
                key={letter}
                letter={letter}
                text={stripPrefix(text)}
                state={optionState(letter)}
                disabled={judged}
                onClick={() => pick(letter)}
              />
            ))}
          </div>

          {/* 多选确认 */}
          {isMulti && !judged && (
            <Button
              className="mt-4 w-full rounded-lg py-5 text-[15px]"
              disabled={picked.length < 2}
              onClick={doJudge}
            >
              {picked.length === 0 && '选择后确认'}
              {picked.length === 1 && '多选题至少选两项'}
              {picked.length >= 2 && `确认答案（${[...picked].sort().join('')}）`}
            </Button>
          )}

          {/* 判分结论 + 解析（原地展开） */}
          {judged && (
            <div ref={verdictRef} className="mt-4 scroll-mt-28 space-y-3">
              <div
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-4 py-3',
                  okNow ? 'border-success/50 bg-success/10' : 'border-destructive/50 bg-destructive/10',
                )}
              >
                {okNow ? (
                  <CheckCircleIcon className="size-5 text-success" weight="fill" />
                ) : (
                  <XCircleIcon className="size-5 text-destructive" weight="fill" />
                )}
                <span className={cn('text-[15px] font-semibold', okNow ? 'text-success' : 'text-destructive')}>
                  {okNow ? '回答正确' : '回答错误'}
                </span>
                <span className="text-sm text-muted-foreground">
                  正确答案 <span className="font-semibold text-foreground">{q.a}</span>
                  {!okNow && <> · 你选了 <span className="font-semibold text-foreground">{[...picked].sort().join('')}</span></>}
                </span>
                <span className="ml-auto hidden text-xs text-muted-foreground tabular-nums sm:block">
                  {q.tot > 0 && <>{q.r.toLocaleString()} / {q.tot.toLocaleString()} 人做对</>}
                </span>
              </div>

              {q.j && (
                <section className="rounded-xl bg-secondary/70 px-4 py-4">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="font-display text-[17px] font-normal">解析</h3>
                    {q.kid && (
                      <Link
                        to={`/kd?focus=${q.kid}`}
                        className="ml-auto flex items-center gap-1 text-[13px] font-medium text-primary"
                      >
                        看考点教材
                        <ArrowRightIcon className="size-3.5" />
                      </Link>
                    )}
                  </div>
                  <div className="prose-cd" dangerouslySetInnerHTML={{ __html: cleanHTML(q.j) }} />
                </section>
              )}
            </div>
          )}

          <p className="mt-5 hidden text-center text-xs text-muted-foreground md:block lg:hidden">
            键盘：A–D 选项 · ←/→ 切题 · Enter 确认 / 下一题
          </p>
        </div>
      )}

      {wide && chapter && total > 0 && (
        <div className="mt-8 flex items-center gap-3 border-t border-border/60 pt-4">
          <Button
            variant="outline"
            className="rounded-full px-5"
            onClick={qIdx === 0 ? () => gotoChapter(-1) : prevQ}
            disabled={qIdx === 0 && !siblings?.[sIdx - 1]}
          >
            <CaretLeftIcon className="size-4" />
            {qIdx === 0 && siblings ? '上一章' : '上一题'}
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">已答 {answeredInChapter}/{total}</span>
          {qIdx < total - 1 ? (
            <Button className="ml-auto rounded-full px-5" onClick={nextQ}>
              下一题
              <CaretRightIcon className="size-4" />
            </Button>
          ) : (
            <Button className="ml-auto rounded-full px-5" onClick={() => gotoChapter(1)} disabled={!siblings?.[sIdx + 1]}>
              下一章
              <ArrowRightIcon className="size-4" />
            </Button>
          )}
        </div>
      )}
    </>
  )

  return (
    <main className={cn('mx-auto w-full', wide ? 'max-w-[1200px] px-10 pb-20' : 'max-w-2xl px-4 pb-28')}>
      {/* 顶部：返回 / 章节名 / 题号表 */}
      <div className={cn(wide ? 'mb-5 pt-8' : 'sticky top-11 z-40 -mx-4 mb-4 bg-background/80 px-4 pb-2 pt-3 backdrop-blur-xl')}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
            <Link to={onlyWrong ? '/wrong' : '/'} aria-label="返回">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div className={cn('min-w-0 flex-1 truncate tracking-tight', wide ? 'font-display text-[21px] font-normal' : 'text-[15px] font-semibold')}>
            {chapter?.n ?? '加载中…'}
          </div>
          {onlyWrong && (
            <Badge variant="outline" className="shrink-0 border-destructive/50 text-destructive">错题订正</Badge>
          )}
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {total ? qIdx + 1 : 0}/{total}
          </span>
          {!wide && (<Sheet open={gridOpen} onOpenChange={setGridOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="题号列表" disabled={!chapter}>
                <ListIcon className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl">
              <SheetHeader>
                <SheetTitle className="text-left">本章题目（{total}）</SheetTitle>
              </SheetHeader>
              <div className="grid max-h-[50vh] w-full grid-flow-dense grid-cols-7 gap-2 overflow-y-auto px-4 pb-8 sm:grid-cols-9">
                {chapter?.qs.map((qq, i) => {
                  const rec = records[qq.i]
                  return (
                    <button
                      key={qq.i}
                      type="button"
                      onClick={() => {
                        go(i)
                        setGridOpen(false)
                      }}
                      className={cn(
                        'flex h-9 items-center justify-center rounded-lg border text-sm tabular-nums transition-colors',
                        !rec && 'border-border bg-background',
                        rec?.[1] === 1 && 'border-success/60 bg-success/15 text-success',
                        rec?.[1] === 0 && 'border-destructive/60 bg-destructive/15 text-destructive',
                        i === qIdx && 'ring-2 ring-primary ring-offset-1',
                      )}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </SheetContent>
          </Sheet>)}
        </div>
        <Progress value={total ? ((qIdx + 1) / total) * 100 : 0} className="mt-2 h-1" />
      </div>

{wide && chapter && total > 0 ? (
        <div className="grid grid-cols-[320px_minmax(0,1fr)] items-start gap-8">
          <aside className="sticky top-8 rounded-xl border border-border/70 bg-card p-4">
            <div className="text-xs text-muted-foreground">本章进度</div>
            <div className="mt-1 text-sm font-medium tabular-nums">已答 {answeredInChapter} / {total}</div>
            <Progress value={total ? (answeredInChapter / total) * 100 : 0} className="mt-2 h-1.5" />
            <div className="mt-4 grid grid-cols-6 gap-1.5">
              {chapter.qs.map((qq, i) => {
                const rec = records[qq.i]
                return (
                  <button
                    key={qq.i}
                    type="button"
                    onClick={() => go(i)}
                    className={cn(
                      'flex h-8 items-center justify-center rounded-md border text-[13px] tabular-nums transition-colors',
                      !rec && 'border-border bg-background hover:border-primary/50',
                      rec?.[1] === 1 && 'border-success/60 bg-success/15 text-success',
                      rec?.[1] === 0 && 'border-destructive/60 bg-destructive/15 text-destructive',
                      i === qIdx && 'ring-2 ring-primary ring-offset-1',
                    )}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
              <Button variant="outline" size="sm" className="w-full rounded-full" onClick={() => gotoChapter(-1)} disabled={!siblings?.[sIdx - 1]}>
                上一章
              </Button>
              <Button variant="outline" size="sm" className="w-full rounded-full" onClick={() => gotoChapter(1)} disabled={!siblings?.[sIdx + 1]}>
                下一章
              </Button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">键盘：A–D 选项 · ←/→ 切题 · Enter 确认 / 下一题</p>
          </aside>
          <div className="min-w-0 max-w-[720px]">{bodyContent}</div>
        </div>
      ) : (
        bodyContent
      )}
      {/* 底部导航 */}
      {!wide && chapter && total > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-secondary/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-2xl items-center gap-2 px-4">
            <Button
              variant="outline"
              className="flex-1 rounded-full"
              onClick={qIdx === 0 ? () => gotoChapter(-1) : prevQ}
              disabled={qIdx === 0 && !siblings?.[sIdx - 1]}
            >
              <CaretLeftIcon className="size-4" />
              {qIdx === 0 && siblings ? '上一章' : '上一题'}
            </Button>
            <span className="w-14 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
              已答 {answeredInChapter}/{total}
            </span>
            {qIdx < total - 1 ? (
              <Button className="flex-1 rounded-full" onClick={nextQ}>
                下一题
                <CaretRightIcon className="size-4" />
              </Button>
            ) : (
              <Button
                className="flex-1 rounded-full"
                onClick={() => gotoChapter(1)}
                disabled={!siblings?.[sIdx + 1]}
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

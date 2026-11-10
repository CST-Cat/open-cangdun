import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { deleteNote, getNote, setNote, useCollectionsVersion } from '@/lib/collections'

/** 笔记编辑弹窗：刷题页与我的笔记页共用。保存空正文等于删除。 */
export default function NoteDialog({
  open,
  onOpenChange,
  chapterId,
  qid,
  stem,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  chapterId: string
  qid: string
  stem?: string
}) {
  useCollectionsVersion()
  const [draft, setDraft] = useState('')
  const existing = getNote(chapterId, qid)

  useEffect(() => {
    if (open) setDraft(getNote(chapterId, qid))
  }, [open, chapterId, qid])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-left">这道题的笔记</DialogTitle>
          {stem && <DialogDescription className="line-clamp-2 text-left">{stem}</DialogDescription>}
        </DialogHeader>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="写下错因、口诀、易混点…"
          rows={6}
          autoFocus
          className="resize-none leading-relaxed"
        />
        <DialogFooter className="gap-2 sm:gap-2">
          {existing && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive hover:text-destructive"
              onClick={() => {
                deleteNote(chapterId, qid)
                onOpenChange(false)
              }}
            >
              删除笔记
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() => {
              setNote(chapterId, qid, draft)
              onOpenChange(false)
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

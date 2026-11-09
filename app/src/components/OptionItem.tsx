import { CheckIcon, XIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export type OptionState = 'idle' | 'picked' | 'correct' | 'wrong' | 'dim'

/**
 * 刷题选项（自有组件，替代 ToggleGroup 硬套）：
 * idle 未选 / picked 已选未判 / correct 正确答案 / wrong 选错 / dim 判分后其余项
 */
export function OptionItem({
  letter,
  text,
  state,
  disabled,
  onClick,
}: {
  letter: string
  text: string
  state: OptionState
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-letter={letter}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={state === 'picked' || state === 'correct' || state === 'wrong'}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
        state === 'idle' && 'border-border bg-secondary/50 hover:border-foreground/40 hover:bg-secondary',
        state === 'picked' && 'border-foreground bg-secondary',
        state === 'correct' && 'border-success/70 bg-success/10',
        state === 'wrong' && 'border-destructive/70 bg-destructive/10',
        state === 'dim' && 'border-border bg-secondary/30 opacity-45',
        disabled && 'cursor-default',
      )}
    >
      <span
        className={cn(
          'mt-px flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold tabular-nums',
          state === 'idle' && 'border-border bg-background text-muted-foreground',
          state === 'picked' && 'border-foreground bg-foreground text-background',
          state === 'correct' && 'border-success bg-success text-success-foreground',
          state === 'wrong' && 'border-destructive bg-destructive text-white',
          state === 'dim' && 'border-border bg-background text-muted-foreground',
        )}
      >
        {state === 'correct' ? <CheckIcon className="size-4" weight="bold" /> : state === 'wrong' ? <XIcon className="size-4" weight="bold" /> : letter}
      </span>
      <span className="min-w-0 flex-1 pt-0.5 text-[15px] leading-relaxed">{text}</span>
    </button>
  )
}

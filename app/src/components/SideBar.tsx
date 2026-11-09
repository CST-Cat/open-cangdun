import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BookOpenIcon,
  CaretLeftIcon,
  GraduationCapIcon,
  HouseIcon,
  MoonIcon,
  SidebarSimpleIcon,
  SignOutIcon,
  SunIcon,
  XCircleIcon,
} from '@phosphor-icons/react'
import { useTheme } from 'next-themes'
import { useRecordsVersion, wrongStat } from '@/lib/progress'
import { cn } from '@/lib/utils'

function logout() {
  void fetch('/api/logout', { method: 'POST' }).finally(() => location.assign('/'))
}

/** 宽屏外壳导航：默认隐藏的可折叠抽屉——左缘拉手召唤，内容区永远全宽（窄屏用 TopBar） */
export default function SideBar() {
  const { pathname } = useLocation()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  useRecordsVersion()
  const wrong = wrongStat()

  // 跳转后自动收起
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Esc 收起
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open ])

  const item = (to: string, label: string, Icon: typeof HouseIcon, active: boolean, badge?: number) => (
    <Link
      key={to}
      to={to}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] transition-colors',
        active
          ? 'bg-secondary font-medium text-foreground'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      <Icon className="size-4.5" weight={active ? 'fill' : 'regular'} />
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{badge}</span>
      )}
    </Link>
  )

  return (
    <>
      {/* 左缘拉手：抽屉收起时的唯一入口 */}
      {!open && (
        <button
          type="button"
          aria-label="展开导航"
          title="展开导航"
          onClick={() => setOpen(true)}
          className="fixed top-1/2 left-0 z-50 flex h-16 w-7 -translate-y-1/2 items-center justify-center rounded-r-xl border border-l-0 border-border/70 bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <SidebarSimpleIcon className="size-4.5" />
        </button>
      )}

      {/* 遮罩：点击收起 */}
      {open && <div className="fixed inset-0 z-40 bg-black/25" onClick={() => setOpen(false)} aria-hidden />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[236px] flex-col border-r border-border/70 bg-card px-4 py-5 transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-start gap-2">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5 px-1">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCapIcon className="size-5" weight="duotone" />
            </span>
            <span>
              <span className="font-display block text-[17px] leading-tight font-normal">苍盾</span>
              <span className="block text-xs text-muted-foreground">考研政治题库</span>
            </span>
          </Link>
          <button
            type="button"
            aria-label="收起导航"
            title="收起导航"
            onClick={() => setOpen(false)}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <CaretLeftIcon className="size-4.5" />
          </button>
        </div>

        <nav className="mt-8 space-y-1">
          {item('/', '题库', HouseIcon, pathname === '/' || pathname.startsWith('/ch') || pathname.startsWith('/s'))}
          {item('/kd', '考点教材', BookOpenIcon, pathname === '/kd')}
          {item('/wrong', '错题本', XCircleIcon, pathname === '/wrong', wrong.wrong)}
        </nav>

        <div className="mt-auto space-y-1 border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {theme === 'dark' ? <SunIcon className="size-4.5" /> : <MoonIcon className="size-4.5" />}
            {theme === 'dark' ? '浅色模式' : '深色模式'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <SignOutIcon className="size-4.5" />
            退出登录
          </button>
        </div>
      </aside>
    </>
  )
}

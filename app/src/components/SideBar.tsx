import { Link, useLocation } from 'react-router-dom'
import {
  BookOpenIcon,
  GraduationCapIcon,
  HouseIcon,
  MoonIcon,
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

/** 宽屏外壳：左侧导航栏（窄屏用 TopBar，两套外壳彻底分开） */
export default function SideBar() {
  const { pathname } = useLocation()
  const { theme, setTheme } = useTheme()
  useRecordsVersion()
  const wrong = wrongStat()

  const item = (to: string, label: string, Icon: typeof HouseIcon, active: boolean, badge?: number) => (
    <Link
      key={to}
      to={to}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] transition-colors',
        active
          ? 'bg-primary font-medium text-primary-foreground'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      <Icon className="size-4.5" weight={active ? 'fill' : 'regular'} />
      {label}
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'ml-auto rounded-full px-1.5 text-[11px] tabular-nums',
            active ? 'bg-white/25 text-white' : 'bg-destructive/15 text-destructive',
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  )

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-[236px] flex-col border-r border-border/70 bg-card px-4 py-5">
      <Link to="/" className="flex items-center gap-2.5 px-1">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCapIcon className="size-5" weight="duotone" />
        </span>
        <span>
          <span className="font-display block text-[17px] leading-tight font-normal">苍盾</span>
          <span className="block text-[11px] text-muted-foreground">考研政治题库</span>
        </span>
      </Link>

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
  )
}

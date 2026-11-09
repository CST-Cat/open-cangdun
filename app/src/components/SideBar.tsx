import { Link, useLocation } from 'react-router-dom'
import {
  BookOpenIcon,
  CaretLeftIcon,
  CaretRightIcon,
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

/** 宽屏外壳：可折叠导航——展开 236（图标+文字）↔ 折叠 64（纯图标栏），状态由外壳持有并记忆（窄屏用 TopBar） */
export default function SideBar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { pathname } = useLocation()
  const { theme, setTheme } = useTheme()
  useRecordsVersion()
  const wrong = wrongStat()

  const item = (to: string, label: string, Icon: typeof HouseIcon, active: boolean, badge?: number) => (
    <Link
      key={to}
      to={to}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'flex items-center rounded-lg text-[14px] transition-colors',
        collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2',
        active
          ? 'bg-secondary font-medium text-foreground'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      <Icon className="size-4.5 shrink-0" weight={active ? 'fill' : 'regular'} />
      {!collapsed && label}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{badge}</span>
      )}
    </Link>
  )

  const footBtn =
    'flex w-full items-center rounded-lg text-[14px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground'

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/70 bg-card py-5 transition-[width,padding] duration-200',
        collapsed ? 'w-16 px-2' : 'w-[236px] px-4',
      )}
    >
      {collapsed ? (
        <div className="flex justify-center px-1">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCapIcon className="size-5" weight="duotone" />
          </span>
        </div>
      ) : (
        <Link to="/" className="flex items-center gap-2.5 px-1">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCapIcon className="size-5" weight="duotone" />
          </span>
          <span>
            <span className="font-display block text-[17px] leading-tight font-normal">苍盾</span>
            <span className="block text-xs text-muted-foreground">考研政治题库</span>
          </span>
        </Link>
      )}

      <nav className="mt-8 space-y-1">
        {item('/', '题库', HouseIcon, pathname === '/' || pathname.startsWith('/ch') || pathname.startsWith('/s'))}
        {item('/kd', '考点教材', BookOpenIcon, pathname === '/kd')}
        {item('/wrong', '错题本', XCircleIcon, pathname === '/wrong', wrong.wrong)}
      </nav>

      <div className="mt-auto space-y-1 border-t border-border/60 pt-3">
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? '展开导航' : undefined}
          aria-label={collapsed ? '展开导航' : '收起导航'}
          className={cn(footBtn, collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2')}
        >
          {collapsed ? <CaretRightIcon className="size-4.5" /> : <CaretLeftIcon className="size-4.5 shrink-0" />}
          {!collapsed && '收起导航'}
        </button>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={collapsed ? (theme === 'dark' ? '浅色模式' : '深色模式') : undefined}
          aria-label={collapsed ? (theme === 'dark' ? '浅色模式' : '深色模式') : undefined}
          className={cn(footBtn, collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2')}
        >
          {theme === 'dark' ? <SunIcon className="size-4.5 shrink-0" /> : <MoonIcon className="size-4.5 shrink-0" />}
          {!collapsed && (theme === 'dark' ? '浅色模式' : '深色模式')}
        </button>
        <button
          type="button"
          onClick={logout}
          title={collapsed ? '退出登录' : undefined}
          aria-label={collapsed ? '退出登录' : undefined}
          className={cn(footBtn, collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2')}
        >
          <SignOutIcon className="size-4.5 shrink-0" />
          {!collapsed && '退出登录'}
        </button>
      </div>
    </aside>
  )
}

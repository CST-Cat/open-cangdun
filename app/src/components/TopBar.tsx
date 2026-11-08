import { Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { BookOpenIcon, GraduationCapIcon, HouseIcon, MoonIcon, SignOutIcon, SunIcon } from '@phosphor-icons/react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="切换深色模式"
      className="size-7 text-white/70 hover:bg-white/15 hover:text-white"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  )
}

function logout() {
  void fetch('/api/logout', { method: 'POST' }).finally(() => location.assign('/'))
}

export default function TopBar() {
  const { pathname } = useLocation()

  // 路由切换回顶部
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  const item = (to: string, label: string, Icon: typeof HouseIcon) => (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] transition-colors',
        pathname === to || (to === '/' && (pathname.startsWith('/ch') || pathname.startsWith('/s')))
          ? 'bg-white/20 text-white'
          : 'text-white/65 hover:text-white',
      )}
    >
      <Icon className="size-3.5" weight={pathname === to ? 'fill' : 'regular'} />
      {label}
    </Link>
  )

  return (
    <header className="sticky top-0 z-50 bg-black">
      <div className="mx-auto flex h-11 max-w-3xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-[13px] font-semibold text-white tracking-tight">
          <GraduationCapIcon className="size-5" weight="duotone" />
          苍盾考研政治题库
        </Link>
        <nav className="flex items-center gap-0.5">
          {item('/', '题库', HouseIcon)}
          {item('/kd', '考点', BookOpenIcon)}
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="退出登录"
            title="退出登录"
            className="size-7 text-white/70 hover:bg-white/15 hover:text-white"
            onClick={logout}
          >
            <SignOutIcon className="size-4" />
          </Button>
        </nav>
      </div>
    </header>
  )
}

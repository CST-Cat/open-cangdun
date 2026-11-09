import { StrictMode, Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import TopBar from '@/components/TopBar'
import SideBar from '@/components/SideBar'
import { useIsWide } from '@/lib/use-media'
import Login from '@/pages/Login'
import './index.css'

const Home = lazy(() => import('@/pages/Home'))
const Quiz = lazy(() => import('@/pages/Quiz'))
const Kaodian = lazy(() => import('@/pages/Kaodian'))
const SectionPage = lazy(() => import('@/pages/SectionPage'))
const WrongPage = lazy(() => import('@/pages/WrongPage'))

function PageFallback() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 px-4 pt-6">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

function Splash() {
  return (
    <div className="flex min-h-[calc(100vh-44px)] flex-col items-center justify-center gap-3">
      <div className="size-10 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
      <p className="text-sm text-muted-foreground">正在验证会话…</p>
    </div>
  )
}

/** 会话门禁：未登录只渲染登录页；/data 请求 401 时自动切回登录页 */
function Shell() {
  const [state, setState] = useState<'loading' | 'authed' | 'anon'>('loading')
  const wide = useIsWide()
  // 导航折叠状态：默认折叠（纯图标栏），展开过则记住
  const [navOpen, setNavOpen] = useState(() => {
    try {
      return localStorage.getItem('cd.nav') === 'full'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('cd.nav', navOpen ? 'full' : 'icon')
    } catch {}
  }, [navOpen])

  useEffect(() => {
    fetch('/api/session', { cache: 'no-store' })
      .then((r) => setState(r.ok ? 'authed' : 'anon'))
      .catch(() => setState('anon'))
    const onUnauth = () => setState('anon')
    window.addEventListener('cd:unauth', onUnauth)
    return () => window.removeEventListener('cd:unauth', onUnauth)
  }, [])

  if (state === 'loading') return <Splash />
  if (state === 'anon') return <Login onOk={() => setState('authed')} />
  return (
    <>
      {wide ? <SideBar collapsed={!navOpen} onToggle={() => setNavOpen((v) => !v)} /> : <TopBar />}
      <div className={wide ? `${navOpen ? 'pl-[236px]' : 'pl-16'} transition-[padding] duration-200` : undefined}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/s/:key" element={<SectionPage />} />
          <Route path="/ch/:id" element={<Quiz />} />
          <Route path="/kd" element={<Kaodian />} />
          <Route path="/wrong" element={<WrongPage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
      </div>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <BrowserRouter>
        <TooltipProvider delayDuration={200}>
          <Shell />
        </TooltipProvider>
      </BrowserRouter>
      <Toaster position="top-center" />
    </ThemeProvider>
  </StrictMode>,
)

// Service Worker：离线缓存 + 二次进入零请求
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

import { useState } from 'react'
import { GraduationCapIcon, LockIcon, UserIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function Login({ onOk }: { onOk: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        onOk()
        return
      }
      const j = (await res.json().catch(() => null)) as { error?: string } | null
      setError(j?.error ?? `登录失败（${res.status}）`)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-44px)] items-center justify-center px-4">
      <Card className="w-full max-w-sm rounded-3xl shadow-none border-border/70">
        <CardContent className="px-6 py-8">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <GraduationCapIcon className="size-8" weight="duotone" />
            </div>
            <h1 className="text-[24px] font-semibold tracking-tight">苍盾考研政治题库</h1>
            <p className="text-sm text-muted-foreground">私有部署 · 请登录后使用</p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div className="relative">
              <UserIcon className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                autoComplete="username"
                autoFocus
                className="h-12 rounded-full pl-11"
              />
            </div>
            <div className="relative">
              <LockIcon className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                autoComplete="current-password"
                className="h-12 rounded-full pl-11"
              />
            </div>
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy || !username || !password} className="h-12 w-full rounded-full text-[16px]">
              {busy ? '登录中…' : '登 录'}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            首次部署的账号密码在容器日志中查看：<br />
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">docker logs cangdun</code>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}

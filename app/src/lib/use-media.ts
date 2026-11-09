import { useEffect, useState } from 'react'

/** 宽屏断点：≥1024px 走宽屏设计，其余走窄屏设计（两套布局彻底分开） */
export function useIsWide(): boolean {
  const [v, setV] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setV(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return v
}

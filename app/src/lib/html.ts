// 解析/考点 HTML 净化：白名单标签 + 图片路径绝对化 + 懒加载
import DOMPurify from 'dompurify'

DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'img' && node instanceof HTMLElement) {
    const src = node.getAttribute('src') ?? ''
    // 原站相对路径 assets/images/x.png → 本站 /data/images/x.webp（流水线已转 WebP）
    const name = src.split('/').pop() ?? ''
    if (/\.(png|jpe?g|gif|webp)$/i.test(name)) {
      node.setAttribute('src', `/data/images/${name.replace(/\.(png|jpe?g|gif)$/i, '.webp')}`)
      node.setAttribute('loading', 'lazy')
      node.setAttribute('decoding', 'async')
    } else if (src && !/^https?:/i.test(src) && !src.startsWith('/data/images/')) {
      node.removeAttribute('src') // 未知来源，避免裂图
    }
  }
})

export function cleanHTML(html: string): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'video', 'audio', 'iframe', 'script'],
    FORBID_ATTR: ['class', 'id'],
    ALLOW_DATA_ATTR: false,
  })
}

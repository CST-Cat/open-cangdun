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
  // 教材是 Word 导出 HTML：内联样式带着青底/绿框/宋体，会把原文档的排版漏进产品。
  // 净化前先把「红字重点」标记出来（其余内联样式一律剥掉，呈现交给 .prose-cd）
  const marked = html.replace(/style="([^"]*)"/gi, (m, s) =>
    /color:\s*(#ff0000|rgb\(255,\s*0,\s*0\)|red)\b/i.test(s) ? 'data-red="1"' : m,
  )
  const out = DOMPurify.sanitize(marked, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'video', 'audio', 'iframe', 'script'],
    FORBID_ATTR: ['class', 'id', 'style'],
    ADD_ATTR: ['data-red'],
    ALLOW_DATA_ATTR: false,
  })
  return out.replaceAll('data-red="1"', 'class="kd-red"')
}

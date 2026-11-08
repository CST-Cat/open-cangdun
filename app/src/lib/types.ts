// 题库数据类型（对应 optimize-data.mjs 产物）
export type Tikus = string[]

export type ChapterMeta = { id: string; n: string; c: number }
export type Catalog = Record<string, ChapterMeta[]>

export type Question = {
  i: string // timu_id
  t: '单选' | '多选'
  q: string // 题干（纯文本）
  o: Record<string, string> // 选项 A-D
  a: string // 答案，如 "C" / "ABD"
  j: string // 解析 HTML
  k: string // 考点文本（可能为空）
  kid: string // 考点 id（可能为空）
  r: number // 全站做对人数
  tot: number // 全站做题人数（可为 0）
}
export type Chapter = { n: string; qs: Question[] }

export type KaodianIndexItem = { i: string; t: string }
export type Kaodian = { t: string; h: string }

// 原版四大分区（sections.json）
export type Book = { name: string; tiku: string; subject?: string }
export type SectionEntry =
  | Book
  | { name: string; multi: Book[] }
  | { name: string; href: string }
export type Sections = {
  qianghua: Book[]
  chongci: { group: string; books: Book[] }[]
  jingxuan: SectionEntry[]
  zhuanti: SectionEntry[]
}

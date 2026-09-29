// 字体目录：只描述"有哪些字体、各自的备用链是什么"，不负责检测或渲染。

export type FontRole = 'heading' | 'body';

export interface FontSpec {
  family: string;
  /** true 表示需要从 Google Fonts 拉取，离线时会失败 */
  web: boolean;
  /** 建议的备用链，从同风格字体一路退化到通用族，保证不会掉成"意外"衬线 */
  fallback: string[];
}

// 通用兜底族永远可用，追加在每条链的末端。
export const GENERIC_SERIF = 'Georgia, serif';
export const GENERIC_SANS = 'system-ui, sans-serif';

export const FONT_CATALOG: FontSpec[] = [
  {
    family: 'Fraunces',
    web: true,
    fallback: ['Playfair Display', 'Georgia', 'serif'],
  },
  {
    family: 'Newsreader',
    web: true,
    fallback: ['Georgia', 'serif'],
  },
  {
    family: 'Playfair Display',
    web: true,
    fallback: ['Georgia', 'serif'],
  },
  {
    family: 'DM Sans',
    web: true,
    fallback: ['IBM Plex Sans', 'Arial', 'sans-serif'],
  },
  {
    family: 'Space Grotesk',
    web: true,
    fallback: ['Arial', 'sans-serif'],
  },
  {
    family: 'IBM Plex Sans',
    web: true,
    fallback: ['Arial', 'sans-serif'],
  },
  {
    family: 'Georgia',
    web: false,
    fallback: ['serif'],
  },
  {
    family: 'Arial',
    web: false,
    fallback: ['sans-serif'],
  },
];

export const CATALOG_BY_FAMILY = new Map(FONT_CATALOG.map((f) => [f.family, f]));

export const HEADING_FONTS = FONT_CATALOG.filter((f) => f.family !== 'Arial');
export const BODY_FONTS = FONT_CATALOG.filter((f) => f.family !== 'Georgia');

export function specOf(family: string): FontSpec | undefined {
  return CATALOG_BY_FAMILY.get(family);
}

export function isWebFont(family: string): boolean {
  return CATALOG_BY_FAMILY.get(family)?.web ?? false;
}

/**
 * 某字体的完整备用链：目录里登记的链 + 该字体应归属的通用族。
 * 旧记录缺少备用链时用它补齐默认值，不改动原选择。
 */
export function defaultFallbackChain(
  family: string,
  role?: 'heading' | 'body',
): string[] {
  const spec = CATALOG_BY_FAMILY.get(family);
  const chain = spec ? [...spec.fallback] : [];
  const serif = spec ? spec.fallback.some((f) => f.includes('serif') || f === 'Georgia')
    : looksSerif(family) || role === 'heading';
  const generic = serif ? GENERIC_SERIF : GENERIC_SANS;
  chain.push(...generic.split(', ').map((s) => s.trim()));
  return Array.from(new Set(chain));
}

const SERIF_HINTS = /serif|fraunc|newsreader|playfair|georgia|cormorant|libre|eb/i;
export function looksSerif(family: string): boolean {
  return SERIF_HINTS.test(family);
}

/** 把 ["a b", "serif"] 拼成 CSS font-family 片段 */
export function quoteStack(stack: string[]): string {
  const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);
  return stack
    .filter(Boolean)
    .map((f) => (GENERIC.has(f) || f.includes(',') ? f : `'${f}'`))
    .join(', ');
}

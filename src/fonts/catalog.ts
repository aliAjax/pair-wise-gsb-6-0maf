// 字体目录：可选字体、每个字体的备用链，以及加载它们的 <link> 信息。
// 这是“默认值”的唯一来源；旧记录缺少备用链时用这里补齐，
// 但不会改动记录里用户原来选定的字体名。

import type { FontChoice } from './types';

export interface FontSpec {
  name: string;
  /** 字体气质标签，仅用于界面展示 */
  tone: string;
  /**
   * 默认备用链：先给风格接近的 web 字体，
   * 再落到系统字体，最后是通用族。
   */
  fallbacks: string[];
  /** Google Fonts 里对应的 family 片段；系统字体为 null */
  web: string | null;
}

// 通用族收尾，保证断网时标题/正文仍各有合理的兜底，
// 而不是都掉成浏览器默认衬线。
const SERIF_TAIL = ['Georgia', 'Songti SC', 'SimSun', 'serif'];
const SANS_TAIL = ['Helvetica Neue', 'Arial', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'];

export const CATALOG: FontSpec[] = [
  { name: 'Fraunces', tone: '衬线 · 表现力', fallbacks: ['Playfair Display', 'Newsreader', ...SERIF_TAIL], web: 'Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700' },
  { name: 'Playfair Display', tone: '衬线 · 高对比', fallbacks: ['Fraunces', ...SERIF_TAIL], web: 'Playfair+Display:wght@400;500;600;700' },
  { name: 'Newsreader', tone: '衬线 · 长文', fallbacks: ['Georgia', ...SERIF_TAIL], web: 'Newsreader:opsz,wght@6..72,400;6..72,500' },
  { name: 'DM Sans', tone: '无衬线 · 中性', fallbacks: ['IBM Plex Sans', 'Space Grotesk', ...SANS_TAIL], web: 'DM+Sans:wght@400;500;600;700' },
  { name: 'Space Grotesk', tone: '无衬线 · 技术感', fallbacks: ['DM Sans', ...SANS_TAIL], web: 'Space+Grotesk:wght@400;500;600' },
  { name: 'IBM Plex Sans', tone: '无衬线 · 工程感', fallbacks: ['DM Sans', ...SANS_TAIL], web: 'IBM+Plex+Sans:wght@400;500;600' },
  // 系统字体永远可用，现场断网时作为备用链上的可靠落点
  { name: 'Georgia', tone: '系统衬线', fallbacks: ['Times New Roman', 'serif'], web: null },
  { name: 'Helvetica Neue', tone: '系统无衬线', fallbacks: ['Arial', 'sans-serif'], web: null },
];

const BY_NAME = new Map(CATALOG.map((f) => [f.name, f]));

export function specOf(name: string): FontSpec | undefined {
  return BY_NAME.get(name);
}

export function isWebFont(name: string): boolean {
  return BY_NAME.get(name)?.web != null;
}

/** 目录字体的默认选择（选字体时用），自带该字体的默认备用链 */
export function defaultChoice(name: string): FontChoice {
  const spec = BY_NAME.get(name);
  return { font: name, fallbacks: spec ? [...spec.fallbacks] : ['sans-serif'] };
}

/**
 * 为旧记录补齐备用链：
 * - 已在目录中的字体，用目录默认链；
 * - 未知字体（如手动改过的数据），保守地给通用族兜底；
 * - 记录原本就带的备用链原样保留，不覆盖。
 */
export function ensureChoice(raw: Partial<FontChoice> | undefined, fallbackName: string): FontChoice {
  const font = (raw?.font || fallbackName).trim();
  if (raw && Array.isArray(raw.fallbacks) && raw.fallbacks.length > 0) {
    return { font, fallbacks: raw.fallbacks.map((f) => String(f)) };
  }
  return defaultChoice(font);
}

/** 拼出 Google Fonts 的样式表地址，供环境检测模块决定加载谁 */
export function webFontsHref(names: readonly string[]): string {
  const families = names
    .map((n) => BY_NAME.get(n)?.web)
    .filter((f): f is string => !!f)
    // 去重，同一字体只加载一次
    .filter((f, i, all) => all.indexOf(f) === i);
  return `https://fonts.googleapis.com/css2?family=${families.join('&family=')}&display=swap`;
}

/** 去重后的全部 web 字体名（目录内） */
export const WEB_FONT_NAMES = CATALOG.filter((f) => f.web).map((f) => f.name);

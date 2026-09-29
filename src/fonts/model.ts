// 配对的持久化数据模型与旧记录迁移。
// 这一层只负责"保存什么、旧数据怎么补齐"，不依赖 DOM、React 或网络状态。

import { defaultFallbackChain, looksSerif } from './catalog';

export interface FontChoice {
  /** 用户真正选定的字体名，任何情况下都不被覆盖 */
  family: string;
  /** 随选择一起保存的备用字体链 */
  fallback: string[];
}

export interface Pair {
  id: number;
  title: string;
  heading: string;
  body: string;
  category: string;
  favorite: boolean;
  /** 标题字体选择 + 备用链 */
  headingFont: FontChoice;
  /** 正文字体选择 + 备用链 */
  bodyFont: FontChoice;
  /** 画布微调参数，随配对一起保存 */
  tuning: PairTuning;
}

/** 画布微调参数，同样随配对一起保存 */
export interface PairTuning {
  size: number;
  weight: number;
  leading: number;
  tracking: number;
}

export const DEFAULT_TUNING: PairTuning = {
  size: 46,
  weight: 600,
  leading: 1.25,
  tracking: 0,
};

export interface FontSnapshot {
  requested: string;
  effective: string;
  fallback: boolean;
  cause?: 'offline' | 'load-failed';
  stack: string[];
}

export interface StoredSettings {
  pairs: Pair[];
  selectedId: number | null;
  /** 上次打开时正在使用的字体环境，重开后可解释"上次为什么长这样" */
  lastEnvironment: EnvironmentSnapshot | null;
}

export interface EnvironmentSnapshot {
  online: boolean;
  /** 当时每对配对实际渲染使用的字体（解析后的结果） */
  resolved: Record<number, { heading: FontSnapshot; body: FontSnapshot }>;
  at: string;
}

// 兼容三种历史形态：
//  1) 最初版本：headingFont/bodyFont 直接是字体名字符串，无备用链
//  2) 现行结构：{ family, fallback }，但 fallback 可能缺失
//  3) tuning / lastEnvironment 等后续字段可能整段缺失
type RawFont = string | FontChoice | undefined;
interface RawPair {
  id?: number;
  title?: string;
  heading?: string;
  body?: string;
  category?: string;
  favorite?: boolean;
  headingFont?: RawFont;
  bodyFont?: RawFont;
  tuning?: Partial<PairTuning>;
}

function makeChoice(family: string, role: 'heading' | 'body'): FontChoice {
  return { family, fallback: defaultFallbackChain(family, role) };
}

function familyOf(raw: RawFont): string | undefined {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.family === 'string') return raw.family;
  return undefined;
}

/**
 * 迁移任意时代的配对记录：
 * 缺少备用链时按目录补齐默认值；用户原本选的字体名原样保留，绝不改写成兜底字体。
 */
export function normalizePair(raw: RawPair, index: number): Pair {
  const headingFamily =
    familyOf(raw.headingFont) ?? (index === 0 ? 'Fraunces' : 'Georgia');
  const bodyFamily = familyOf(raw.bodyFont) ?? (index === 0 ? 'DM Sans' : 'Arial');

  const givenHeadingFallback =
    raw.headingFont && typeof raw.headingFont === 'object'
      ? raw.headingFont.fallback
      : undefined;
  const givenBodyFallback =
    raw.bodyFont && typeof raw.bodyFont === 'object'
      ? raw.bodyFont.fallback
      : undefined;

  const t = raw.tuning ?? {};
  return {
    id: raw.id ?? Date.now() + index,
    title: raw.title ?? 'Untitled pairing',
    heading: raw.heading ?? 'Your new headline',
    body:
      raw.body ??
      'Start with a sentence that lets your type pairing show its character.',
    category: raw.category ?? 'Untitled',
    favorite: raw.favorite ?? false,
    headingFont: {
      family: headingFamily,
      fallback:
        Array.isArray(givenHeadingFallback) && givenHeadingFallback.length > 0
          ? givenHeadingFallback
          : defaultFallbackChain(headingFamily, 'heading'),
    },
    bodyFont: {
      family: bodyFamily,
      fallback:
        Array.isArray(givenBodyFallback) && givenBodyFallback.length > 0
          ? givenBodyFallback
          : defaultFallbackChain(bodyFamily, 'body'),
    },
    tuning: {
      size: typeof t.size === 'number' ? t.size : DEFAULT_TUNING.size,
      weight: typeof t.weight === 'number' ? t.weight : DEFAULT_TUNING.weight,
      leading: typeof t.leading === 'number' ? t.leading : DEFAULT_TUNING.leading,
      tracking: typeof t.tracking === 'number' ? t.tracking : DEFAULT_TUNING.tracking,
    },
  };
}

/** 旧接口别名，供仅需基础迁移的调用方使用 */
export function migratePair(raw: RawPair, index: number): Pair {
  return normalizePair(raw, index);
}

export function migrateSettings(raw: unknown): StoredSettings {
  // 形如 { pairs, selectedId, lastEnvironment } 的现行结构
  if (raw && typeof raw === 'object' && 'pairs' in raw) {
    const obj = raw as Partial<StoredSettings> & { pairs: unknown };
    const pairs = Array.isArray(obj.pairs)
      ? obj.pairs.map((p, i) => normalizePair((p ?? {}) as RawPair, i))
      : [];
    return {
      pairs,
      selectedId:
        typeof obj.selectedId === 'number' && pairs.some((p) => p.id === obj.selectedId)
          ? obj.selectedId
          : (pairs[0]?.id ?? null),
      lastEnvironment: isEnvironmentSnapshot(obj.lastEnvironment)
        ? obj.lastEnvironment
        : null,
    };
  }
  // 最初版本：localStorage 直接存 Pair[]
  if (Array.isArray(raw)) {
    const pairs = (raw as unknown[]).map((p, i) => normalizePair((p ?? {}) as RawPair, i));
    return { pairs, selectedId: pairs[0]?.id ?? null, lastEnvironment: null };
  }
  return { pairs: [], selectedId: null, lastEnvironment: null };
}

function isEnvironmentSnapshot(v: unknown): v is EnvironmentSnapshot {
  return (
    !!v &&
    typeof v === 'object' &&
    'online' in v &&
    'resolved' in v &&
    'at' in v
  );
}

/** 新建配对时的默认选择 */
export function newFontChoice(family: string, role: 'heading' | 'body'): FontChoice {
  return makeChoice(family, role);
}

export function genericFor(family: string): string {
  return looksSerif(family) ? 'serif' : 'sans-serif';
}

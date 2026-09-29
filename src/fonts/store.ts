// 保存层：只负责把“配置”和“会话记录”读出来、写回去。
// 配置（字体选择 + 备用链）与会话记录（上次实际用了什么、为什么）分开存：
// 解析结果永远不回写成新配置，网络恢复后原选择原封不动。

import { ensureChoice } from './catalog';
import type {
  FontChoice,
  FontEnv,
  Pair,
  PairSession,
  RoleSession,
  StoreData,
} from './types';
import { resolvePair } from './resolve';

const KEY = 'type-pairs-v2';
const LEGACY_KEY = 'type-pairs';
const SESSION_KEY = 'type-pair-sessions-v1';

export const STORAGE_VERSION = 2 as const;

const DEFAULTS = {
  size: 46,
  weight: 600,
  leading: 1.25,
  tracking: 0,
};

function seedPairs(): Pair[] {
  // 种子数据也走 FontChoice：标题衬线、正文无衬线，各自带备用链
  return [
    {
      id: 1,
      title: 'Editorial calm',
      heading: 'A slower way to see',
      body: 'Good typography creates space for ideas to breathe. Pair a confident display face with a quiet, generous text face.',
      category: 'Editorial',
      favorite: true,
      headingChoice: ensureChoice({ font: 'Fraunces', fallbacks: [] }, 'Fraunces'),
      bodyChoice: ensureChoice({ font: 'DM Sans', fallbacks: [] }, 'DM Sans'),
      ...DEFAULTS,
    },
    {
      id: 2,
      title: 'Studio notes',
      heading: 'Make room for the unexpected',
      body: 'A thoughtful pairing can add rhythm to even the simplest interface. Try contrast in shape, not just size.',
      category: 'Portfolio',
      favorite: false,
      headingChoice: ensureChoice({ font: 'Space Grotesk', fallbacks: [] }, 'Space Grotesk'),
      bodyChoice: ensureChoice({ font: 'Newsreader', fallbacks: [] }, 'Newsreader'),
      ...DEFAULTS,
      size: 42,
    },
    {
      id: 3,
      title: 'Field guide',
      heading: 'Small details, lasting impressions',
      body: 'Typography is the voice of a page. Find a combination that feels clear, warm and distinctly yours.',
      category: 'Brand',
      favorite: false,
      headingChoice: ensureChoice({ font: 'Playfair Display', fallbacks: [] }, 'Playfair Display'),
      bodyChoice: ensureChoice({ font: 'IBM Plex Sans', fallbacks: [] }, 'IBM Plex Sans'),
      ...DEFAULTS,
    },
  ];
}

/** 迁移旧版本记录：只补默认备用链与缺省排版值，字体原选择保持不变 */
function migratePair(raw: any): Pair {
  const headingFont: string = raw?.headingFont ?? raw?.headingChoice?.font ?? 'Fraunces';
  const bodyFont: string = raw?.bodyFont ?? raw?.bodyChoice?.font ?? 'DM Sans';
  const headingChoice: FontChoice = ensureChoice(raw?.headingChoice ?? { font: headingFont }, headingFont);
  const bodyChoice: FontChoice = ensureChoice(raw?.bodyChoice ?? { font: bodyFont }, bodyFont);
  return {
    id: Number(raw?.id) || Date.now(),
    title: String(raw?.title ?? 'Untitled'),
    heading: String(raw?.heading ?? 'Your headline'),
    body: String(raw?.body ?? ''),
    category: String(raw?.category ?? 'Untitled'),
    favorite: Boolean(raw?.favorite),
    headingChoice,
    bodyChoice,
    size: num(raw?.size, DEFAULTS.size),
    weight: num(raw?.weight, DEFAULTS.weight),
    leading: num(raw?.leading, DEFAULTS.leading),
    tracking: num(raw?.tracking, DEFAULTS.tracking),
  };
}

function num(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/**
 * 读取配置。顺序：v2 → 旧版 type-pairs（迁移，备用链补默认值）→ 种子。
 * 迁移结果只返回给调用方；是否落盘由调用方决定（通常首次保存时再写）。
 */
export function loadStore(): { data: StoreData; migrated: boolean } {
  try {
    const rawV2 = localStorage.getItem(KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (parsed && Array.isArray(parsed.pairs)) {
        const pairs = parsed.pairs.map((p: unknown) => migratePair(p));
        return {
          data: {
            version: STORAGE_VERSION,
            pairs,
            selectedId: typeof parsed.selectedId === 'number' ? parsed.selectedId : pairs[0]?.id ?? null,
          },
          migrated: false,
        };
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const oldPairs = JSON.parse(legacy);
      if (Array.isArray(oldPairs) && oldPairs.length > 0) {
        const pairs = oldPairs.map((p: unknown) => migratePair(p));
        return {
          data: { version: STORAGE_VERSION, pairs, selectedId: pairs[0]?.id ?? null },
          migrated: true,
        };
      }
    }
  } catch {
    // 数据损坏时回退到种子，不把坏数据写回去
  }
  const pairs = seedPairs();
  return {
    data: { version: STORAGE_VERSION, pairs, selectedId: pairs[0].id },
    migrated: false,
  };
}

type SessionsMap = Record<string, PairSession>;

function sanitizeSessions(raw: unknown): SessionsMap {
  if (!raw || typeof raw !== 'object') return {};
  const out: SessionsMap = {};
  for (const [id, sess] of Object.entries(raw as Record<string, unknown>)) {
    const s = sess as PairSession | undefined;
    if (s?.roles?.heading && s?.roles?.body) out[id] = s;
  }
  return out;
}

/** 保存配置。注意：只存字体选择与备用链，不接收任何“当前渲染结果”。 */
export function savePairs(pairs: Pair[], selectedId: number | null): void {
  const data: StoreData = {
    version: STORAGE_VERSION,
    pairs,
    selectedId,
  };
  localStorage.setItem(KEY, JSON.stringify(data));
}

/** 会话记录单独读写，重开后可查看上次使用的字体与原因 */
export function loadSessions(): SessionsMap {
  try {
    return sanitizeSessions(JSON.parse(localStorage.getItem(SESSION_KEY) || '{}'));
  } catch {
    return {};
  }
}

export function saveSession(pairId: number, env: FontEnv, pair: { headingChoice: FontChoice; bodyChoice: FontChoice }): PairSession {
  const { heading, body } = resolvePair(pair, env);
  const at = new Date().toISOString();
  const toRole = (r: typeof heading): RoleSession => ({
    role: r.role,
    chosen: r.chosen,
    active: r.active,
    code: r.code,
    reason: r.reason,
    at,
  });
  const session: PairSession = { roles: { heading: toRole(heading), body: toRole(body) } };
  const all = loadSessions();
  all[String(pairId)] = session;
  localStorage.setItem(SESSION_KEY, JSON.stringify(all));
  return session;
}

/** 新建配对时生成带默认备用链的记录 */
export function createPair(title: string): Pair {
  return {
    id: Date.now(),
    title: title.trim(),
    heading: 'Your new headline',
    body: 'Start with a sentence that lets your type pairing show its character.',
    category: 'Untitled',
    favorite: false,
    headingChoice: ensureChoice({ font: 'Fraunces', fallbacks: [] }, 'Fraunces'),
    bodyChoice: ensureChoice({ font: 'DM Sans', fallbacks: [] }, 'DM Sans'),
    ...DEFAULTS,
  };
}

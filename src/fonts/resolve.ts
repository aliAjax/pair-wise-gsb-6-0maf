// 纯解析层：给定一套字体配置 + 当前环境，得出“此刻实际会显示什么”。
// 不读 localStorage、不碰 DOM、不写状态，
// 列表、画布、导出三处都调用同一个函数，保证指向同一份结果。

import type { FontChoice, FontEnv, ResolvedRole } from './types';
import { isWebFont } from './catalog';

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif']);

/** 去掉链中重复项（选定字体与备用链可能写重），保持顺序 */
function uniq(names: string[]): string[] {
  return names.filter((n, i) => names.indexOf(n) === i);
}

/** 字体名在当前环境是否真的能显示；通用族关键字永远可用 */
export function canShow(name: string, env: FontEnv): boolean {
  const n = name.trim();
  if (!n) return false;
  if (GENERIC.has(n.toLowerCase())) return true;
  // 现场离线模式只屏蔽 web 字体；系统字体保留
  if (env.simulatedOffline && isWebFont(n)) return false;
  return env.available.has(n);
}

function envContext(env: FontEnv): string {
  if (env.simulatedOffline) return '现场离线演示';
  if (!env.online) return '网络已断开且字体未在本机缓存';
  return '字体加载失败';
}

export function resolveRole(
  role: 'heading' | 'body',
  choice: FontChoice,
  env: FontEnv,
): ResolvedRole {
  const chain = uniq([choice.font, ...choice.fallbacks].map((s) => s.trim()).filter(Boolean));
  const activeIndex = chain.findIndex((n) => canShow(n, env));

  if (activeIndex === 0) {
    return {
      role,
      chosen: choice.font,
      chain,
      active: chain[0],
      activeIndex: 0,
      code: 'ok',
      reason: `使用选定字体「${choice.font}」`,
    };
  }

  if (activeIndex > 0) {
    const active = chain[activeIndex];
    return {
      role,
      chosen: choice.font,
      chain,
      active,
      activeIndex,
      code: 'fallback',
      reason: `「${choice.font}」因${envContext(env)}不可用，已按备用链改用「${active}」；网络恢复后自动回到「${choice.font}」`,
    };
  }

  // 链上没有任何一项可用（异常或离线过深），交给通用族兜底，配置不动
  return {
    role,
    chosen: choice.font,
    chain,
    active: role === 'heading' ? 'serif' : 'sans-serif',
    activeIndex: -1,
    code: 'unavailable',
    reason: `选定字体「${choice.font}」与整条备用链在当前环境均不可用（${envContext(env)}），暂用浏览器默认字体；配置未被修改`,
  };
}

export function resolvePair(pair: { headingChoice: FontChoice; bodyChoice: FontChoice }, env: FontEnv) {
  return {
    heading: resolveRole('heading', pair.headingChoice, env),
    body: resolveRole('body', pair.bodyChoice, env),
  };
}

/** 渲染 / 导出共用的 CSS font-family 值：完整链，浏览器按序取第一个可用项 */
export function cssFamily(r: ResolvedRole): string {
  const chain = r.activeIndex >= 0 ? r.chain : [...r.chain, r.active];
  return chain
    .map((n) => (GENERIC.has(n.toLowerCase()) ? n : `'${n.replace(/'/g, "\\'")}'`))
    .join(', ');
}

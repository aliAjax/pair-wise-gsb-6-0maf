// 解析层：给定"用户选择 + 备用链"和"当前环境里真实可用的字体"，
// 算出实际渲染的字体栈与原因。纯函数 + 环境检测，不依赖 React、不写存储。
//
// 关键约束：解析结果是临时的，永远只在内存里使用，
// 用户的原选择 (family) 不会被备用字体覆盖，网络恢复后重新解析即自动回到原选择。

import { isWebFont, quoteStack } from './catalog';
import type { FontChoice } from './model';

export type FontAvailability = 'available' | 'unavailable' | 'pending';

export type FontStatus = ReadonlyMap<string, FontAvailability>;

export type ResolveReason =
  | { kind: 'selected' }
  | {
      kind: 'fallback';
      /** 真正在渲染的字体（备用链中第一个可用的） */
      effective: string;
      /** 没能加载出来的原选择 */
      requested: string;
      cause: 'offline' | 'load-failed';
    };

export interface ResolvedFont {
  choice: FontChoice;
  /** 实际生效的字体族名 */
  effectiveFamily: string;
  /** 交给 CSS font-family 使用的完整栈（原选择在前，备用链在后） */
  stack: string[];
  css: string;
  reason: ResolveReason;
}

export interface ResolveContext {
  online: boolean;
  status: FontStatus;
}

export function resolveFont(choice: FontChoice, ctx: ResolveContext): ResolvedFont {
  const stack = [choice.family, ...choice.fallback];
  const availability = ctx.status.get(choice.family);
  // 本机字体、已确认可用、或在线时检测尚未完成（CSS 栈本身会接管加载）→ 按原选择渲染
  if (
    !isWebFont(choice.family) ||
    availability === 'available' ||
    (availability === 'pending' && ctx.online)
  ) {
    return {
      choice,
      effectiveFamily: choice.family,
      stack,
      css: quoteStack(stack),
      reason: { kind: 'selected' },
    };
  }

  // 原选择暂不可用（离线且未缓存，或在线加载失败）：
  // 沿保存下来的备用链找第一个真实可用的字体
  const fallback =
    choice.fallback.find(
      (f) => !isWebFont(f) || ctx.status.get(f) === 'available' ||
        (ctx.status.get(f) === 'pending' && ctx.online),
    ) ?? choice.fallback[choice.fallback.length - 1] ??
    (choice.family.toLocaleLowerCase().includes('serif') ? 'serif' : 'sans-serif');

  const cause: 'offline' | 'load-failed' = !ctx.online ? 'offline' : 'load-failed';

  return {
    choice,
    effectiveFamily: fallback,
    stack,
    css: quoteStack(stack),
    reason: { kind: 'fallback', effective: fallback, requested: choice.family, cause },
  };
}

export function describeReason(reason: ResolveReason): string {
  if (reason.kind === 'selected') return '使用选定字体';
  const cause = reason.cause === 'offline' ? '网络离线、字体未缓存' : '字体加载失败';
  return `${cause}，临时以 ${reason.effective} 渲染；恢复网络后自动回到 ${reason.requested}`;
}

// ---------------------------------------------------------------------------
// 环境检测：navigator.onLine + document.fonts，退化为尺寸测量。
// ---------------------------------------------------------------------------

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

let measureCanvas: HTMLCanvasElement | null = null;

function measureAvailable(family: string): boolean {
  // 尺寸对比法：用待测字体与基线 monospace 渲染，宽度/高度不同说明字体存在。
  const baseline = 'monospace';
  const text = 'mmmmmmmmmmlliMW@#%_0123456789';
  const size = 72;
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const context = measureCanvas.getContext('2d');
  if (!context) return false;
  const measure = (font: string) => {
    context.font = `${size}px ${font}`;
    const m = context.measureText(text);
    return m.width + (m.actualBoundingBoxAscent ?? 0) + (m.actualBoundingBoxDescent ?? 0);
  };
  const base = measure(baseline);
  const tested = measure(`'${family}', ${baseline}`);
  return tested !== base;
}

/**
 * 检测一组字体在当前环境是否真实可用。
 * 已缓存的 web 字体在离线时仍会报 available —— 这正是"离线演示"想要的结果。
 */
export async function detectAvailability(families: readonly string[]): Promise<FontStatus> {
  const result = new Map<string, FontAvailability>();
  const fontsAPI = typeof document !== 'undefined' ? document.fonts : undefined;

  await Promise.all(
    families.map(async (family) => {
      if (!isWebFont(family)) {
        result.set(family, 'available');
        return;
      }
      try {
        if (fontsAPI) {
          // 不指定 URL：已加载/已缓存的字体会立即通过，缺失的尝试按 @font-face 拉取
          await fontsAPI.load(`16px "${family}"`);
          result.set(family, fontsAPI.check(`16px "${family}"`) ? 'available' : 'unavailable');
        } else {
          result.set(family, measureAvailable(family) ? 'available' : 'unavailable');
        }
      } catch {
        result.set(family, 'unavailable');
      }
    }),
  );
  return result;
}

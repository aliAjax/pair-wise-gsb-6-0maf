// 环境层（页面侧）：回答“此刻这台机器上哪些字体真的能显示”。
// - online/offline 事件 + web 字体动态加载与 document.fonts 检测；
// - 系统字体用 canvas 度量探测；
// - “现场模拟离线”只活在本次会话里，绝不进入持久化配置。

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WEB_FONT_NAMES, webFontsHref } from './catalog';
import type { FontEnv } from './types';

const LINK_ID = 'type-pairer-webfonts';
const SIM_KEY = 'type-pairer-simulated-offline';
const LOAD_TIMEOUT = 4000;

// 通用族永远“可用”
const GENERIC = new Set(['serif', 'sans-serif', 'monospace']);

// 备用链里引用到的系统字体，加上各平台常见项
const SYSTEM_CANDIDATES = [
  'Arial', 'Helvetica Neue', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS',
  'Segoe UI', 'Impact', 'Comic Sans MS', 'Courier New', 'Lucida Grande',
  'Georgia', 'Times New Roman',
  'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC',
  'Songti SC', 'SimSun', 'Noto Serif CJK SC',
];

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('font-load-timeout')), ms)),
  ]);
}

/** canvas 度量法：候选字体的宽度与 monospace 基线不同，说明系统里真有这个字体 */
function detectSystemFonts(): Set<string> {
  const found = new Set<string>(GENERIC);
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return found;
    const sample = 'mmmmmmmmmmlli';
    const size = 72;
    const combos: Array<[string, string]> = [
      ['normal', '400'], ['normal', '700'], ['italic', '400'],
    ];
    ctx.font = `400 ${size}px monospace`;
    const baseline = new Map(combos.map(([style, weight]) => {
      ctx.font = `${style} ${weight} ${size}px monospace`;
      return [`${style}-${weight}`, ctx.measureText(sample).width] as const;
    }));
    for (const name of SYSTEM_CANDIDATES) {
      for (const [style, weight] of combos) {
        ctx.font = `${style} ${weight} ${size}px '${name.replace(/'/g, '')}',monospace`;
        if (ctx.measureText(sample).width !== baseline.get(`${style}-${weight}`)) {
          found.add(name);
          break;
        }
      }
    }
  } catch {
    // 探测失败时至少保留通用族
  }
  return found;
}

/** 确保 web 字体样式表存在；网络恢复后用“换新节点”的方式强制浏览器重新拉取 */
function ensureFontLink(forceReload: boolean): void {
  const href = webFontsHref(WEB_FONT_NAMES);
  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (link && (!forceReload || link.href === href)) {
    if (!forceReload) return;
    link.remove();
    link = null;
  }
  if (!link) {
    link = document.createElement('link');
    link.id = LINK_ID;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

/** 逐个检查 web 字体是否已在本机可用（在线加载成功或本就有缓存） */
async function detectWebFonts(): Promise<Set<string>> {
  const available = new Set<string>();
  if (!('fonts' in document)) return available;
  for (const name of WEB_FONT_NAMES) {
    try {
      await withTimeout(document.fonts.load(`400 16px '${name}'`), LOAD_TIMEOUT);
      if (document.fonts.check(`16px '${name}'`)) available.add(name);
    } catch {
      // 加载超时/失败 = 当前环境不可用，保持不加入集合
    }
  }
  return available;
}

export interface FontEnvApi {
  env: FontEnv;
  /** 现场切换：模拟离线（仅本会话，不保存） */
  simulatedOffline: boolean;
  toggleSimulatedOffline: () => void;
  recheck: () => Promise<void>;
  checking: boolean;
}

export function useFontEnv(): FontEnvApi {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine ?? true,
  );
  const [systemFonts] = useState<Set<string>>(() =>
    typeof document === 'undefined' ? new Set(GENERIC) : detectSystemFonts(),
  );
  const [webFonts, setWebFonts] = useState<Set<string>>(() => new Set());
  const [simulated, setSimulated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SIM_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [checking, setChecking] = useState(false);

  const recheck = useCallback(async () => {
    setChecking(true);
    const web = await detectWebFonts();
    setWebFonts(web);
    setChecking(false);
  }, []);

  // 初次进入：注入样式表，等字体就绪后检测（断网时超时即返回空集合）
  useEffect(() => {
    ensureFontLink(false);
    let cancelled = false;
    const run = async () => {
      setChecking(true);
      const web = await detectWebFonts();
      if (!cancelled) {
        setWebFonts(web);
        setChecking(false);
      }
    };
    run();
    if ('fonts' in document) {
      // 字体在后台陆续加载完成时补一次检测
      document.fonts.addEventListener?.('loadingdone', () => {
        void run();
      });
    }
    const onOnline = () => {
      setOnline(true);
      // 网络恢复：强制重新拉取样式表，然后重新检测
      ensureFontLink(true);
      void run();
    };
    const onOffline = () => {
      setOnline(false);
      // 已缓存的 web 字体仍在集合里；解析层凭可用性集合决定，而不是只看 online
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const toggleSimulatedOffline = useCallback(() => {
    setSimulated((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(SIM_KEY, next ? '1' : '0');
      } catch {
        // 会话存储不可用时仅保留内存状态
      }
      return next;
    });
  }, []);

  const env = useMemo<FontEnv>(() => {
    const available = new Set<string>([...systemFonts, ...webFonts]);
    return { online, available, simulatedOffline: simulated };
  }, [online, systemFonts, webFonts, simulated]);

  return { env, simulatedOffline: simulated, toggleSimulatedOffline, recheck, checking };
}

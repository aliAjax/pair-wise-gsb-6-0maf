// 页面层：Google Fonts 样式表的注入与重试。
// 用 <link> 动态注入（而不是 CSS @import），离线失败后网络恢复时可以重新触发加载；
// 已缓存的字体离线仍然可用，document.fonts 检测会如实验证。

import { FONT_CATALOG } from './catalog';

const LINK_ID = 'type-pairer-google-fonts';

function googleFontsURL(): string {
  const families = FONT_CATALOG.filter((f) => f.web).map((f) => f.family.replace(/ /g, '+'));
  return `https://fonts.googleapis.com/css2?${families
    .map((f) => `family=${f}:wght@400;500;600;700`)
    .join('&')}&display=swap`;
}

export function ensureWebFontsLoaded(): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (existing) {
    // 强制重试：浏览器在重新联网后会重新拉取失败的样式表
    existing.href = googleFontsURL();
    return;
  }
  const link = document.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = googleFontsURL();
  document.head.appendChild(link);
}

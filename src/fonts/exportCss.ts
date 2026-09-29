// 导出层（页面侧）：CSS 导出。
// 与画布、列表共用解析结果（由调用方传入 resolved），
// 绝不自己另算一遍，保证三处指向同一份结果。

import { cssFamily } from './resolve';
import type { FontEnv, Pair, ResolvedRole } from './types';

export function buildCss(
  pair: Pair,
  resolved: { heading: ResolvedRole; body: ResolvedRole },
  env: FontEnv,
): string {
  const envText = env.simulatedOffline
    ? '现场模拟离线'
    : env.online
      ? '在线'
      : '离线（仅本机已缓存字体可用）';
  const lines = [
    `/* Type Pairer 导出 — ${pair.title} (pairing ${pair.id})`,
    ` * 导出时环境：${envText}`,
    ` *`,
    ` * 标题选定字体：${resolved.heading.chosen}`,
    ` * 标题当前渲染：${resolved.heading.active}（${resolved.heading.code === 'ok' ? '原选择' : '备用链'}）`,
    ` *   ${resolved.heading.reason}`,
    ` * 正文选定字体：${resolved.body.chosen}`,
    ` * 正文当前渲染：${resolved.body.active}（${resolved.body.code === 'ok' ? '原选择' : '备用链'}）`,
    ` *   ${resolved.body.reason}`,
    ...(resolved.heading.code !== 'ok' || resolved.body.code !== 'ok'
      ? [' *', ' * 注意：当前文件由离线/缺字环境导出，font-family 仍保留选定字体与完整备用链，', ' * 网络恢复并安装字体后会自动按原选择渲染，备用字体不是定稿选择。']
      : []),
    ` */`,
    '',
    `/* ${pair.title} */`,
    `.heading { font-family: ${cssFamily(resolved.heading)}; font-size: ${pair.size}px; font-weight: ${pair.weight}; }`,
    `.body { font-family: ${cssFamily(resolved.body)}; line-height: ${pair.leading}; letter-spacing: ${pair.tracking}px; }`,
    '',
  ];
  return lines.join('\n');
}

export function downloadCss(pair: Pair, resolved: { heading: ResolvedRole; body: ResolvedRole }, env: FontEnv): void {
  const css = buildCss(pair, resolved, env);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([css], { type: 'text/css' }));
  a.download = `type-pair-${pair.id}.css`;
  a.click();
  URL.revokeObjectURL(a.href);
}

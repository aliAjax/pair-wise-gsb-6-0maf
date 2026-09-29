// 导出层：CSS 直接由"解析后的结果"生成，与画布/列表看到的是同一份栈。
// 导出文件里原选择始终排在第一位（不把备用写成新配置），
// 同时在注释里写明当前现场实际生效的字体与原因。

import type { Pair, PairTuning } from './model';
import type { ResolvedFont } from './resolve';
import { describeReason } from './resolve';

export interface ResolvedPair {
  heading: ResolvedFont;
  body: ResolvedFont;
}

export function buildPairCSS(
  pair: Pair,
  tuning: PairTuning,
  resolved: ResolvedPair,
  online: boolean,
): string {
  const lines = [
    `/* ${pair.title} */`,
    `/* 导出环境：${online ? '在线' : '离线（现场演示）'} · ${new Date().toLocaleString()} */`,
    `/* 标题：选定 ${resolved.heading.choice.family} → ${describeReason(resolved.heading.reason)} */`,
    `/* 正文：选定 ${resolved.body.choice.family} → ${describeReason(resolved.body.reason)} */`,
    `/* font-family 首位保持原选择，网络恢复后自动恢复；备用链不会覆盖配置 */`,
    '',
    `.heading {`,
    `  font-family: ${resolved.heading.css};`,
    `  font-size: ${tuning.size}px;`,
    `  font-weight: ${tuning.weight};`,
    `}`,
    `.body {`,
    `  font-family: ${resolved.body.css};`,
    `  line-height: ${tuning.leading};`,
    `  letter-spacing: ${tuning.tracking}px;`,
    `}`,
  ];
  return lines.join('\n');
}

export function downloadCSS(filename: string, css: string): void {
  const url = URL.createObjectURL(new Blob([css], { type: 'text/css' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

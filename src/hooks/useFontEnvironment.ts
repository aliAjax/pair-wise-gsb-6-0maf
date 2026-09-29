// 页面层：订阅浏览器环境（联网状态、字体加载事件），输出唯一一份字体可用性表。
// 列表、画布、导出都消费这同一份状态，保证三处永远指向同一解析结果。

import { useEffect, useState } from 'react';
import { FONT_CATALOG } from '../fonts/catalog';
import { ensureWebFontsLoaded } from '../fonts/loader';
import { detectAvailability, isOnline, type FontStatus } from '../fonts/resolve';

export interface FontEnvironment {
  online: boolean;
  status: FontStatus;
  /** 每次重新检测完成的时间戳，用于触发下游重新解析/记录 */
  detectedAt: number;
}

export function useFontEnvironment(): FontEnvironment {
  const families = FONT_CATALOG.map((f) => f.family);
  const [online, setOnline] = useState(isOnline());
  const [status, setStatus] = useState<FontStatus>(
    () => new Map(families.map((f) => [f, 'pending'])),
  );
  const [detectedAt, setDetectedAt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const run = async () => {
      // 先确保字体样式表在场（在线时拉取，离线时命中缓存），再检测
      ensureWebFontsLoaded();
      // 给浏览器一点时间消化样式表；fonts.load 本身也会等待
      const next = await detectAvailability(families);
      if (!cancelled) {
        setStatus(next);
        setDetectedAt(Date.now());
      }
    };
    run();
    // 样式表可能还在下载，稍后再验证一次（触发 loadingdone 之外的兜底）
    timers.push(window.setTimeout(run, 2500));

    const goOnline = () => {
      setOnline(true);
      // 重新拉取：成功后字体选择自动回到原 family，不需要改任何已保存数据
      run();
      timers.push(window.setTimeout(run, 3000));
    };
    const goOffline = () => {
      setOnline(false);
      run();
    };
    // 字体通过样式表/Google CSS 异步加载完成时（如网络刚恢复），刷新检测结果
    const onFontsLoaded = () => run();

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    document.fonts?.addEventListener?.('loadingdone', onFontsLoaded);
    document.fonts?.addEventListener?.('loadingerror', onFontsLoaded);
    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.fonts?.removeEventListener?.('loadingdone', onFontsLoaded);
      document.fonts?.removeEventListener?.('loadingerror', onFontsLoaded);
    };
    // 字体目录固定，环境订阅只建一次
  }, []);

  return { online, status, detectedAt };
}

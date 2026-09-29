// 保存层：只管 StoredSettings 与 localStorage 之间的序列化读写。
// 解析（迁移）逻辑在 model.ts，页面不直接碰 localStorage。

import { migrateSettings, type StoredSettings } from './model';

const STORAGE_KEY = 'type-pairer/settings/v2';
const LEGACY_KEY = 'type-pairs';

export function loadSettings(): StoredSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateSettings(JSON.parse(raw));
    // 兼容最初版本直接存数组的 key
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateSettings(JSON.parse(legacy));
      if (migrated.pairs.length > 0) return migrated;
    }
  } catch {
    // 损坏的数据按空处理，由调用方决定是否用内置样例
  }
  return null;
}

export function saveSettings(settings: StoredSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 存储空间满或隐私模式：静默失败，不影响当前会话的渲染
  }
}

export function exportToJSON(settings: StoredSettings): void {
  const blob = new Blob([JSON.stringify(settings, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'type-pairer-settings.json';
  a.click();
  URL.revokeObjectURL(url);
}

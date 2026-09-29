// 字体配对的数据模型。
// 配置里永远保存“用户选定的字体名 + 备用链”，
// 当前环境实际渲染用哪个字体属于“解析结果/会话记录”，不回写配置。

export type ReasonCode = 'ok' | 'fallback' | 'unavailable';

/** 一个文字角色（标题或正文）的字体配置：原选择 + 备用链 */
export interface FontChoice {
  /** 用户选定的字体名，任何情况下都保留，恢复网络后回到它 */
  font: string;
  /** 备用字体链，顺序即优先级，末位通常是通用族 */
  fallbacks: string[];
}

/** 一条配对记录（持久化配置） */
export interface Pair {
  id: number;
  title: string;
  heading: string;
  body: string;
  category: string;
  favorite: boolean;
  headingChoice: FontChoice;
  bodyChoice: FontChoice;
  /** 排版微调，随配对一起保存 */
  size: number;
  weight: number;
  leading: number;
  tracking: number;
}

/** 解析后的单个文字角色：页面上所有位置都使用同一份结果 */
export interface ResolvedRole {
  role: 'heading' | 'body';
  chosen: string;
  chain: string[];
  /** 当前环境真正会显示的字体名 */
  active: string;
  /** active 在链中的位置：0 表示用的就是原选择 */
  activeIndex: number;
  code: ReasonCode;
  /** 面向用户的原因说明（中文） */
  reason: string;
}

/** 当前环境描述 */
export interface FontEnv {
  online: boolean;
  /** 当前环境可显示的字体（含系统字体与已缓存的 web 字体） */
  available: ReadonlySet<string>;
  /** 是否处于“现场模拟离线”状态（会话级，不写进配置） */
  simulatedOffline: boolean;
}

/** 上次渲染情况（会话记录，与配置分开保存） */
export interface RoleSession {
  role: 'heading' | 'body';
  chosen: string;
  active: string;
  code: ReasonCode;
  reason: string;
  at: string;
}

export interface PairSession {
  roles: Record<'heading' | 'body', RoleSession>;
}

/** localStorage 顶层结构（只放配置，不放运行期解析结果） */
export interface StoreData {
  version: 2;
  pairs: Pair[];
  selectedId: number | null;
}

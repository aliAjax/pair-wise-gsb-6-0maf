import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  CloudOff,
  Download,
  Grid3X3,
  Heart,
  History,
  Plus,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Star,
  Trash2,
  Type,
  Wifi,
} from 'lucide-react';
import {
  BODY_FONTS,
  HEADING_FONTS,
  isWebFont,
  quoteStack,
} from './fonts/catalog';
import { buildPairCSS, downloadCSS, type ResolvedPair } from './fonts/exporter';
import {
  DEFAULT_TUNING,
  newFontChoice,
  type EnvironmentSnapshot,
  type FontSnapshot,
  type Pair,
  type StoredSettings,
} from './fonts/model';
import { resolveFont } from './fonts/resolve';
import { SEED_PAIRS } from './fonts/seed';
import { loadSettings, saveSettings } from './fonts/storage';
import { useFontEnvironment } from './hooks/useFontEnvironment';

function initialSettings(): StoredSettings {
  const loaded = loadSettings();
  if (loaded && loaded.pairs.length > 0) return loaded;
  return { pairs: SEED_PAIRS, selectedId: SEED_PAIRS[0].id, lastEnvironment: null };
}

function toSnapshot(resolved: ResolvedPair): { heading: FontSnapshot; body: FontSnapshot } {
  const snap = (r: ResolvedPair['heading']): FontSnapshot => ({
    requested: r.choice.family,
    effective: r.effectiveFamily,
    fallback: r.reason.kind === 'fallback',
    cause: r.reason.kind === 'fallback' ? r.reason.cause : undefined,
    stack: r.stack,
  });
  return { heading: snap(resolved.heading), body: snap(resolved.body) };
}

export default function App() {
  const [settings, setSettings] = useState<StoredSettings>(initialSettings);
  const { pairs, selectedId } = settings;

  // 唯一一份环境状态：列表、画布、导出全部从它派生
  const env = useFontEnvironment();
  const [simulateOffline, setSimulateOffline] = useState(false);
  const online = simulateOffline ? false : env.online;
  // 现场演练：web 字体一律视为"现场拉不到"，本机字体照常可用；
  // 这只影响本次解析的入参，不会改写真实检测结果，也不会写进存储
  const simulatedStatus = useMemo<typeof env.status>(() => {
    if (!simulateOffline) return env.status;
    const map = new Map(env.status);
    for (const [family, availability] of map) {
      if (availability !== 'available' || isWebFont(family)) {
        map.set(family, isWebFont(family) ? 'unavailable' : 'available');
      }
    }
    return map;
  }, [simulateOffline, env.status]);
  const ctx = { online, status: simulatedStatus };

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [bannerSeen, setBannerSeen] = useState(false);
  const [historySeen, setHistorySeen] = useState(false);

  const current = pairs.find((p) => p.id === selectedId) ?? pairs[0];

  // 每对配对都解析一次；列表卡片、画布、导出共用这个 map
  const resolvedMap = useMemo(() => {
    const map = new Map<number, ResolvedPair>();
    for (const p of pairs) {
      map.set(p.id, {
        heading: resolveFont(p.headingFont, ctx),
        body: resolveFont(p.bodyFont, ctx),
      });
    }
    return map;
  }, [pairs, online, simulatedStatus, env.detectedAt]);

  // 持久化：选择/备用链/微调变化时保存；解析结果（备用渲染）永远不写回
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // 记录"上次使用时的现场"，重开后可回看字体与原因。
  // 演练模式不记录；用内容签名去重，避免和保存 effect 互相触发造成循环。
  const snapshotSignature = useMemo(() => {
    const parts = pairs.map((p) => {
      const r = resolvedMap.get(p.id);
      if (!r) return '';
      return `${p.id}:${r.heading.effectiveFamily}:${r.body.effectiveFamily}`;
    });
    return `${env.online}|${env.detectedAt}|${parts.join(',')}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, resolvedMap, env.online, env.detectedAt]);

  useEffect(() => {
    if (env.detectedAt === 0 || simulateOffline) return;
    setSettings((s) => {
      const resolved: EnvironmentSnapshot['resolved'] = {};
      for (const p of s.pairs) {
        const r = resolvedMap.get(p.id);
        if (r) resolved[p.id] = toSnapshot(r);
      }
      return {
        ...s,
        lastEnvironment: { online: env.online, resolved, at: new Date().toISOString() },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotSignature]);

  if (!current) {
    return (
      <div className="empty-state">
        <Type size={26} />
        <p>还没有配对，新建一套开始吧。</p>
        <button className="primary" onClick={() => setShowAdd(true)}>
          <Plus size={15} /> New pairing
        </button>
      </div>
    );
  }

  const resolved = resolvedMap.get(current.id)!;
  const anyFallback =
    resolved.heading.reason.kind === 'fallback' || resolved.body.reason.kind === 'fallback';

  const updatePair = (id: number, patch: Partial<Pair>) =>
    setSettings((s) => ({
      ...s,
      pairs: s.pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));

  const changeFont = (role: 'headingFont' | 'bodyFont', family: string) =>
    updatePair(current.id, {
      [role]: newFontChoice(family, role === 'headingFont' ? 'heading' : 'body'),
    });

  const changeTuning = (patch: Partial<Pair['tuning']>) =>
    updatePair(current.id, { tuning: { ...current.tuning, ...patch } });

  const create = () => {
    if (!newTitle.trim()) return;
    const id = Date.now();
    const pair: Pair = {
      id,
      title: newTitle.trim(),
      heading: 'Your new headline',
      body: 'Start with a sentence that lets your type pairing show its character.',
      category: 'Untitled',
      favorite: false,
      headingFont: newFontChoice('Fraunces', 'heading'),
      bodyFont: newFontChoice('DM Sans', 'body'),
      tuning: { ...DEFAULT_TUNING },
    };
    setSettings((s) => ({ ...s, pairs: [...s.pairs, pair], selectedId: id }));
    setNewTitle('');
    setShowAdd(false);
  };

  const removePair = () => {
    const remaining = pairs.filter((p) => p.id !== current.id);
    setSettings((s) => ({
      ...s,
      pairs: remaining,
      selectedId: remaining[0]?.id ?? null,
    }));
  };

  const exportCss = () => {
    const css = buildPairCSS(current, current.tuning, resolved, online);
    downloadCSS(`type-pair-${current.id}.css`, css);
  };

  const toggleSimulate = () => {
    setSimulateOffline((v) => !v);
    // 解析只依赖 online + 检测表，切换即重算；真实检测状态不被修改
    setBannerSeen(false);
  };

  const headingReason = resolved.heading.reason;
  const bodyReason = resolved.body.reason;
  const last = historySeen ? null : settings.lastEnvironment;

  return (
    <div className="app">
      <aside>
        <div className="brand">
          <div className="brand-mark">
            <Type size={18} />
          </div>
          <div>
            <b>Type Pairer</b>
            <small>FIND YOUR VOICE</small>
          </div>
        </div>
        <div className="nav-section">
          <span>LIBRARY</span>
          <button className="nav active">
            <Grid3X3 size={16} />
            All pairings <b>{pairs.length}</b>
          </button>
          <button className="nav">
            <Heart size={16} />
            Favorites <b>{pairs.filter((p) => p.favorite).length}</b>
          </button>
        </div>
        <div className="saved">
          <div className="saved-head">
            <span>COLLECTIONS</span>
            <button onClick={() => setShowAdd(true)}>
              <Plus size={14} />
            </button>
          </div>
          {Array.from(new Set(pairs.map((p) => p.category))).map((cat) => (
            <button key={cat} className="collection">
              <i style={{ background: categoryColor(cat) }} />
              {cat} <b>{pairs.filter((p) => p.category === cat).length}</b>
            </button>
          ))}
        </div>
        <div className="aside-foot">
          <button className="nav">
            <Settings2 size={16} />
            Preferences
          </button>
          <div className="profile">
            <div className="avatar">YL</div>
            <div>
              <b>Yuki Lin</b>
              <small>Design workspace</small>
            </div>
            <ChevronDown size={14} />
          </div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <div className="crumb">
              TYPE LIBRARY / <b>PAIRING STUDIO</b>
            </div>
            <h1>Find the right conversation.</h1>
            <p>Explore combinations, tune the details, and save what feels like you.</p>
          </div>
          <div className="actions">
            <button
              className={simulateOffline ? 'env-pill offline' : 'env-pill'}
              onClick={toggleSimulate}
              title="模拟客户现场的离线环境，预览备用字体效果"
            >
              {online ? <Wifi size={12} /> : <CloudOff size={12} />}
              {online ? '在线' : env.online ? '离线预览' : '已离线'}
              <span className="sep" />
              <RefreshCw size={11} />
              {simulateOffline ? '退出演练' : '现场演练'}
            </button>
            <button className="outline" onClick={exportCss}>
              <Download size={15} />
              Copy CSS
            </button>
            <button className="primary" onClick={() => setShowAdd(true)}>
              <Plus size={16} />
              New pairing
            </button>
          </div>
        </header>

        {!online && !bannerSeen && anyFallback && (
          <div className={simulateOffline ? 'env-banner sim' : 'env-banner'}>
            <AlertTriangle size={14} />
            <div>
              {simulateOffline ? '离线演练：' : '网络已断开：'}
              画布、列表与导出统一使用备用字体渲染
              {headingReason.kind === 'fallback' &&
                `，标题以「${headingReason.effective}」代替「${headingReason.requested}」`}
              {bodyReason.kind === 'fallback' &&
                `，正文以「${bodyReason.effective}」代替「${bodyReason.requested}」`}
              。原选择保持不变，恢复网络后自动切回，不会存成新配置。
            </div>
            <button className="dismiss" onClick={() => setBannerSeen(true)}>
              ×
            </button>
          </div>
        )}

        {last && (
          <div className="last-env">
            <History size={13} />
            <div>
              上次使用（{new Date(last.at).toLocaleString()}，{last.online ? '在线' : '离线'}）
              {last.resolved[current.id]
                ? `：标题实际显示「${last.resolved[current.id].heading.effective}」、正文「${last.resolved[current.id].body.effective}」` +
                  (last.resolved[current.id].heading.fallback ||
                  last.resolved[current.id].body.fallback
                    ? '（备用字体临时渲染，原选择已保留）'
                    : '，均为选定字体')
                : ''}
            </div>
            <button onClick={() => setHistorySeen(true)}>×</button>
          </div>
        )}

        <div className="layout">
          <section className="gallery">
            <div className="gallery-head">
              <div>
                <h2>Saved pairings</h2>
                <span>{pairs.length} compositions</span>
              </div>
              <div className="view-toggle">
                <button className="on">
                  <Grid3X3 size={14} />
                </button>
                <button>
                  <BookOpen size={14} />
                </button>
              </div>
            </div>
            <div className="pair-list">
              {pairs.map((p) => {
                const r = resolvedMap.get(p.id)!;
                const hFallback = r.heading.reason.kind === 'fallback';
                const bFallback = r.body.reason.kind === 'fallback';
                return (
                  <button
                    key={p.id}
                    className={current.id === p.id ? 'pair selected' : 'pair'}
                    onClick={() => {
                      setSettings((s) => ({ ...s, selectedId: p.id }));
                      setHistorySeen(true);
                    }}
                  >
                    <div className="pair-top">
                      <span>{p.category}</span>
                      <Heart
                        size={15}
                        fill={p.favorite ? '#e88769' : 'none'}
                        color={p.favorite ? '#e88769' : '#aeb5b7'}
                      />
                    </div>
                    {/* 与画布、导出同一份解析结果：整条字体栈交给 CSS */}
                    <strong style={{ fontFamily: r.heading.css }}>{p.heading}</strong>
                    <p style={{ fontFamily: r.body.css }}>{p.body}</p>
                    <div className="pair-fonts">
                      <span>
                        H: {p.headingFont.family}
                        {hFallback ? ` → ${r.heading.effectiveFamily}` : ''}
                      </span>
                      <span>
                        B: {p.bodyFont.family}
                        {bFallback ? ` → ${r.body.effectiveFamily}` : ''}
                      </span>
                    </div>
                    {(hFallback || bFallback) && (
                      <div className="pair-reason">
                        {hFallback && r.heading.reason.kind === 'fallback' &&
                          `标题备用渲染：${r.heading.reason.cause === 'offline' ? '离线未缓存' : '加载失败'}`}
                        {hFallback && bFallback && ' · '}
                        {bFallback && r.body.reason.kind === 'fallback' &&
                          `正文备用渲染：${r.body.reason.cause === 'offline' ? '离线未缓存' : '加载失败'}`}
                      </div>
                    )}
                    <div className="pair-foot">
                      <span>{p.title}</span>
                      <small>Open canvas →</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="studio">
            <div className="studio-head">
              <div>
                <span>PAIRING CANVAS</span>
                <h2>{current.title}</h2>
              </div>
              <button
                className="favorite"
                onClick={() => updatePair(current.id, { favorite: !current.favorite })}
              >
                <Star
                  size={16}
                  fill={current.favorite ? '#e5a35e' : 'none'}
                  color={current.favorite ? '#e5a35e' : '#98a4a7'}
                />
              </button>
            </div>
            <div className="canvas">
              <div className="canvas-bar">
                <span>PREVIEW</span>
                <div>
                  <button className="cb-on">Desktop</button>
                  <button>Tablet</button>
                  <button>Mobile</button>
                </div>
              </div>
              <div className="preview">
                <span className="preview-kicker">A NOTE ON TYPE</span>
                <h3
                  style={{
                    fontFamily: resolved.heading.css,
                    fontSize: `${current.tuning.size}px`,
                    fontWeight: current.tuning.weight,
                    letterSpacing: `${current.tuning.tracking}px`,
                    lineHeight: 1.05,
                  }}
                >
                  {current.heading}
                </h3>
                <p
                  style={{
                    fontFamily: resolved.body.css,
                    lineHeight: current.tuning.leading,
                    letterSpacing: `${current.tuning.tracking / 2}px`,
                  }}
                >
                  {current.body}
                </p>
                <div className="preview-rule" />
                <span className="preview-meta">
                  PAIRING 0{current.id} · {current.category.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="controls">
              <div className="control-head">
                <div>
                  <span>TYPE CONTROLS</span>
                  <h3>Fine tune your pairing</h3>
                </div>
                <SlidersHorizontal size={17} />
              </div>
              <div className="font-row">
                <label>
                  Heading font
                  <select
                    value={current.headingFont.family}
                    onChange={(e) => changeFont('headingFont', e.target.value)}
                  >
                    {HEADING_FONTS.map((f) => (
                      <option key={f.family} value={f.family}>
                        {f.family}
                      </option>
                    ))}
                  </select>
                  <div className={headingReason.kind === 'selected' ? 'font-note ok' : 'font-note'}>
                    {headingReason.kind === 'selected' ? (
                      <>
                        <Check size={11} /> 当前按选定字体 <b>{current.headingFont.family}</b> 渲染
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={11} /> 临时使用备用{' '}
                        <b>{headingReason.effective}</b>，恢复后回到{' '}
                        <b>{current.headingFont.family}</b>
                      </>
                    )}
                  </div>
                  <div className="chain-hint">
                    备用链：{quoteStack(current.headingFont.fallback)}
                  </div>
                </label>
                <label>
                  Body font
                  <select
                    value={current.bodyFont.family}
                    onChange={(e) => changeFont('bodyFont', e.target.value)}
                  >
                    {BODY_FONTS.map((f) => (
                      <option key={f.family} value={f.family}>
                        {f.family}
                      </option>
                    ))}
                  </select>
                  <div className={bodyReason.kind === 'selected' ? 'font-note ok' : 'font-note'}>
                    {bodyReason.kind === 'selected' ? (
                      <>
                        <Check size={11} /> 当前按选定字体 <b>{current.bodyFont.family}</b> 渲染
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={11} /> 临时使用备用 <b>{bodyReason.effective}</b>
                        ，恢复后回到 <b>{current.bodyFont.family}</b>
                      </>
                    )}
                  </div>
                  <div className="chain-hint">备用链：{quoteStack(current.bodyFont.fallback)}</div>
                </label>
              </div>
              <div className="range-row">
                <label>
                  Size <b>{current.tuning.size}px</b>
                  <input
                    type="range"
                    min="28"
                    max="76"
                    value={current.tuning.size}
                    onChange={(e) => changeTuning({ size: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Weight <b>{current.tuning.weight}</b>
                  <input
                    type="range"
                    min="300"
                    max="800"
                    step="100"
                    value={current.tuning.weight}
                    onChange={(e) => changeTuning({ weight: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="range-row">
                <label>
                  Line height <b>{current.tuning.leading.toFixed(2)}</b>
                  <input
                    type="range"
                    min="1"
                    max="1.8"
                    step=".05"
                    value={current.tuning.leading}
                    onChange={(e) => changeTuning({ leading: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Letter spacing <b>{current.tuning.tracking}px</b>
                  <input
                    type="range"
                    min="-1"
                    max="3"
                    step=".5"
                    value={current.tuning.tracking}
                    onChange={(e) => changeTuning({ tracking: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
            <div className="studio-foot">
              <button className="delete" onClick={removePair}>
                <Trash2 size={15} />
                Delete pairing
              </button>
              <button className="save">
                <Check size={13} /> 选择、备用链与微调已本地保存
              </button>
            </div>
          </section>
        </div>
      </main>

      {showAdd && (
        <div className="backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New pairing</h2>
            <label>
              Pairing name
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Quiet confidence"
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
            </label>
            <div className="modal-actions">
              <button className="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button className="primary" onClick={create}>
                Create pairing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  Editorial: '#e8b7a0',
  Portfolio: '#9fc9be',
  Brand: '#b4add8',
  Untitled: '#cfd4c8',
};
function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#d3c9b8';
}

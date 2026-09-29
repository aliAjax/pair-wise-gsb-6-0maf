import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {BookOpen, ChevronDown, Download, Grid3X3, Heart, Plus, Settings2, SlidersHorizontal, Star, Trash2, Type, Wifi, WifiOff, RefreshCw} from 'lucide-react';
import {CATALOG, defaultChoice} from './fonts/catalog';
import {createPair, loadStore, loadSessions, savePairs, saveSession} from './fonts/store';
import {cssFamily, resolvePair} from './fonts/resolve';
import {downloadCss} from './fonts/exportCss';
import {useFontEnv} from './fonts/useFontEnv';
import type {FontChoice, Pair, PairSession, ResolvedRole, StoreData} from './fonts/types';

export default function App(){
  // ---- 配置（持久化）：字体原选择 + 备用链 ----
  const [store,setStore]=useState<StoreData>(()=>loadStore().data);
  const pairs=store.pairs;
  const [selected,setSelected]=useState<number>(()=>store.selectedId ?? store.pairs[0]?.id ?? 0);
  const [sessions,setSessions]=useState<Record<string,PairSession>>(()=>loadSessions());

  // ---- 当前环境（在线/离线、可用字体、现场模拟） ----
  const {env,simulatedOffline,toggleSimulatedOffline,recheck,checking}=useFontEnv();

  const current=pairs.find(p=>p.id===selected)||pairs[0];

  // 解析是纯函数：列表、画布、导出全部消费这一份结果
  const resolvedByPair=useMemo(()=>{
    const m=new Map<number,{heading:ResolvedRole;body:ResolvedRole}>();
    for(const p of pairs) m.set(p.id,resolvePair(p,env));
    return m;
  },[pairs,env]);
  const resolved=current?resolvedByPair.get(current.id)!:null;

  // 排版微调：改的是当前配对；切换配对时跟随该配对
  const [size,setSize]=useState(current?.size??46);
  const [weight,setWeight]=useState(current?.weight??600);
  const [leading,setLeading]=useState(current?.leading??1.25);
  const [tracking,setTracking]=useState(current?.tracking??0);
  useEffect(()=>{
    if(!current) return;
    setSize(current.size);setWeight(current.weight);
    setLeading(current.leading);setTracking(current.tracking);
  },[current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 保存：只存选择与备用链；解析结果绝不回写 ----
  const persist=useCallback((next: Pair[], nextSelected?: number)=>{
    const id=nextSelected ?? (next.some(p=>p.id===selected)?selected:(next[0]?.id??null));
    savePairs(next,id);
    setStore({version:2,pairs:next,selectedId:id});
  },[selected]);

  // 排版微调自动保存进该配对
  useEffect(()=>{
    if(!current) return;
    if(current.size===size&&current.weight===weight&&current.leading===leading&&current.tracking===tracking)return;
    const next=pairs.map(p=>p.id===current.id?{...p,size,weight,leading,tracking}:p);
    savePairs(next,selected);
    setStore({version:2,pairs:next,selectedId:selected});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[size,weight,leading,tracking]);

  // ---- 会话记录：加载失败/恢复/现场切换导致结果变化时，记下实际字体与原因 ----
  const lastSessionKey=useRef('');
  useEffect(()=>{
    if(!current||!resolved)return;
    const key=`${current.id}:${env.online}:${env.simulatedOffline}:${resolved.heading.active}:${resolved.body.active}:${resolved.heading.code}:${resolved.body.code}`;
    if(lastSessionKey.current===key)return;
    lastSessionKey.current=key;
    saveSession(current.id,env,current);
    setSessions(loadSessions());
  },[current,resolved,env]);

  const [showAdd,setShowAdd]=useState(false);
  const [newTitle,setNewTitle]=useState('');

  const create=()=>{
    if(!newTitle.trim())return;
    const p=createPair(newTitle);
    const next=[...pairs,p];
    persist(next,p.id);
    setSelected(p.id);
    setNewTitle('');setShowAdd(false);
  };

  const updateChoice=(role:'headingChoice'|'bodyChoice',choice:FontChoice)=>{
    if(!current)return;
    const next=pairs.map(p=>p.id===current.id?{...p,[role]:choice}:p);
    persist(next);
  };

  const toggleFav=()=>{
    if(!current)return;
    persist(pairs.map(p=>p.id===current.id?{...p,favorite:!p.favorite}:p));
  };

  const removeCurrent=()=>{
    if(!current)return;
    const next=pairs.filter(p=>p.id!==current.id);
    persist(next,next[0]?.id??null);
    setSelected(next[0]?.id??0);
  };

  const anyFallback=resolved&&(resolved.heading.code!=='ok'||resolved.body.code!=='ok');
  const lastSession=current?sessions[String(current.id)]:undefined;

  return <div className="app"><aside><div className="brand"><div className="brand-mark"><Type size={18}/></div><div><b>Type Pairer</b><small>FIND YOUR VOICE</small></div></div>
    <div className="nav-section"><span>LIBRARY</span>
      <button className="nav active"><Grid3X3 size={16}/>All pairings <b>{pairs.length}</b></button>
      <button className="nav"><Heart size={16}/>Favorites <b>{pairs.filter(p=>p.favorite).length}</b></button>
    </div>
    <div className="saved"><div className="saved-head"><span>COLLECTIONS</span><button onClick={()=>setShowAdd(true)}><Plus size={14}/></button></div>
      <button className="collection"><i style={{background:'#e8b7a0'}}/>Editorial <b>{pairs.filter(p=>p.category==='Editorial').length}</b></button>
      <button className="collection"><i style={{background:'#9fc9be'}}/>Portfolio <b>{pairs.filter(p=>p.category==='Portfolio').length}</b></button>
      <button className="collection"><i style={{background:'#b4add8'}}/>Brand voice <b>{pairs.filter(p=>p.category==='Brand').length}</b></button>
    </div>
    <div className="aside-foot"><button className="nav"><Settings2 size={16}/>Preferences</button>
      <div className="profile"><div className="avatar">YL</div><div><b>Yuki Lin</b><small>Design workspace</small></div><ChevronDown size={14}/></div>
    </div></aside>

  <main><header><div><div className="crumb">TYPE LIBRARY / <b>PAIRING STUDIO</b></div>
      <h1>Find the right conversation.</h1>
      <p>Explore combinations, tune the details, and save what feels like you.</p></div>
      <div className="actions">
        <EnvBadge online={env.online} simulated={simulatedOffline} checking={checking} onToggle={toggleSimulatedOffline} onRecheck={recheck}/>
        <button className="outline" onClick={()=>current&&resolved&&downloadCss(current,resolved,env)}><Download size={15}/>Export CSS</button>
        <button className="primary" onClick={()=>setShowAdd(true)}><Plus size={16}/>New pairing</button>
      </div></header>

    <div className="layout"><section className="gallery"><div className="gallery-head"><div><h2>Saved pairings</h2><span>{pairs.length} compositions</span></div>
        <div className="view-toggle"><button className="on"><Grid3X3 size={14}/></button><button><BookOpen size={14}/></button></div></div>
      <div className="pair-list">
        {pairs.map(p=>{
          const r=resolvedByPair.get(p.id)!;
          return <button key={p.id} className={selected===p.id?'pair selected':'pair'} onClick={()=>setSelected(p.id)}>
            <div className="pair-top"><span>{p.category}</span><Heart size={15} fill={p.favorite?'#e88769':'none'} color={p.favorite?'#e88769':'#aeb5b7'}/></div>
            <strong style={{fontFamily:cssFamily(r.heading)}}>{p.heading}</strong>
            <p style={{fontFamily:cssFamily(r.body)}}>{p.body}</p>
            {r.heading.code!=='ok'&&<FontTag r={r.heading}/>}
            {r.body.code!=='ok'&&<FontTag r={r.body}/>}
            <div className="pair-foot"><span>{p.title}</span><small>Open canvas →</small></div>
          </button>;
        })}
      </div></section>

    {current&&resolved&&<section className="studio">
      <div className="studio-head"><div><span>PAIRING CANVAS</span><h2>{current.title}</h2></div>
        <button className="favorite" onClick={toggleFav}><Star size={16} fill={current.favorite?'#e5a35e':'none'} color={current.favorite?'#e5a35e':'#98a4a7'}/></button></div>

      {anyFallback&&<div className="env-banner warn"><WifiOff size={14}/>
        <div>{resolved.heading.code!=='ok'&&<div>{resolved.heading.reason}</div>}
          {resolved.body.code!=='ok'&&<div>{resolved.body.reason}</div>}
          <small>当前只是预览/导出结果，备用字体不会写回配置；网络恢复后自动还原。</small></div></div>}
      {!anyFallback&&<div className="env-banner ok"><Wifi size={14}/><div>
        {lastSession&&(lastSession.roles.heading.code!=='ok'||lastSession.roles.body.code!=='ok')
          ?'环境恢复，标题与正文已回到原来的字体选择。'
          :'标题与正文均按选定字体渲染。'}</div></div>}

      <div className="canvas"><div className="canvas-bar"><span>PREVIEW</span><div><button className="on">Desktop</button><button>Tablet</button><button>Mobile</button></div></div>
        <div className="preview"><span className="preview-kicker">A NOTE ON TYPE</span>
          <h3 style={{fontFamily:cssFamily(resolved.heading),fontSize:`${size}px`,fontWeight:weight,letterSpacing:`${tracking}px`,lineHeight:1.05}}>{current.heading}</h3>
          <p style={{fontFamily:cssFamily(resolved.body),lineHeight:leading,letterSpacing:`${tracking/2}px`}}>{current.body}</p>
          <div className="preview-rule"/>
          <span className="preview-meta">PAIRING 0{current.id} · {current.category.toUpperCase()}</span>
        </div></div>

      <div className="controls"><div className="control-head"><div><span>TYPE CONTROLS</span><h3>Fine tune your pairing</h3></div><SlidersHorizontal size={17}/></div>
        <div className="font-row">
          <FontSelect label="Heading font" choice={current.headingChoice} resolved={resolved.heading} onChange={c=>updateChoice('headingChoice',c)}/>
          <FontSelect label="Body font" choice={current.bodyChoice} resolved={resolved.body} onChange={c=>updateChoice('bodyChoice',c)}/>
        </div>
        <ChainView r={resolved.heading}/>
        <ChainView r={resolved.body}/>
        <div className="range-row"><label>Size <b>{size}px</b><input type="range" min="28" max="76" value={size} onChange={e=>setSize(Number(e.target.value))}/></label>
          <label>Weight <b>{weight}</b><input type="range" min="300" max="800" step="100" value={weight} onChange={e=>setWeight(Number(e.target.value))}/></label></div>
        <div className="range-row"><label>Line height <b>{leading.toFixed(2)}</b><input type="range" min="1" max="1.8" step=".05" value={leading} onChange={e=>setLeading(Number(e.target.value))}/></label>
          <label>Letter spacing <b>{tracking}px</b><input type="range" min="-1" max="3" step=".5" value={tracking} onChange={e=>setTracking(Number(e.target.value))}/></label></div>
      </div>

      {lastSession&&<LastSession s={lastSession}/>}

      <div className="studio-foot">
        <button className="delete" onClick={removeCurrent}><Trash2 size={15}/>Delete pairing</button>
        <button className="save" onClick={()=>persist(pairs)}><CheckIcon/>Saved locally</button>
      </div></section>}
    </div></main>

  {showAdd&&<div className="backdrop" onClick={()=>setShowAdd(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
    <h2>New pairing</h2>
    <label>Pairing name<input autoFocus value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="e.g. Quiet confidence"/></label>
    <div className="modal-actions"><button className="outline" onClick={()=>setShowAdd(false)}>Cancel</button>
      <button className="primary" onClick={create}>Create pairing</button></div></div></div>}
  </div>;
}

function EnvBadge({online,simulated,checking,onToggle,onRecheck}:{online:boolean;simulated:boolean;checking:boolean;onToggle:()=>void;onRecheck:()=>void}){
  const off=simulated||!online;
  return <div className="env-badge">
    <button className={off?'env-state off':'env-state on'} onClick={onToggle} title="现场演示时切换：模拟断网（仅本次会话，不改配置）">
      {off?<WifiOff size={14}/>:<Wifi size={14}/>}
      {simulated?'现场离线':online?'在线':'已断网'}
    </button>
    <button className="env-recheck" onClick={onRecheck} title="重新检测字体可用性"><RefreshCw size={13} className={checking?'spin':''}/></button>
  </div>;
}

function FontSelect({label,choice,resolved,onChange}:{label:string;choice:FontChoice;resolved:ResolvedRole;onChange:(c:FontChoice)=>void}){
  // 选择字体只改“原选择”，备用链自动带上该字体在目录里的默认链
  return <label>{label}
    <select value={choice.font} onChange={e=>onChange(defaultChoice(e.target.value))}>
      {CATALOG.map(f=><option key={f.name} value={f.name}>{f.name} · {f.tone}</option>)}
    </select>
    {resolved.code!=='ok'&&<small className="role-note">正在显示：{resolved.active}</small>}
  </label>;
}

function ChainView({r}:{r:ResolvedRole}){
  return <div className="chain">
    <span className="chain-label">{r.role==='heading'?'标题字体链':'正文字体链'}</span>
    {r.chain.map((n,i)=>{
      const cls=i===0?'chosen':i===r.activeIndex?'active':'idle';
      return <span key={`${n}-${i}`} className={`chain-item ${cls}`}>
        {n}{i===0&&<em>选定</em>}{i===r.activeIndex&&i!==0&&<em>当前</em>}
      </span>;
    })}
  </div>;
}

function FontTag({r}:{r:ResolvedRole}){
  return <div className="font-tag"><WifiOff size={11}/>{r.role==='heading'?'标题':'正文'}：{r.active}</div>;
}

function LastSession({s}:{s:PairSession}){
  const rows=[s.roles.heading,s.roles.body];
  return <div className="last-session">
    <div className="last-head">上次使用记录{rows[0].at&&<small>{new Date(rows[0].at).toLocaleString()}</small>}</div>
    {rows.map(r=><div key={r.role} className="last-row">
      <span className={r.code==='ok'?'dot ok':'dot warn'}/>
      <b>{r.role==='heading'?'标题':'正文'}</b>
      <span>选定「{r.chosen}」→ 实际「{r.active}」</span>
      <small>{r.reason}</small>
    </div>)}
  </div>;
}

function CheckIcon(){return <span className="check">✓</span>}

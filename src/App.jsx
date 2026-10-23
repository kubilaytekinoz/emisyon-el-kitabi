import React,{useEffect,useMemo,useState} from 'react';
import {
  Activity,ArrowLeft,ArrowRight,BookOpen,Check,CheckCircle2,ChevronDown,
  ChevronRight,ClipboardCheck,Clock3,FileText,FlaskConical,Gauge,
  LayoutDashboard,LockKeyhole,LogOut,Menu,Plus,Save,Search,Settings2,
  ShieldCheck,SlidersHorizontal,Sparkles,TriangleAlert,UserPlus,Users,
  Wind,X
} from 'lucide-react';
import { api } from './api.js';

const pages=[
  {id:'dashboard',label:'Genel Bakış',icon:LayoutDashboard},
  {id:'methods',label:'Metot Kütüphanesi',icon:BookOpen},
  {id:'sessions',label:'Saha Kayıtları',icon:ClipboardCheck},
  {id:'users',label:'Kullanıcı Yönetimi',icon:Users,admin:true}
];
const niceDate=value=>value?new Date(value).toLocaleDateString('tr-TR',{day:'2-digit',month:'short',year:'numeric'}):'—';
const shortName=user=>user?.fullName?.split(' ')[0]||user?.username||'';
const countSteps=method=>(method?.phases||[]).reduce((n,p)=>n+(p.items?.length||0),0);
const progress=s=>{const keys=(s.method_snapshot?.phases||[]).flatMap(p=>p.items.map((_,i)=>p.id+':'+i));return keys.length?Math.round(keys.filter(k=>s.checks?.[k]).length/keys.length*100):0;};
function Brand({small=false}){
  return <div className={'brand '+(small?'brand-small':'')}>
    <span className="brand-mark"><Wind size={22} strokeWidth={2.3}/></span>
    <span className="brand-text">LAB<span>CORE</span><small>FIELD OPERATIONS</small></span>
  </div>;
}
function Pill({children,tone='neutral'}){return <span className={'pill pill-'+tone}>{children}</span>;}
function SectionHeading({kicker,title,description,action}){
  return <div className="section-heading"><div><span className="eyebrow">{kicker}</span>
    <h1>{title}</h1>{description&&<p>{description}</p>}</div>{action&&<div>{action}</div>}</div>;
}
function Empty({icon:Icon=FileText,title,detail}){return <div className="empty"><Icon size={34}/><strong>{title}</strong><p>{detail}</p></div>;}
function Login({onLogin}){
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [show,setShow]=useState(false);
  const submit=async event=>{
    event.preventDefault();setBusy(true);setError('');
    try{const r=await api('/login',{method:'POST',body:{username,password}});onLogin(r.user);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <div className="login-screen">
    <div className="login-panel">
      <div className="login-form-side">
        <Brand />
        <div className="login-content">
          <span className="eyebrow"><span className="pulse-dot"/> GÜVENLİ PERSONEL GİRİŞİ</span>
          <h1>Tekrar hoş geldiniz.</h1>
          <p>Emisyon ve imisyon saha çalışmalarınız için dijital çalışma alanınıza giriş yapın.</p>
          <form onSubmit={submit} className="stack">
            <label className="field-label">Kullanıcı adı
              <input autoComplete="username" name="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="kullanici.adi" required autoFocus/>
            </label>
            <label className="field-label">Şifre
              <span className="password-field"><input autoComplete="current-password" name="password" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Şifrenizi girin" required/>
                <button type="button" className="eye-button" onClick={()=>setShow(!show)} aria-label="Şifre görünürlüğü">{show?'Gizle':'Göster'}</button></span>
            </label>
            {error&&<div className="form-error"><TriangleAlert size={16}/>{error}</div>}
            <button className="btn btn-primary btn-wide" disabled={busy}>{busy?'Kontrol ediliyor...':'Panele giriş yap'}<ArrowRight size={17}/></button>
          </form>
          <div className="login-tip"><LockKeyhole size={18}/><span>Hesabınız yalnızca sistem yöneticisi tarafından oluşturulur. Şifre değişikliği için yöneticinize başvurun.</span></div>
        </div>
        <div className="login-footer">LABCORE · Dijital Saha El Kitabı <span>v0.1</span></div>
      </div>
      <div className="login-art">
        <div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/>
        <div className="login-art-inner">
          <div className="glass-tag"><Sparkles size={16}/> DAHA AKILLI SAHA YÖNETİMİ</div>
          <h2>Her ölçümde<br/><em>netlik.</em><br/>Her adımda<br/><em>güven.</em></h2>
          <p>Yöntemler, kritik kontroller ve saha kayıtları. Tüm ekip için tek bir dijital merkez.</p>
          <div className="glass-progress"><span><CheckCircle2 size={17}/> Yöntem adımları</span><div className="progress-bars"><i/><i/><i/><i/><i/></div><strong>Kontrol sende.</strong></div>
        </div>
      </div>
    </div>
  </div>;
}
function MethodCard({method,onClick}){
  const Icon=method.category==='İmisyon'?Wind:method.category==='Fiziksel'?Gauge:FlaskConical;
  return <button className="method-card" onClick={onClick}>
    <div className="method-card-top"><span className="method-icon"><Icon size={22}/></span><Pill tone={method.risk==='yüksek'?'amber':'neutral'}>{method.category||'Metot'}</Pill></div>
    <span className="method-code">{method.id} · v{method.version}</span>
    <h3>{method.title}</h3>
    <p>{method.standard}</p>
    <div className="method-footer"><span><ClipboardCheck size={15}/> {countSteps(method)} kontrol adımı</span><ArrowRight size={18}/></div>
  </button>;
}
function Dashboard({user,stats,methods,sessions,onGo,onSelectMethod,onSelectSession,onStart}){
  return <>
    <div className="welcome-banner">
      <div className="banner-content"><span className="banner-label"><span className="pulse-dot"/> SAHA KONTROL MERKEZİ</span>
        <h1>Merhaba, {shortName(user)} <span className="wave">✦</span></h1>
        <p>Bugünkü saha çalışmalarına hazırsın. Metotların ve kontrol listelerin tek bir yerde.</p>
        <button className="btn btn-light" onClick={()=>onGo('methods')}>Metotlara göz at <ArrowRight size={17}/></button>
      </div><div className="banner-visual"><div className="circle circle-one"/><div className="circle circle-two"/><FlaskConical size={91} strokeWidth={1}/></div>
    </div>
    <div className="stats-grid">
      <div className="stat-card"><div className="stat-icon blue"><BookOpen size={21}/></div><span>Metot kütüphanesi</span><strong>{stats.methods??'—'}</strong><small>Adım adım saha rehberi</small></div>
      <div className="stat-card"><div className="stat-icon lilac"><ClipboardCheck size={21}/></div><span>Saha kayıtlarım</span><strong>{stats.sessions??'—'}</strong><small>Merkezi kayıt sistemi</small></div>
      <div className="stat-card"><div className="stat-icon green"><Users size={21}/></div><span>Aktif ekip</span><strong>{stats.users??'—'}</strong><small>Yetkili kullanıcılar</small></div>
    </div>
    <div className="dashboard-columns">
      <section className="panel"><div className="panel-header"><div><span className="eyebrow">HIZLI ERİŞİM</span><h2>Öne çıkan metotlar</h2></div><button className="text-button" onClick={()=>onGo('methods')}>Tümünü gör <ArrowRight size={15}/></button></div>
        <div className="quick-methods">{methods.slice(0,5).map(m=><button key={m.id} onClick={()=>onSelectMethod(m.id)} className="quick-method">
          <span className="quick-icon"><FlaskConical size={19}/></span><span className="quick-copy"><strong>{m.title}</strong><small>{m.standard}</small></span><ChevronRight size={18}/></button>)}</div>
      </section>
      <section className="panel"><div className="panel-header"><div><span className="eyebrow">ÇALIŞMALAR</span><h2>Son saha kayıtları</h2></div><button className="text-button" onClick={()=>onGo('sessions')}>Tümünü gör <ArrowRight size={15}/></button></div>
        {sessions.length?<div className="recent-sessions">{sessions.slice(0,5).map(s=><button className="recent-session" key={s.id} onClick={()=>onSelectSession(s.id)}>
          <div className="recent-session-top"><strong>{s.facility}</strong><Pill tone={s.status==='completed'?'green':'amber'}>{s.status==='completed'?'Tamamlandı':'Devam ediyor'}</Pill></div>
          <span>{s.method_snapshot.title}</span><div className="tiny-progress"><i style={{width:progress(s)+'%'}}/></div><small>{progress(s)}% tamamlandı · {niceDate(s.updated_at)}</small></button>)}</div>:
          <div className="empty-soft"><ClipboardCheck size={28}/><strong>Henüz saha kaydı yok</strong><p>Bir metot seçerek ilk kontrol oturumunu oluşturabilirsin.</p><button className="btn btn-outline btn-small" onClick={onStart}>Yeni saha kaydı <Plus size={14}/></button></div>}
      </section>
    </div>
    <div className="disclaimer"><ShieldCheck size={19}/><span><strong>Teknik doğrulama notu:</strong> Yöntem kartları eğitim amaçlı taslaktır. Sahada yalnızca teknik sorumlu tarafından doğrulanmış güncel SOP, cihaz talimatları ve uygulanabilir mevzuat esas alınmalıdır.</span></div>
  </>;
}
function MethodDetail({method,isAdmin,onBack,onEdit,onStart}){
  const [tab,setTab]=useState('steps');
  useEffect(()=>setTab('steps'),[method.id]);
  return <div className="detail-page">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Metot kütüphanesine dön</button>
    <div className="detail-hero"><div><span className="eyebrow">METOT NO: {method.id} · SÜRÜM {method.version}</span><h1>{method.title}</h1>
      <p>{method.standard}</p><div className="inline-tags"><Pill tone="blue">{method.category}</Pill><Pill tone="amber">SOP kontrolü gerekli</Pill></div></div>
      <div className="detail-actions">{isAdmin&&<button className="btn btn-outline" onClick={onEdit}><Settings2 size={16}/> Düzenle</button>}
        <button className="btn btn-primary" onClick={onStart}><Plus size={16}/> Saha kaydı başlat</button></div>
    </div>
    <div className="detail-layout"><div className="detail-main">
      <div className="tabs"><button className={tab==='steps'?'active':''} onClick={()=>setTab('steps')}>Uygulama adımları</button><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}>Metot bilgisi</button></div>
      {tab==='overview'?<div className="panel padded"><h2>Yöntem hakkında</h2><p className="bodycopy">{method.summary}</p>
        <div className="info-grid"><div><small>KAPSAM</small><strong>{method.category}</strong></div><div><small>REFERANS</small><strong>{method.standard}</strong></div><div><small>TOPLAM ADIM</small><strong>{countSteps(method)}</strong></div><div><small>GÜNCEL SÜRÜM</small><strong>v{method.version}</strong></div></div></div>:
      <div className="phases-list">{method.phases.map((phase,index)=><div className="phase-panel" key={phase.id}>
        <div className="phase-top"><span className="phase-number">{String(index+1).padStart(2,'0')}</span><div><span className="eyebrow">AŞAMA {index+1}</span><h3>{phase.title}</h3></div><Pill>{phase.items.length} adım</Pill></div>
        <div className="phase-items">{phase.items.map((step,i)=><div key={i} className="phase-item"><span className="outline-check"><Check size={12}/></span><p>{step}</p></div>)}</div>
      </div>)}</div>}
    </div><aside className="detail-side">
      <div className="aside-panel warning"><div className="aside-heading"><TriangleAlert size={20}/><h3>Kritik noktalar</h3></div>{method.critical.map((item,i)=><p key={i}><span className="dot amber-dot"/>{item}</p>)}</div>
      <div className="aside-panel danger"><div className="aside-heading"><ShieldCheck size={20}/><h3>Uygunsuzluk / durdurma</h3></div>{method.stop.map((item,i)=><p key={i}><span className="dot red-dot"/>{item}</p>)}</div>
      <div className="aside-panel footnote"><FileText size={20}/><strong>Önemli bilgi</strong><p>Bu ekran onaylı standardın veya kurum SOP'sinin yerine geçmez. Sayısal limitler ayrıca doğrulanmalıdır.</p></div>
    </aside></div>
  </div>;
}
function SessionDetail({record,onBack,onSaved,notify}){
  const [checks,setChecks]=useState(record.checks||{});
  const [notes,setNotes]=useState(record.notes||'');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{setChecks(record.checks||{});setNotes(record.notes||'');},[record.id]);
  const total=countSteps(record.method_snapshot);
  const completed=Object.values(checks).filter(Boolean).length;
  const readonly=record.status==='completed';
  const save=async final=>{
    setBusy(true);
    try{await api('/field-sessions/'+record.id,{method:'PATCH',body:{checks,notes,status:final?'completed':'in_progress'}});
      notify(final?'Saha kaydı tamamlandı.':'Kontroller kaydedildi.');await onSaved();
    }catch(e){notify(e.message,true);}finally{setBusy(false);}
  };
  return <div className="detail-page"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Saha kayıtlarına dön</button>
    <div className="detail-hero session-hero"><div><span className="eyebrow">SAHA KAYDI · {niceDate(record.created_at)}</span><h1>{record.facility}</h1>
    <p>{record.sampling_point} · {record.method_snapshot.title}</p><div className="inline-tags"><Pill tone={readonly?'green':'amber'}>{readonly?'Tamamlandı':'Devam ediyor'}</Pill><Pill>Metot v{record.method_snapshot.version}</Pill></div></div>
    <div className="session-progress"><strong>{Math.min(completed,total)}/{total}</strong><small>Kontrol adımı</small><div className="tiny-progress"><i style={{width:(total?Math.min(completed/total*100,100):0)+'%'}}/></div></div></div>
    <div className="record-layout"><div className="panel padded">
      <div className="record-intro"><h2>Kontrol listesi</h2><p>Kontrol edilen adımları işaretle. Tamamlanamayan adımda kayıt açık kalsın; sorunu notlara yaz ve teknik sorumluyu bilgilendir.</p></div>
      {record.method_snapshot.phases.map((phase,index)=><div className="record-phase" key={phase.id}>
        <h3><span>{index+1}</span>{phase.title}</h3>
        {phase.items.map((step,i)=>{const key=phase.id+':'+i;return <label key={key} className={'check-row '+(checks[key]?'checked':'')}>
          <input type="checkbox" disabled={readonly} checked={!!checks[key]} onChange={e=>setChecks({...checks,[key]:e.target.checked})}/>
          <span className="custom-check"><Check size={13}/></span><span>{step}</span></label>;})}
      </div>)}
      <label className="field-label note-label">Saha notları / sapmalar<textarea rows={4} disabled={readonly} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ölçüm koşulları, sapmalar, müdahale ve gözlemleri kaydedin..."/></label>
      {!readonly&&<div className="form-actions"><button className="btn btn-outline" disabled={busy} onClick={()=>save(false)}><Save size={16}/> Kaydet</button><button className="btn btn-primary" disabled={busy||completed!==total} onClick={()=>save(true)}><CheckCircle2 size={16}/> Kontrolü tamamla</button></div>}
    </div><aside className="detail-side"><div className="aside-panel warning"><div className="aside-heading"><TriangleAlert size={19}/><h3>Kritik noktalar</h3></div>{record.method_snapshot.critical.map((x,i)=><p key={i}><span className="dot amber-dot"/>{x}</p>)}</div>
      <div className="aside-panel footnote"><ShieldCheck size={18}/><strong>Değişmez metot sürümü</strong><p>Bu oturum, başlatıldığı andaki yöntem içeriğinin kopyasını saklar. Metot sonradan güncellense bile bu kayıt etkilenmez.</p></div></aside></div>
  </div>;
}
function MethodEditor({method,onClose,onSaved,notify}){
  const isNew=!method;
  const initial=method||{id:'',title:'',standard:'',category:'Emisyon',risk:'orta',summary:'',
    critical:[''],stop:[''],phases:[
      {id:'p1',title:'İş öncesi doğrulama',items:['']},
      {id:'p2',title:'Ekipman hazırlığı',items:['']},
      {id:'p3',title:'Saha kurulumu',items:['']},
      {id:'p4',title:'Numune alma / ölçüm',items:['']},
      {id:'p5',title:'Kapatma ve teslim',items:['']}
    ]};
  const [draft,setDraft]=useState(structuredClone(initial));
  const [busy,setBusy]=useState(false);
  const set=(name,value)=>setDraft(d=>({...d,[name]:value}));
  const lines=(key,value)=>set(key,value.split('\n').map(x=>x.trim()).filter(Boolean));
  const phaseChange=(i,field,value)=>setDraft(d=>({...d,phases:d.phases.map((p,j)=>j===i?{...p,[field]:value}:p)}));
  const save=async event=>{
    event.preventDefault();setBusy(true);
    try{await api(isNew?'/methods':'/methods/'+method.id,{method:isNew?'POST':'PUT',body:draft});
      notify('Metot kaydedildi.');await onSaved();onClose();
    }catch(e){notify(e.message,true);}finally{setBusy(false);}
  };
  return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="drawer"><div className="drawer-head"><div><span className="eyebrow">YÖNETİCİ İŞLEMİ</span><h2>{isNew?'Yeni metot ekle':'Metot düzenle'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Kapat"><X size={20}/></button></div>
      <form className="drawer-body stack" onSubmit={save}>
        <div className="form-grid"><label className="field-label">Metot kodu<input disabled={!isNew} value={draft.id} onChange={e=>set('id',e.target.value)} placeholder="K-16" required/></label>
          <label className="field-label">Kategori<select value={draft.category} onChange={e=>set('category',e.target.value)}><option>Emisyon</option><option>İmisyon</option><option>Fiziksel</option><option>Laboratuvar</option></select></label></div>
        <label className="field-label">Metot adı<input value={draft.title} onChange={e=>set('title',e.target.value)} required/></label>
        <label className="field-label">Referans standart<input value={draft.standard} onChange={e=>set('standard',e.target.value)}/></label>
        <label className="field-label">Açıklama<textarea value={draft.summary} onChange={e=>set('summary',e.target.value)} rows={3}/></label>
        <label className="field-label">Kritik noktalar <small>Her satır ayrı madde</small><textarea rows={4} value={draft.critical.join('\n')} onChange={e=>lines('critical',e.target.value)}/></label>
        <label className="field-label">Durdurma / uygunsuzluk uyarıları<textarea rows={4} value={draft.stop.join('\n')} onChange={e=>lines('stop',e.target.value)}/></label>
        <div className="editor-subtitle"><h3>Uygulama aşamaları</h3><p>Her satır yeni bir kontrol adımı olacak.</p></div>
        {draft.phases.map((p,i)=><div className="editor-phase" key={p.id}><span className="eyebrow">AŞAMA {i+1}</span>
          <input aria-label={'Aşama '+(i+1)+' başlığı'} value={p.title} onChange={e=>phaseChange(i,'title',e.target.value)}/>
          <textarea aria-label={'Aşama '+(i+1)+' adımları'} rows={4} value={p.items.join('\n')} onChange={e=>phaseChange(i,'items',e.target.value.split('\n'))}/></div>)}
        <div className="drawer-footer"><button type="button" className="btn btn-outline" onClick={onClose}>Vazgeç</button><button className="btn btn-primary" disabled={busy}><Save size={16}/>{busy?'Kaydediliyor...':'Değişiklikleri kaydet'}</button></div>
      </form>
    </div>
  </div>;
}
function NewSession({methods,methodId,onClose,onSaved,notify}){
  const [id,setId]=useState(methodId||methods[0]?.id||'');
  const [facility,setFacility]=useState('');
  const [samplingPoint,setSamplingPoint]=useState('');
  const [busy,setBusy]=useState(false);
  const submit=async e=>{
    e.preventDefault();setBusy(true);
    try{const result=await api('/field-sessions',{method:'POST',body:{methodId:id,facility,samplingPoint}});
      notify('Yeni saha kaydı oluşturuldu.');await onSaved(result.id);onClose();
    }catch(err){notify(err.message,true);}finally{setBusy(false);}
  };
  return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal"><div className="modal-head"><span className="modal-symbol"><ClipboardCheck size={24}/></span><button className="icon-button" onClick={onClose}><X size={20}/></button></div>
    <h2>Yeni saha kaydı</h2><p className="muted">Hangi yöntemle, hangi tesiste çalışacağını belirle. Kontrol listesi seçilen yöntem sürümüne sabitlenecek.</p>
    <form onSubmit={submit} className="stack">
      <label className="field-label">Metot<select value={id} onChange={e=>setId(e.target.value)} required>{methods.map(m=><option key={m.id} value={m.id}>{m.id} · {m.title}</option>)}</select></label>
      <label className="field-label">Tesis / müşteri<input value={facility} onChange={e=>setFacility(e.target.value)} required placeholder="Örn. A Fabrikası"/></label>
      <label className="field-label">Ölçüm noktası<input value={samplingPoint} onChange={e=>setSamplingPoint(e.target.value)} required placeholder="Örn. Kazan bacası - 1"/></label>
      <div className="form-actions"><button type="button" className="btn btn-outline" onClick={onClose}>Vazgeç</button><button className="btn btn-primary" disabled={busy}>Kaydı oluştur <ArrowRight size={16}/></button></div>
    </form>
  </div></div>;
}
function UsersPage({users,currentUser,onAdd,onUpdate,notify}){
  const [form,setForm]=useState({username:'',fullName:'',password:'',role:'personnel'});
  const [busy,setBusy]=useState(false);
  const [resetId,setResetId]=useState(null);
  const [resetPassword,setResetPassword]=useState('');
  const submit=async e=>{
    e.preventDefault();setBusy(true);
    try{await api('/users',{method:'POST',body:form});notify('Kullanıcı oluşturuldu.');setForm({username:'',fullName:'',password:'',role:'personnel'});await onAdd();}
    catch(err){notify(err.message,true);}finally{setBusy(false);}
  };
  const toggle=async u=>{
    if(u.id===currentUser.id)return;
    if(!window.confirm(u.fullName+' hesabını '+(u.active?'pasifleştirmek':'etkinleştirmek')+' istiyor musunuz?'))return;
    try{await api('/users/'+u.id,{method:'PATCH',body:{active:!u.active}});notify('Kullanıcı güncellendi.');onUpdate();}
    catch(err){notify(err.message,true);}
  };
  const reset=async()=>{
    try{await api('/users/'+resetId,{method:'PATCH',body:{password:resetPassword}});
      notify('Şifre güncellendi; açık oturumlar kapatıldı.');setResetId(null);setResetPassword('');onUpdate();
    }catch(err){notify(err.message,true);}
  };
  return <><SectionHeading kicker="YÖNETİM" title="Kullanıcılar" description="Ekip üyelerini yalnızca yöneticiler oluşturur ve yönetir."/>
    <div className="user-grid"><section className="panel padded"><div className="panel-header"><div><span className="eyebrow">ERİŞİM YÖNETİMİ</span><h2>Ekip üyeleri</h2></div><Pill tone="blue">{users.length} hesap</Pill></div>
      <div className="user-list">{users.map(u=><div className="user-row" key={u.id}>
        <div className="avatar">{u.fullName?.slice(0,1).toUpperCase()}</div>
        <div className="user-info"><strong>{u.fullName}{u.id===currentUser.id&&' (Sen)'}</strong><small>@{u.username} · {u.role==='admin'?'Yönetici':'Personel'}</small></div>
        <Pill tone={u.active?'green':'neutral'}>{u.active?'Aktif':'Kapalı'}</Pill>
        <div className="user-row-actions"><button className="mini-button" onClick={()=>{setResetId(u.id);setResetPassword('');}}>Şifre</button>
          <button disabled={u.id===currentUser.id} className="mini-button" onClick={()=>toggle(u)}>{u.active?'Kapat':'Aç'}</button></div>
      </div>)}</div>
    </section><section className="panel padded"><span className="eyebrow">YENİ PERSONEL</span><h2>Hesap oluştur</h2><p className="muted">Açık kayıt olma özelliği yoktur. Şifreyi personele güvenli kanaldan iletin.</p>
      <form className="stack" onSubmit={submit}><label className="field-label">Ad soyad<input value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} required placeholder="Ad Soyad"/></label>
        <label className="field-label">Kullanıcı adı<input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} required placeholder="ad.soyad"/></label>
        <label className="field-label">Başlangıç şifresi <small>En az 10 karakter</small><input type="password" minLength={10} autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></label>
        <label className="field-label">Rol<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="personnel">Numune alma personeli</option><option value="admin">Yönetici</option></select></label>
        <button className="btn btn-primary btn-wide" disabled={busy}><UserPlus size={16}/> Hesap oluştur</button>
      </form></section></div>
    {resetId&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setResetId(null);}}><div className="modal">
      <div className="modal-head"><span className="modal-symbol"><LockKeyhole size={23}/></span><button className="icon-button" onClick={()=>setResetId(null)}><X size={20}/></button></div>
      <h2>Şifre belirle</h2><p className="muted">Yeni şifre kaydedildiğinde ilgili kullanıcının mevcut oturumları kapatılır.</p>
      <label className="field-label">Yeni şifre<input type="password" minLength={10} value={resetPassword} onChange={e=>setResetPassword(e.target.value)} autoComplete="new-password"/></label>
      <div className="form-actions"><button className="btn btn-outline" onClick={()=>setResetId(null)}>Vazgeç</button><button disabled={resetPassword.length<10} className="btn btn-primary" onClick={reset}>Şifreyi güncelle</button></div></div></div>}
  </>;
}
export default function App(){
  const [user,setUser]=useState(undefined);
  const [page,setPage]=useState('dashboard');
  const [methods,setMethods]=useState([]);
  const [sessions,setSessions]=useState([]);
  const [users,setUsers]=useState([]);
  const [stats,setStats]=useState({});
  const [search,setSearch]=useState('');
  const [methodId,setMethodId]=useState(null);
  const [sessionId,setSessionId]=useState(null);
  const [editing,setEditing]=useState(null);
  const [newSession,setNewSession]=useState(null);
  const [toast,setToast]=useState(null);
  const [mobileMenu,setMobileMenu]=useState(false);
  useEffect(()=>{api('/me').then(r=>setUser(r.user)).catch(()=>setUser(null));},[]);
  async function reload(){
    const [m,s,o]=await Promise.all([api('/methods'),api('/field-sessions'),api('/overview')]);
    setMethods(m.methods);setSessions(s.sessions);setStats(o);
    if(user?.role==='admin'){const u=await api('/users');setUsers(u.users);}
  }
  useEffect(()=>{if(user)reload().catch(e=>notify(e.message,true));},[user?.id]);
  const notify=(message,error=false)=>{
    setToast({message,error});
    window.setTimeout(()=>setToast(null),4600);
  };
  const nav=id=>{setPage(id);setMethodId(null);setSessionId(null);setMobileMenu(false);setSearch('');};
  const method=methods.find(m=>m.id===methodId);
  const session=sessions.find(s=>s.id===sessionId);
  const filtered=useMemo(()=>methods.filter(m=>(m.title+' '+m.id+' '+m.standard+' '+m.category).toLowerCase().includes(search.toLowerCase())),[methods,search]);
  const start=(id='')=>setNewSession(id||'choose');
  const afterSession=async id=>{await reload();setNewSession(null);setPage('sessions');setSessionId(id);};
  const logout=async()=>{try{await api('/logout',{method:'POST',body:{}});}catch{}setUser(null);};
  if(user===undefined)return <div className="boot"><Brand/><div className="spinner"/></div>;
  if(user===null)return <Login onLogin={setUser}/>;
  return <div className="app-shell">
    <aside className={'sidebar '+(mobileMenu?'sidebar-visible':'')}>
      <div className="sidebar-top"><Brand/><button className="mobile-close icon-button" onClick={()=>setMobileMenu(false)}><X size={18}/></button></div>
      <div className="workspace-tag"><span className="workspace-icon"><Activity size={18}/></span><span><strong>Saha Yönetimi</strong><small>Çalışma alanı</small></span><ChevronDown size={15}/></div>
      <div className="nav-label">ÇALIŞMA ALANI</div><nav className="nav">
        {pages.filter(x=>!x.admin||user.role==='admin').map(item=>{const Icon=item.icon;return <button key={item.id} className={'nav-item '+(page===item.id?'active':'')} onClick={()=>nav(item.id)}>
          <Icon size={19}/><span>{item.label}</span>{page===item.id&&<span className="active-indicator"/>}</button>;})}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><ShieldCheck size={19}/><strong>Güvenli saha kayıtları</strong><p>Her kontrol, ilgili personel ve yöntem sürümüyle saklanır.</p></div>
        <div className="profile"><div className="avatar dark">{user.fullName?.slice(0,1).toUpperCase()}</div><div><strong>{user.fullName}</strong><small>{user.role==='admin'?'Yönetici':'Saha Personeli'}</small></div><button title="Çıkış yap" className="icon-button" onClick={logout}><LogOut size={19}/></button></div></div>
    </aside>
    {mobileMenu&&<button className="mobile-shade" onClick={()=>setMobileMenu(false)} aria-label="Menüyü kapat"/>}
    <div className="main-column"><header className="topbar">
      <div className="topbar-left"><button className="icon-button menu-toggle" onClick={()=>setMobileMenu(true)}><Menu size={22}/></button><span className="breadcrumb">LABCORE</span><ChevronRight size={15}/><strong>{pages.find(p=>p.id===page)?.label}</strong></div>
      <div className="topbar-right"><span className="topbar-pill"><span className="online-dot"/> Sistem aktif</span><span className="top-avatar">{user.fullName?.slice(0,1).toUpperCase()}</span></div>
    </header>
    <main className="main-content">
      {page==='dashboard'&&<Dashboard user={user} stats={stats} methods={methods} sessions={sessions} onGo={nav} onSelectMethod={id=>{setPage('methods');setMethodId(id);}} onSelectSession={id=>{setPage('sessions');setSessionId(id);}} onStart={()=>start()}/>}
      {page==='methods'&&(method?<MethodDetail method={method} isAdmin={user.role==='admin'} onBack={()=>setMethodId(null)}
        onEdit={()=>setEditing(method)} onStart={()=>start(method.id)}/>:
        <><SectionHeading kicker="METOT VE PROSEDÜRLER" title="Metot Kütüphanesi" description="Emisyon ve imisyon yöntemlerini keşfet, kritik noktaları öğren, adım adım ilerle."
          action={user.role==='admin'&&<button className="btn btn-primary" onClick={()=>setEditing('new')}><Plus size={17}/> Yeni metot</button>}/>
          <div className="filter-bar"><div className="search-field"><Search size={18}/><input placeholder="Metot, standart veya parametre ara..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
            <span className="filter-count"><SlidersHorizontal size={16}/>{filtered.length} metot</span></div>
          {filtered.length?<div className="methods-grid">{filtered.map(m=><MethodCard key={m.id} method={m} onClick={()=>setMethodId(m.id)}/>)}</div>:
            <Empty icon={Search} title="Metot bulunamadı" detail="Farklı bir arama terimi deneyin."/>}
        </>)}
      {page==='sessions'&&(session?<SessionDetail record={session} onBack={()=>setSessionId(null)} onSaved={reload} notify={notify}/>:
        <><SectionHeading kicker="SAHA İŞ AKIŞLARI" title="Saha Kayıtları" description="Numune alma oturumlarını yönet ve çalışma geçmişini görüntüle."
          action={<button className="btn btn-primary" onClick={()=>start()}><Plus size={17}/> Yeni kayıt</button>}/>
          {sessions.length?<div className="session-grid">{sessions.map(s=><button key={s.id} className="session-card" onClick={()=>setSessionId(s.id)}>
            <div className="session-card-head"><span className="session-icon"><ClipboardCheck size={20}/></span><Pill tone={s.status==='completed'?'green':'amber'}>{s.status==='completed'?'Tamamlandı':'Devam ediyor'}</Pill></div>
            <h3>{s.facility}</h3><p>{s.sampling_point}</p><div className="session-method">{s.method_snapshot.title}</div>
            <div className="tiny-progress"><i style={{width:progress(s)+'%'}}/></div>
            <div className="session-card-footer"><span>{progress(s)}% · {s.owner_name}</span><span>{niceDate(s.updated_at)} <ArrowRight size={15}/></span></div>
          </button>)}</div>:<Empty icon={ClipboardCheck} title="Henüz saha kaydı yok" detail="Yeni kayıt oluşturarak kontrol listelerini kullanmaya başlayın."/>}
        </>)}
      {page==='users'&&user.role==='admin'&&<UsersPage users={users} currentUser={user} onAdd={reload} onUpdate={reload} notify={notify}/>}
      <footer className="footer">© {new Date().getFullYear()} LABCORE <span>·</span> Emisyon & İmisyon Dijital El Kitabı <span className="footer-right">Taslak yöntem içerikleri · v0.1.0</span></footer>
    </main></div>
    {editing&&<MethodEditor key={editing==='new'?'new':editing.id} method={editing==='new'?null:editing} onClose={()=>setEditing(null)} onSaved={reload} notify={notify}/>}
    {newSession&&<NewSession methods={methods} methodId={newSession==='choose'?'':newSession} onClose={()=>setNewSession(null)} onSaved={afterSession} notify={notify}/>}
    {toast&&<div className={'toast '+(toast.error?'toast-error':'')}><span>{toast.error?<TriangleAlert size={18}/>:<CheckCircle2 size={18}/>}</span>{toast.message}<button onClick={()=>setToast(null)}><X size={15}/></button></div>}
  </div>;
}

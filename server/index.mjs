import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, uuid, now, validUsername, audit, initializeDatabase, methodFromDb, sessionFromDb } from './db.mjs';

const app=express();
const production=process.env.NODE_ENV==='production';
const cookieName='labcore_session';
const port=Number(process.env.PORT||4000);
const hashToken=token=>crypto.createHash('sha256').update(token).digest('hex');
const clean=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
const fail=(res,status,error)=>res.status(status).json({error});
const wrap=fn=>(req,res,next)=>{
  try { return Promise.resolve(fn(req,res,next)).catch(next); } catch (error) { next(error); }
};
const safeUser=user=>({id:user.id,username:user.username,fullName:user.full_name,
  role:user.role,active:!!user.active});

app.set('trust proxy',1);
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:production?{
  directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],
    styleSrc:["'self'",'https://fonts.googleapis.com'],
    fontSrc:["'self'",'https://fonts.gstatic.com'],
    imgSrc:["'self'",'data:'],connectSrc:["'self'"]}
}:false}));
app.use(express.json({limit:'256kb'}));
app.use(cookieParser());

// Çerezli oturumlar için aynı-origin kontrolü; farklı siteye CORS açılmıyor.
app.use('/api',(req,res,next)=>{
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)){
    const origin=req.get('origin');
    const host=req.get('x-forwarded-host')||req.get('host');
    const own=(production?'https://':req.protocol+'://')+host;
    const allowed=[own,process.env.APP_ORIGIN];
    if(!production)allowed.push('http://localhost:5173');
    if(origin&&!allowed.includes(origin))return fail(res,403,'İstek kaynağına izin verilmedi.');
    if(!req.is('application/json'))return fail(res,415,'JSON gövdesi gerekli.');
  }
  next();
});

const loginLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',
  legacyHeaders:false,message:{error:'Çok fazla giriş denemesi. Bir süre sonra tekrar deneyin.'}});

function auth(req,res,next){
  try{
    const token=req.cookies[cookieName];
    if(!token||!/^[a-f0-9]{64}$/.test(token))return fail(res,401,'Oturum gerekli.');
    const user=db.prepare(
      'SELECT u.id,u.username,u.full_name,u.role,u.active FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?'
    ).get(hashToken(token),Date.now());
    if(!user?.active)return fail(res,401,'Oturum geçersiz.');
    req.user=user;next();
  }catch(error){next(error);}
}
function admin(req,res,next){
  if(req.user.role!=='admin')return fail(res,403,'Yönetici yetkisi gerekiyor.');
  next();
}
function setCookie(res,token){
  res.cookie(cookieName,token,{path:'/',httpOnly:true,sameSite:'lax',
    secure:production,maxAge:14*86400000});
}

app.get('/api/health',wrap((req,res)=>{
  db.prepare('SELECT 1').get();res.json({ok:true,db:'sqlite'});
}));
app.post('/api/login',loginLimiter,wrap(async(req,res)=>{
  const username=clean(req.body?.username,32).toLowerCase();
  const password=req.body?.password;
  if(!validUsername(username)||typeof password!=='string')
    return fail(res,400,'Kullanıcı adı veya şifre hatalı.');
  const user=db.prepare('SELECT * FROM users WHERE username=?').get(username);
  const dummy='$2a$12$wTZZz8Irp5WraU4yRhWWOuNyB/DX4pqrdgOJR2MXVIpq/B.fxnRl6';
  const good=await bcrypt.compare(password,user?.password_hash||dummy);
  if(!user||!user.active||!good)return fail(res,401,'Kullanıcı adı veya şifre hatalı.');
  const token=crypto.randomBytes(32).toString('hex');
  db.transaction(()=>{
    db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
      .run(hashToken(token),user.id,Date.now()+14*86400000);
    audit(user.id,'login','session');
  })();
  setCookie(res,token);res.json({user:safeUser(user)});
}));
app.post('/api/logout',auth,wrap((req,res)=>{
  db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(hashToken(req.cookies[cookieName]));
  res.clearCookie(cookieName,{path:'/',secure:production,httpOnly:true,sameSite:'lax'});
  res.json({ok:true});
}));
app.get('/api/me',auth,(req,res)=>res.json({user:safeUser(req.user)}));
app.get('/api/overview',auth,wrap((req,res)=>{
  const methods=db.prepare('SELECT COUNT(*) AS n FROM methods').get().n;
  const users=db.prepare('SELECT COUNT(*) AS n FROM users WHERE active=1').get().n;
  const sessions=req.user.role==='admin'
    ?db.prepare('SELECT COUNT(*) AS n FROM field_sessions').get().n
    :db.prepare('SELECT COUNT(*) AS n FROM field_sessions WHERE user_id=?').get(req.user.id).n;
  res.json({methods,users,sessions});
}));
app.get('/api/methods',auth,wrap((req,res)=>{
  const rows=db.prepare('SELECT * FROM methods ORDER BY id').all();
  res.json({methods:rows.map(methodFromDb)});
}));
function validateMethod(method,isNew=false){
  if(isNew&&!/^[A-Z0-9_-]{3,40}$/.test(clean(method.id,40).toUpperCase()))return false;
  if(!clean(method.title)||!Array.isArray(method.critical)||!Array.isArray(method.stop)||
    !Array.isArray(method.phases)||method.phases.length>20||method.phases.length<1||
    method.critical.length>100||method.stop.length>100)return false;
  return method.phases.every(phase=>typeof phase.title==='string'&&
    Array.isArray(phase.items)&&phase.items.length<=100&&
    phase.items.every(item=>typeof item==='string'));
}
function validatedPhases(phases){
  return phases.map(p=>({id:clean(p.id,40)||uuid(),title:clean(p.title),
    items:p.items.map(item=>clean(item,700)).filter(Boolean)}));
}
app.post('/api/methods',auth,admin,wrap((req,res)=>{
  const body=req.body||{};
  if(!validateMethod(body,true))return fail(res,400,'Metot kodu, başlığı veya adımları geçersiz.');
  const id=clean(body.id,40).toUpperCase();
  db.transaction(()=>{
    db.prepare(
      'INSERT INTO methods(id,title,standard,category,risk,summary,critical,stop,phases,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
    ).run(id,clean(body.title),clean(body.standard),clean(body.category),clean(body.risk),
      clean(body.summary,2500),JSON.stringify(body.critical.map(s=>clean(s,600))),
      JSON.stringify(body.stop.map(s=>clean(s,600))),
      JSON.stringify(validatedPhases(body.phases)),now(),req.user.id);
    audit(req.user.id,'method.create',id);
  })();
  res.status(201).json({ok:true});
}));
app.put('/api/methods/:id',auth,admin,wrap((req,res)=>{
  const body=req.body||{};
  if(!validateMethod(body))return fail(res,400,'Başlık, uyarılar ve adımların biçimi geçersiz.');
  const old=db.prepare('SELECT version FROM methods WHERE id=?').get(req.params.id);
  if(!old)return fail(res,404,'Metot bulunamadı.');
  if(body.version!==undefined && body.version!==old.version)
    return fail(res,409,'Bu metot başka bir yönetici tarafından güncellendi. Sayfayı yenileyin.');
  const nextVersion=old.version+1;
  db.transaction(()=>{
    db.prepare(
      'UPDATE methods SET title=?,standard=?,category=?,risk=?,summary=?,critical=?,stop=?,phases=?,version=?,updated_at=?,updated_by=? WHERE id=?'
    ).run(clean(body.title),clean(body.standard),clean(body.category),clean(body.risk),
      clean(body.summary,2500),JSON.stringify(body.critical.map(s=>clean(s,600))),
      JSON.stringify(body.stop.map(s=>clean(s,600))),
      JSON.stringify(validatedPhases(body.phases)),nextVersion,now(),req.user.id,req.params.id);
    audit(req.user.id,'method.update',req.params.id,{version:nextVersion});
  })();
  res.json({ok:true,version:nextVersion});
}));

app.get('/api/users',auth,admin,wrap((req,res)=>{
  const users=db.prepare('SELECT id,username,full_name,role,active FROM users ORDER BY username').all();
  res.json({users:users.map(safeUser)});
}));
app.post('/api/users',auth,admin,wrap(async(req,res)=>{
  const username=clean(req.body?.username,32).toLowerCase();
  const fullName=clean(req.body?.fullName,120);
  const password=req.body?.password;
  const role=req.body?.role==='admin'?'admin':'personnel';
  if(!validUsername(username)||!fullName||typeof password!=='string'||password.length<10||password.length>128)
    return fail(res,400,'Kullanıcı adı (3–32), ad soyad ve en az 10 karakterli şifre gerekli.');
  const passwordHash=await bcrypt.hash(password,12);
  const id=uuid();
  db.transaction(()=>{
    db.prepare('INSERT INTO users(id,username,full_name,password_hash,role,active,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(id,username,fullName,passwordHash,role,1,now());
    audit(req.user.id,'user.create',id,{username,role});
  })();
  res.status(201).json({user:{id,username,fullName,role,active:true}});
}));
app.patch('/api/users/:id',auth,admin,wrap(async(req,res)=>{
  const old=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if(!old)return fail(res,404,'Kullanıcı bulunamadı.');
  const body=req.body||{};
  if(body.active===undefined&&body.role===undefined&&body.password===undefined)
    return fail(res,400,'Güncellenecek alan yok.');
  if(body.role!==undefined&&!['admin','personnel'].includes(body.role))
    return fail(res,400,'Geçersiz yetki.');
  if(body.active!==undefined&&typeof body.active!=='boolean')
    return fail(res,400,'Hesap durumu geçersiz.');
  if(body.password!==undefined&&(typeof body.password!=='string'||
    body.password.length<10||body.password.length>128))
    return fail(res,400,'Şifre en az 10 karakter olmalı.');
  const active=body.active===undefined?old.active:Number(body.active);
  const role=body.role||old.role;
  if(old.id===req.user.id&&(!active||role!=='admin'))
    return fail(res,400,'Kendi yönetici hesabınızı kapatamazsınız.');
  const hash=body.password===undefined?old.password_hash:await bcrypt.hash(body.password,12);
  db.transaction(()=>{
    if(old.role==='admin'&&(!active||role!=='admin')){
      const count=db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1").get().n;
      if(count<=1)throw Object.assign(new Error('Son aktif yönetici kapatılamaz.'),{status:400});
    }
    db.prepare('UPDATE users SET active=?,role=?,password_hash=? WHERE id=?')
      .run(active,role,hash,old.id);
    if(!active||body.role!==undefined||body.password!==undefined)
      db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(old.id);
    audit(req.user.id,'user.update',old.id,{active:!!active,role,
      passwordChanged:body.password!==undefined});
  })();
  res.json({ok:true});
}));

app.get('/api/field-sessions',auth,wrap((req,res)=>{
  const query='SELECT s.*,u.full_name AS owner_name FROM field_sessions s JOIN users u ON u.id=s.user_id ';
  const rows=req.user.role==='admin'
    ?db.prepare(query+'ORDER BY s.updated_at DESC LIMIT 100').all()
    :db.prepare(query+'WHERE s.user_id=? ORDER BY s.updated_at DESC LIMIT 100').all(req.user.id);
  res.json({sessions:rows.map(sessionFromDb)});
}));
app.post('/api/field-sessions',auth,wrap((req,res)=>{
  const methodId=clean(req.body?.methodId,40);
  const facility=clean(req.body?.facility,150);
  const point=clean(req.body?.samplingPoint,150);
  if(!methodId||!facility||!point)return fail(res,400,'Metot, tesis ve numune noktası gerekli.');
  const row=db.prepare('SELECT * FROM methods WHERE id=?').get(methodId);
  if(!row)return fail(res,404,'Metot bulunamadı.');
  const id=uuid(),timestamp=now();
  db.transaction(()=>{
    db.prepare('INSERT INTO field_sessions(id,method_id,method_snapshot,user_id,facility,sampling_point,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(id,methodId,JSON.stringify(methodFromDb(row)),req.user.id,facility,point,timestamp,timestamp);
    audit(req.user.id,'field.create',id,{methodId,facility});
  })();
  res.status(201).json({id});
}));
app.patch('/api/field-sessions/:id',auth,wrap((req,res)=>{
  const original=db.prepare('SELECT * FROM field_sessions WHERE id=?').get(req.params.id);
  if(!original)return fail(res,404,'Saha kaydı bulunamadı.');
  if(original.user_id!==req.user.id&&req.user.role!=='admin')
    return fail(res,403,'Erişim yetkisi yok.');
  if(original.status==='completed')return fail(res,409,'Tamamlanmış kayıt değiştirilemez.');
  const checks=req.body?.checks;
  if(!checks||typeof checks!=='object'||Array.isArray(checks)||
    Object.keys(checks).length>500||Object.values(checks).some(x=>typeof x!=='boolean'))
    return fail(res,400,'Kontrol alanları geçersiz.');
  const status=req.body?.status==='completed'?'completed':'in_progress';
  if(status==='completed'){
    const snap=sessionFromDb(original).method_snapshot;
    const expected=(snap.phases||[]).flatMap(p=>p.items.map((_,i)=>p.id+':'+i));
    if(!expected.every(key=>checks[key]===true))
      return fail(res,400,'Kaydı tamamlamak için tüm adımlar işaretlenmeli.');
  }
  const timestamp=now();
  db.transaction(()=>{
    db.prepare('UPDATE field_sessions SET checks=?,notes=?,status=?,updated_at=?,completed_at=? WHERE id=?')
      .run(JSON.stringify(checks),clean(req.body?.notes,10000),status,timestamp,
        status==='completed'?timestamp:null,original.id);
    audit(req.user.id,'field.update',original.id,{status});
  })();
  res.json({ok:true});
}));

app.use('/api',(req,res)=>fail(res,404,'API yolu bulunamadı.'));
if(production){
  const dist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
  app.use(express.static(dist,{index:false}));
  app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));
}else app.get('/',(req,res)=>res.send('LABCORE API hazır. Panel için http://localhost:5173'));
app.use((error,req,res,next)=>{
  console.error(error);
  if(error.code==='SQLITE_CONSTRAINT_UNIQUE')return fail(res,409,'Bu kayıt zaten mevcut.');
  if(error.type==='entity.too.large')return fail(res,413,'İstek fazla büyük.');
  if(error.status===400)return fail(res,400,error.message);
  fail(res,500,'Sunucu hatası.');
});

try{
  initializeDatabase();
  // Linux sunucusunda yalnızca reverse proxy üzerinden erişilebilir.
  app.listen(port,production?'127.0.0.1':'0.0.0.0',()=>console.log('LABCORE SQLite API port '+port));
}catch(error){
  console.error('Kurulum hatası:',error.message);
  process.exit(1);
}

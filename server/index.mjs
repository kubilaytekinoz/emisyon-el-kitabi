import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, uuid, validUsername, audit, initializeDatabase } from './db.mjs';

const app=express();
const production=process.env.NODE_ENV==='production';
const cookie='labcore_session';
const port=Number(process.env.PORT||4000);
const hashToken=token=>crypto.createHash('sha256').update(token).digest('hex');
const clean=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
const fail=(res,status,error)=>res.status(status).json({error});
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const safeUser=u=>({id:u.id,username:u.username,fullName:u.full_name,role:u.role,active:u.active});

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
app.use('/api',(req,res,next)=>{
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)){
    const origin=req.get('origin');
    const host=req.get('x-forwarded-host')||req.get('host');
    const here=(production?'https://':req.protocol+'://')+host;
    const allowed=[here,process.env.APP_ORIGIN];
    if(!production)allowed.push('http://localhost:5173');
    if(origin&&!allowed.includes(origin))return fail(res,403,'İstek kaynağına izin verilmedi.');
    if(!req.is('application/json'))return fail(res,415,'JSON gövdesi gerekli.');
  }
  next();
});
const limiter=rateLimit({windowMs:15*60*1000,limit:8,
  standardHeaders:'draft-7',legacyHeaders:false,
  message:{error:'Çok fazla giriş denemesi. Bir süre sonra tekrar deneyin.'}});
async function auth(req,res,next){
  try{
    const token=req.cookies[cookie];
    if(!token||!/^[a-f0-9]{64}$/.test(token))return fail(res,401,'Oturum gerekli.');
    const result=await pool.query(
      'SELECT u.id,u.username,u.full_name,u.role,u.active FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()',
      [hashToken(token)]);
    if(!result.rows[0]?.active)return fail(res,401,'Oturum geçersiz.');
    req.user=result.rows[0];next();
  }catch(error){next(error);}
}
function admin(req,res,next){
  if(req.user.role!=='admin')return fail(res,403,'Yönetici yetkisi gerekiyor.');
  next();
}
function setCookie(res,token){
  res.cookie(cookie,token,{path:'/',httpOnly:true,sameSite:'lax',
    secure:production,maxAge:14*86400000});
}

app.get('/api/health',wrap(async(req,res)=>{
  await pool.query('SELECT 1');res.json({ok:true});
}));
app.post('/api/login',limiter,wrap(async(req,res)=>{
  const username=clean(req.body?.username,32).toLowerCase();
  const password=req.body?.password;
  if(!validUsername(username)||typeof password!=='string')
    return fail(res,400,'Kullanıcı adı veya şifre hatalı.');
  const result=await pool.query('SELECT * FROM users WHERE username=$1',[username]);
  const user=result.rows[0];
  const dummy='$2a$12$wTZZz8Irp5WraU4yRhWWOuNyB/DX4pqrdgOJR2MXVIpq/B.fxnRl6';
  const good=await bcrypt.compare(password,user?.password_hash||dummy);
  if(!user||!user.active||!good)return fail(res,401,'Kullanıcı adı veya şifre hatalı.');
  const token=crypto.randomBytes(32).toString('hex');
  await pool.query("INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '14 days')",
    [hashToken(token),user.id]);
  setCookie(res,token);
  await audit(user.id,'login','session');
  res.json({user:safeUser(user)});
}));
app.post('/api/logout',auth,wrap(async(req,res)=>{
  await pool.query('DELETE FROM auth_sessions WHERE token_hash=$1',[hashToken(req.cookies[cookie])]);
  res.clearCookie(cookie,{path:'/',secure:production,httpOnly:true,sameSite:'lax'});
  res.json({ok:true});
}));
app.get('/api/me',auth,(req,res)=>res.json({user:safeUser(req.user)}));
app.get('/api/overview',auth,wrap(async(req,res)=>{
  const a=await pool.query('SELECT COUNT(*)::int n FROM methods');
  const b=await pool.query('SELECT COUNT(*)::int n FROM users WHERE active=true');
  const c=req.user.role==='admin'
    ?await pool.query('SELECT COUNT(*)::int n FROM field_sessions')
    :await pool.query('SELECT COUNT(*)::int n FROM field_sessions WHERE user_id=$1',[req.user.id]);
  res.json({methods:a.rows[0].n,users:b.rows[0].n,sessions:c.rows[0].n});
}));
app.get('/api/methods',auth,wrap(async(req,res)=>{
  const result=await pool.query('SELECT * FROM methods ORDER BY id');
  res.json({methods:result.rows});
}));
app.post('/api/methods',auth,admin,wrap(async(req,res)=>{
  const b=req.body||{};
  const id=clean(b.id,40).toUpperCase();
  if(!/^[A-Z0-9_-]{3,40}$/.test(id)||!clean(b.title)||!Array.isArray(b.phases))
    return fail(res,400,'Metot kodu, başlığı ve adımları gerekli.');
  await pool.query(
    'INSERT INTO methods(id,title,standard,category,risk,summary,critical,stop,phases,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [id,clean(b.title),clean(b.standard),clean(b.category),clean(b.risk),
      clean(b.summary,2500),JSON.stringify(b.critical||[]),
      JSON.stringify(b.stop||[]),JSON.stringify(b.phases),req.user.id]);
  await audit(req.user.id,'method.create',id);
  res.status(201).json({ok:true});
}));
app.put('/api/methods/:id',auth,admin,wrap(async(req,res)=>{
  const b=req.body||{};
  if(!clean(b.title)||!Array.isArray(b.critical)||!Array.isArray(b.stop)||
      !Array.isArray(b.phases)||b.phases.length>20||
      b.phases.some(p=>typeof p.title!=='string'||!Array.isArray(p.items)||
        p.items.some(item=>typeof item!=='string')))
    return fail(res,400,'Başlık, uyarılar ve adımların biçimi geçersiz.');
  const phases=b.phases.map(p=>({id:clean(p.id,40)||uuid(),title:clean(p.title),
    items:p.items.map(item=>clean(item,700)).filter(Boolean)}));
  const result=await pool.query(
    'UPDATE methods SET title=$2,standard=$3,category=$4,risk=$5,summary=$6,critical=$7,stop=$8,phases=$9,version=version+1,updated_at=NOW(),updated_by=$10 WHERE id=$1 RETURNING version',
    [req.params.id,clean(b.title),clean(b.standard),clean(b.category),
      clean(b.risk),clean(b.summary,2500),
      JSON.stringify(b.critical.map(x=>clean(x,600))),
      JSON.stringify(b.stop.map(x=>clean(x,600))),
      JSON.stringify(phases),req.user.id]);
  if(!result.rows.length)return fail(res,404,'Metot bulunamadı.');
  await audit(req.user.id,'method.update',req.params.id,{version:result.rows[0].version});
  res.json({ok:true,version:result.rows[0].version});
}));

app.get('/api/users',auth,admin,wrap(async(req,res)=>{
  const result=await pool.query('SELECT id,username,full_name,role,active FROM users ORDER BY username');
  res.json({users:result.rows.map(safeUser)});
}));
app.post('/api/users',auth,admin,wrap(async(req,res)=>{
  const username=clean(req.body?.username,32).toLowerCase();
  const fullName=clean(req.body?.fullName,120);
  const password=req.body?.password;
  const role=req.body?.role==='admin'?'admin':'personnel';
  if(!validUsername(username)||!fullName||typeof password!=='string'||password.length<10||password.length>128)
    return fail(res,400,'Kullanıcı adı (3–32), ad soyad ve en az 10 karakterli şifre gerekli.');
  const id=uuid();
  try{
    await pool.query(
      'INSERT INTO users(id,username,full_name,password_hash,role) VALUES($1,$2,$3,$4,$5)',
      [id,username,fullName,await bcrypt.hash(password,12),role]);
  }catch(e){if(e.code==='23505')return fail(res,409,'Bu kullanıcı adı kullanılıyor.');throw e;}
  await audit(req.user.id,'user.create',id,{username,role});
  res.status(201).json({user:{id,username,fullName,role,active:true}});
}));
app.patch('/api/users/:id',auth,admin,wrap(async(req,res)=>{
  const result=await pool.query('SELECT * FROM users WHERE id=$1',[req.params.id]);
  if(!result.rows.length)return fail(res,404,'Kullanıcı bulunamadı.');
  const old=result.rows[0],body=req.body||{};
  if(body.active===undefined&&body.role===undefined&&body.password===undefined)
    return fail(res,400,'Güncellenecek alan yok.');
  if(body.role!==undefined&&!['admin','personnel'].includes(body.role))
    return fail(res,400,'Geçersiz yetki.');
  if(body.password!==undefined&&(typeof body.password!=='string'||body.password.length<10||body.password.length>128))
    return fail(res,400,'Şifre en az 10 karakter olmalı.');
  const nextActive=typeof body.active==='boolean'?body.active:old.active;
  const nextRole=body.role||old.role;
  if(old.id===req.user.id&&(!nextActive||nextRole!=='admin'))
    return fail(res,400,'Kendi yönetici hesabınızı kapatamazsınız.');
  if(old.role==='admin'&&(!nextActive||nextRole!=='admin')){
    const count=await pool.query("SELECT COUNT(*)::int n FROM users WHERE role='admin' AND active=true");
    if(count.rows[0].n<=1)return fail(res,400,'Son aktif yönetici kapatılamaz.');
  }
  await pool.query('UPDATE users SET active=$2,role=$3,password_hash=$4 WHERE id=$1',
    [old.id,nextActive,nextRole,
      body.password!==undefined?await bcrypt.hash(body.password,12):old.password_hash]);
  if(!nextActive||body.role!==undefined||body.password!==undefined)
    await pool.query('DELETE FROM auth_sessions WHERE user_id=$1',[old.id]);
  await audit(req.user.id,'user.update',old.id,{active:nextActive,role:nextRole,
    passwordChanged:body.password!==undefined});
  res.json({ok:true});
}));

app.get('/api/field-sessions',auth,wrap(async(req,res)=>{
  const own=req.user.role==='admin'?'':'WHERE s.user_id=$1 ';
  const result=await pool.query(
    'SELECT s.*,u.full_name owner_name FROM field_sessions s JOIN users u ON u.id=s.user_id '
    +own+'ORDER BY s.updated_at DESC LIMIT 100',
    own?[req.user.id]:[]);
  res.json({sessions:result.rows});
}));
app.post('/api/field-sessions',auth,wrap(async(req,res)=>{
  const methodId=clean(req.body?.methodId,40);
  const facility=clean(req.body?.facility,150);
  const point=clean(req.body?.samplingPoint,150);
  if(!methodId||!facility||!point)return fail(res,400,'Metot, tesis ve numune noktası gerekli.');
  const result=await pool.query('SELECT * FROM methods WHERE id=$1',[methodId]);
  if(!result.rows.length)return fail(res,404,'Metot bulunamadı.');
  const id=uuid();
  await pool.query(
    'INSERT INTO field_sessions(id,method_id,method_snapshot,user_id,facility,sampling_point) VALUES($1,$2,$3,$4,$5,$6)',
    [id,methodId,JSON.stringify(result.rows[0]),req.user.id,facility,point]);
  await audit(req.user.id,'field.create',id,{methodId,facility});
  res.status(201).json({id});
}));
app.patch('/api/field-sessions/:id',auth,wrap(async(req,res)=>{
  const result=await pool.query('SELECT * FROM field_sessions WHERE id=$1',[req.params.id]);
  if(!result.rows.length)return fail(res,404,'Saha kaydı bulunamadı.');
  const s=result.rows[0];
  if(s.user_id!==req.user.id&&req.user.role!=='admin')return fail(res,403,'Erişim yetkisi yok.');
  if(s.status==='completed')return fail(res,409,'Tamamlanmış kayıt değiştirilemez.');
  const checks=req.body?.checks;
  if(!checks||typeof checks!=='object'||Array.isArray(checks)||
      Object.keys(checks).length>500||Object.values(checks).some(x=>typeof x!=='boolean'))
    return fail(res,400,'Kontrol alanları geçersiz.');
  const status=req.body?.status==='completed'?'completed':'in_progress';
  if(status==='completed'){
    const expected=s.method_snapshot.phases.flatMap(p=>p.items.map((_,i)=>p.id+':'+i));
    if(!expected.every(k=>checks[k]===true))
      return fail(res,400,'Kaydı tamamlamak için tüm adımlar işaretlenmeli.');
  }
  await pool.query(
    'UPDATE field_sessions SET checks=$2,notes=$3,status=$4,updated_at=NOW(),completed_at=CASE WHEN $4=$5 THEN NOW() ELSE NULL END WHERE id=$1',
    [s.id,JSON.stringify(checks),clean(req.body?.notes,10000),status,'completed']);
  await audit(req.user.id,'field.update',s.id,{status});
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
  if(error.code==='23505')return fail(res,409,'Kayıt zaten mevcut.');
  if(error.type==='entity.too.large')return fail(res,413,'İstek fazla büyük.');
  fail(res,500,'Sunucu hatası.');
});
initializeDatabase()
  .then(()=>app.listen(port,production?'127.0.0.1':'0.0.0.0',()=>console.log('LABCORE API port '+port)))
  .catch(error=>{console.error('Kurulum hatası:',error.message);process.exit(1);});

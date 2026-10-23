import 'dotenv/config';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defaultMethods } from './seed.mjs';

const defaultPath=process.env.NODE_ENV==='production'
  ? '/var/lib/labcore/labcore.sqlite'
  : path.resolve('data/labcore.sqlite');
export const databasePath=path.resolve(process.env.DATABASE_PATH||defaultPath);
fs.mkdirSync(path.dirname(databasePath),{recursive:true,mode:0o700});
// Public repo içinde hiçbir gerçek kullanıcı verisi veya parola saklanmaz.
process.umask(0o077);
export const db=new Database(databasePath,{timeout:5000});
fs.chmodSync(databasePath,0o600);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');

export const uuid=()=>crypto.randomUUID();
export const validUsername=value=>typeof value==='string' && /^[a-z0-9_.-]{3,32}$/.test(value);
export const now=()=>new Date().toISOString();
export const parseJson=(value,fallback)=>{
  try {return JSON.parse(value);} catch {return fallback;}
};

export function audit(actor,action,entity,details={}){
  db.prepare('INSERT INTO audit_events(id,actor_id,action,entity,details,created_at) VALUES(?,?,?,?,?,?)')
    .run(uuid(),actor,action,entity,JSON.stringify(details),now());
}
export function methodFromDb(row){
  return row&&{...row,critical:parseJson(row.critical,[]),
    stop:parseJson(row.stop,[]),phases:parseJson(row.phases,[])};
}
export function sessionFromDb(row){
  return row&&{...row,checks:parseJson(row.checks,{}),
    method_snapshot:parseJson(row.method_snapshot,{phases:[]})};
}
export function initializeDatabase(){
  db.exec([
    "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,full_name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','personnel')),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON auth_sessions(expires_at)",
    "CREATE TABLE IF NOT EXISTS methods (id TEXT PRIMARY KEY,title TEXT NOT NULL,standard TEXT NOT NULL,category TEXT,risk TEXT,summary TEXT,critical TEXT NOT NULL DEFAULT '[]',stop TEXT NOT NULL DEFAULT '[]',phases TEXT NOT NULL DEFAULT '[]',version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL,updated_by TEXT REFERENCES users(id))",
    "CREATE TABLE IF NOT EXISTS field_sessions (id TEXT PRIMARY KEY,method_id TEXT NOT NULL REFERENCES methods(id),method_snapshot TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),facility TEXT NOT NULL,sampling_point TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed')),checks TEXT NOT NULL DEFAULT '{}',notes TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,completed_at TEXT)",
    "CREATE INDEX IF NOT EXISTS fields_user_updated_idx ON field_sessions(user_id,updated_at)",
    "CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id),action TEXT NOT NULL,entity TEXT NOT NULL,details TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL)"
  ].join(';')+';');

  if(db.prepare('SELECT COUNT(*) AS n FROM users').get().n===0){
    const username=process.env.ADMIN_USERNAME?.trim().toLowerCase();
    const password=process.env.ADMIN_PASSWORD;
    if(!validUsername(username)||typeof password!=='string'||password.length<10)
      throw new Error('İlk kurulum için ADMIN_USERNAME ve en az 10 karakterli ADMIN_PASSWORD gereklidir. Şifreyi GitHub’a yazmayın.');
    db.prepare('INSERT INTO users(id,username,full_name,password_hash,role,active,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(uuid(),username,'Sistem Yöneticisi',bcrypt.hashSync(password,12),'admin',1,now());
    console.log('İlk yönetici hesabı oluşturuldu:',username);
  }
  if(db.prepare('SELECT COUNT(*) AS n FROM methods').get().n===0){
    const insert=db.prepare(
      'INSERT INTO methods(id,title,standard,category,risk,summary,critical,stop,phases,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)'
    );
    db.transaction(()=>{
      for(const m of defaultMethods){
        insert.run(m.id,m.title,m.standard,m.category,m.risk,m.summary,
          JSON.stringify(m.critical),JSON.stringify(m.stop),JSON.stringify(m.phases),now());
      }
    })();
    console.log(defaultMethods.length+' taslak metot kartı yüklendi.');
  }
  db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(Date.now());
}

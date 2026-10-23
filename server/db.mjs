import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { defaultMethods } from './seed.mjs';

export const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});
export const uuid = () => crypto.randomUUID();
export const validUsername = value => typeof value==='string' && /^[a-z0-9_.-]{3,32}$/.test(value);

export async function audit(actor,action,entity,details={}){
  await pool.query(
    'INSERT INTO audit_events(id,actor_id,action,entity,details) VALUES($1,$2,$3,$4,$5)',
    [uuid(),actor,action,entity,JSON.stringify(details)]
  );
}

export async function initializeDatabase(){
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL ortam değişkeni eksik.');
  await pool.query('SELECT 1');
  const statements=[
    "CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY,username VARCHAR(32) UNIQUE NOT NULL,full_name VARCHAR(120) NOT NULL,password_hash TEXT NOT NULL,role VARCHAR(12) NOT NULL CHECK (role IN ('admin','personnel')),active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    "CREATE TABLE IF NOT EXISTS auth_sessions (token_hash CHAR(64) PRIMARY KEY,user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL)",
    "CREATE TABLE IF NOT EXISTS methods (id VARCHAR(40) PRIMARY KEY,title TEXT NOT NULL,standard TEXT NOT NULL,category VARCHAR(80),risk VARCHAR(40),summary TEXT,critical JSONB NOT NULL DEFAULT '[]',stop JSONB NOT NULL DEFAULT '[]',phases JSONB NOT NULL DEFAULT '[]',version INTEGER NOT NULL DEFAULT 1,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_by UUID REFERENCES users(id))",
    "CREATE TABLE IF NOT EXISTS field_sessions (id UUID PRIMARY KEY,method_id VARCHAR(40) NOT NULL REFERENCES methods(id),method_snapshot JSONB NOT NULL,user_id UUID NOT NULL REFERENCES users(id),facility VARCHAR(150) NOT NULL,sampling_point VARCHAR(150) NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'in_progress',checks JSONB NOT NULL DEFAULT '{}',notes TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),completed_at TIMESTAMPTZ)",
    "CREATE TABLE IF NOT EXISTS audit_events (id UUID PRIMARY KEY,actor_id UUID REFERENCES users(id),action TEXT NOT NULL,entity TEXT NOT NULL,details JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
  ];
  for(const statement of statements) await pool.query(statement);
  const userCount=await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if(userCount.rows[0].n===0){
    const username=process.env.ADMIN_USERNAME?.trim().toLowerCase();
    const password=process.env.ADMIN_PASSWORD;
    if(!validUsername(username)||typeof password!=='string'||password.length<10){
      throw new Error('İlk kurulum için ADMIN_USERNAME ve en az 10 karakterli ADMIN_PASSWORD gereklidir; bunları GitHub reposuna yazmayın.');
    }
    await pool.query(
      'INSERT INTO users(id,username,full_name,password_hash,role) VALUES($1,$2,$3,$4,$5)',
      [uuid(),username,'Sistem Yöneticisi',await bcrypt.hash(password,12),'admin']
    );
    console.log('Yönetici hesabı oluşturuldu:',username);
  }
  const methodCount=await pool.query('SELECT COUNT(*)::int AS n FROM methods');
  if(methodCount.rows[0].n===0){
    for(const m of defaultMethods){
      await pool.query(
        'INSERT INTO methods(id,title,standard,category,risk,summary,critical,stop,phases) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [m.id,m.title,m.standard,m.category,m.risk,m.summary,
          JSON.stringify(m.critical),JSON.stringify(m.stop),JSON.stringify(m.phases)]
      );
    }
    console.log(defaultMethods.length+' yöntem taslağı yüklendi.');
  }
  await pool.query('DELETE FROM auth_sessions WHERE expires_at < NOW()');
}

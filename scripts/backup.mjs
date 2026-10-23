import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

process.umask(0o077);
const source=path.resolve(process.env.DATABASE_PATH || (
  process.env.NODE_ENV==='production' ? '/var/lib/labcore/labcore.sqlite' : 'data/labcore.sqlite'
));
const folder=path.resolve(process.env.BACKUP_DIRECTORY||(
  process.env.NODE_ENV==='production'?'/var/backups/labcore':'backups'
));
fs.mkdirSync(folder,{recursive:true,mode:0o700});
const timestamp=new Date().toISOString().replace(/[:.]/g,'-');
const target=path.join(folder,'labcore-'+timestamp+'.sqlite');
const database=new Database(source,{readonly:true,fileMustExist:true});
try{
  await database.backup(target);
  fs.chmodSync(target,0o600);
  const check=new Database(target,{readonly:true,fileMustExist:true});
  try{
    const result=check.pragma('integrity_check',{simple:true});
    if(result!=='ok')throw new Error('Yedek bütünlük kontrolü başarısız: '+String(result));
  } finally {check.close();}
  console.log('SQLite güvenli yedek oluşturuldu: '+target);
}catch(error){
  try{fs.rmSync(target,{force:true});}catch{}
  console.error('Yedekleme başarısız:',error.message);
  process.exitCode=1;
}finally{database.close();}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('SQLite: login, roles, methods, field records and session revocation',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'labcore-test-'));
  const port=45000+Math.floor(Math.random()*10000);
  const base='http://127.0.0.1:'+port;
  const server=spawn(process.execPath,['server/index.mjs'],{
    cwd:process.cwd(),
    env:{...process.env,NODE_ENV:'development',PORT:String(port),
      DATABASE_PATH:join(directory,'labcore.sqlite'),
      ADMIN_USERNAME:'admin',ADMIN_PASSWORD:'test-strong-admin-password',
      APP_ORIGIN:'http://localhost:5173'},
    stdio:['ignore','pipe','pipe']
  });
  let logs='';
  server.stdout.on('data',d=>{logs+=d;});
  server.stderr.on('data',d=>{logs+=d;});
  const request=async(method,url,body,cookie)=>{
    const response=await fetch(base+'/rehber/api'+url,{
      method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    const data=await response.json();
    return {status:response.status,data,cookie:response.headers.get('set-cookie')};
  };
  try{
    let ready=false;
    for(let i=0;i<100;i++){
      if(server.exitCode!==null)break;
      try{const res=await request('GET','/health');if(res.status===200){ready=true;break;}}catch{}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(ready,'API did not start: '+logs);
    assert.equal((await fetch(base+'/kopru/')).status,404,'LABCORE must not handle Köprü route');
    assert.equal((await fetch(base+'/api/health')).status,404,'LABCORE API must live only below /rehber/api');
    const denied=await request('GET','/methods');
    assert.equal(denied.status,401);
    const logged=await request('POST','/login',{username:'admin',password:'test-strong-admin-password'});
    assert.equal(logged.status,200,JSON.stringify(logged.data));
    const adminCookie=logged.cookie.split(';')[0];
    assert.equal(logged.data.user.role,'admin');
    const methods=await request('GET','/methods',null,adminCookie);
    assert.equal(methods.status,200);
    assert.equal(methods.data.methods.length,15);
    assert.equal(methods.data.methods[0].phases.length,5);
    const m=methods.data.methods[0];
    const update=await request('PUT','/methods/'+m.id,{...m,summary:'Test revizyonu'},adminCookie);
    assert.equal(update.status,200);
    assert.equal(update.data.version,m.version+1);
    const conflict=await request('PUT','/methods/'+m.id,{...m,summary:'Eski revizyon'},adminCookie);
    assert.equal(conflict.status,409);

    const user=await request('POST','/users',{username:'personel1',fullName:'Test Personel',
      password:'test-personnel-password',role:'personnel'},adminCookie);
    assert.equal(user.status,201,JSON.stringify(user.data));
    const loggedStaff=await request('POST','/login',{username:'personel1',password:'test-personnel-password'});
    assert.equal(loggedStaff.status,200);
    const staffCookie=loggedStaff.cookie.split(';')[0];
    assert.equal((await request('GET','/users',null,staffCookie)).status,403);
    assert.equal((await request('PUT','/methods/'+m.id,{...m},staffCookie)).status,403);

    const field=await request('POST','/field-sessions',{methodId:m.id,facility:'Test tesisi',samplingPoint:'Baca 1'},staffCookie);
    assert.equal(field.status,201);
    let session=(await request('GET','/field-sessions',null,staffCookie)).data.sessions[0];
    assert.equal(session.method_snapshot.version,m.version+1);
    const missing=await request('PATCH','/field-sessions/'+field.data.id,
      {checks:{},notes:'Test',status:'completed'},staffCookie);
    assert.equal(missing.status,400);
    const checks={};
    for(const phase of session.method_snapshot.phases)
      phase.items.forEach((_,i)=>checks[phase.id+':'+i]=true);
    const done=await request('PATCH','/field-sessions/'+field.data.id,
      {checks,notes:'OK',status:'completed'},staffCookie);
    assert.equal(done.status,200);
    const again=await request('PATCH','/field-sessions/'+field.data.id,
      {checks,notes:'edit',status:'in_progress'},staffCookie);
    assert.equal(again.status,409);
    const disable=await request('PATCH','/users/'+user.data.user.id,{active:false},adminCookie);
    assert.equal(disable.status,200);
    assert.equal((await request('GET','/me',null,staffCookie)).status,401);
    assert.equal((await request('GET','/me',null,adminCookie)).status,200);
  }finally{
    if(server.exitCode===null){
      server.kill('SIGTERM');
      await new Promise(resolve=>server.once('exit',resolve));
    }
    rmSync(directory,{recursive:true,force:true});
  }
});

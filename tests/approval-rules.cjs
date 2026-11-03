const fs=require('node:fs');
const base=process.env.FIREBASE_TOOLS_LIB || 'C:/Users/lukam/AppData/Local/npm-cache/_npx/7750544ccf494d8b/node_modules/firebase-tools/lib/';
(async()=>{
 const account=require(base+'auth').getGlobalDefaultAccount();
 await require(base+'requireAuth').requireAuth({project:'budgeted-studio',...account});
 const {Client}=require(base+'apiv2'); const client=new Client({urlPrefix:'https://firebaserules.googleapis.com',apiVersion:'v1'});
 const path='/databases/(default)/documents/';
 const test=(method,doc,uid,status,expectation)=>({expectation,request:{path:path+doc,method,auth:uid?{uid,token:{email:'test@example.com'}}:null},...(status?{functionMocks:[{function:'get',args:[{exact_value:path+'users/'+uid}],result:{value:{data:{status}}}}]}:{})});
 const tests=[test('get','transactions/test',null,null,'DENY'),test('get','transactions/test','member','pending','DENY'),test('get','transactions/test','member','rejected','DENY'),test('get','transactions/test','member','approved','ALLOW'),test('get','settings/studio','member','approved','ALLOW'),test('get','notifications/test','member','approved','ALLOW'),test('get','users/member','member',null,'ALLOW'),test('get','users/other','member',null,'DENY'),test('update','users/member','member',null,'DENY'),test('update','users/other','member','approved','DENY'),test('get','pushDevices/token','member','approved','DENY')];
 const result=await client.post('/projects/budgeted-studio:test',{source:{files:[{name:'firestore.rules',content:fs.readFileSync('firestore.rules','utf8')}]},testSuite:{testCases:tests}});
 const reports=result.body.testResults || [];if(result.body.issues?.length)console.log(JSON.stringify(result.body.issues));
 console.log(JSON.stringify(reports.map((r,i)=>({case:i+1,state:r.state,errors:r.errorPosition}))));
 if(reports.length!==tests.length || reports.some(r=>r.state!=='SUCCESS')){console.log(JSON.stringify(result.body));process.exitCode=1;}else console.log('All 11 approval authorization checks passed. No financial records were written.');
})().catch(e=>{console.error(e.message);process.exitCode=1});

// Visual review evidence and skeleton/collision alignment checks.
const puppeteer=require('puppeteer'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'verification/motion');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}const file=fs.existsSync(p)&&fs.statSync(p).isDirectory()?path.join(p,'index.html'):p;if(!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');fs.createReadStream(file).pipe(res);});
let browser;const report={passed:false,frames:[],errors:[],maxBoneError:0};
(async()=>{
 await new Promise(r=>server.listen(8081,'127.0.0.1',r));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();await page.setViewport({width:640,height:360,deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:8081/index.html?test=1',{waitUntil:'networkidle0',timeout:90000});await page.waitForFunction(()=>window.FootballStrike?.ready,{timeout:90000});
 await page.evaluate(()=>{FootballStrike.test.start('practice');FootballStrike.test.freeze(true);document.querySelectorAll('body > :not(#game):not(script)').forEach(e=>{if(!e.querySelector('canvas'))e.style.display='none';});});
 await page.addStyleTag({content:'body>*:not(#game):not(#scene):not(script){visibility:hidden!important} canvas{visibility:visible!important}'});
 for(const [name,x,y] of [['low-left',-2.8,.3],['mid-right',2.8,1.3],['high-left',-2.8,2.2],['central',0,1]]){
 const first=await page.evaluate(([x,y])=>FootballStrike.test.inspectKeeper(x,y,0),[x,y]),k=first.plan;
 const times=name==='central'?[0,.12,.20,.28,.36,.5,.7,1,1.5]:[0,.19,k.start+.09,k.start+.22,k.land-.025,k.land+.14,k.land+.4,k.returnStart-.1,k.endTime];
 for(let i=0;i<times.length;i++){
 const t=times[i],state=await page.evaluate(([x,y,t])=>FootballStrike.test.inspectKeeper(x,y,t),[x,y,t]);assert.ok(state.skinMeshes>0);assert.ok(state.boneError<.0001);report.maxBoneError=Math.max(report.maxBoneError,state.boneError);
 const file=name+'-'+i+'.jpg';await page.screenshot({path:path.join(out,file),type:'jpeg',quality:91});report.frames.push({file,name,time:t,stage:state.pose.stage});
 }
 }
 assert.deepEqual(report.errors,[]);report.passed=true;console.log('MOTION_VERIFIED '+report.frames.length+' poses; bone error '+report.maxBoneError);
})().catch(e=>{report.failure=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();server.close();});

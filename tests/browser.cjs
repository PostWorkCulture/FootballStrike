const puppeteer=require('puppeteer');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),output=path.join(root,'verification');fs.mkdirSync(output,{recursive:true});
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.glb':'model/gltf-binary','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root+path.sep)&&p!==root){res.writeHead(403);return res.end();}if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');if(!fs.existsSync(p)){res.writeHead(404);return res.end('Not found');}res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
const report={checks:[],errors:[],screenshots:[],started:new Date().toISOString(),passed:false};
let browser,activePage;
async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
(async()=>{
 await new Promise(r=>server.listen(8080,'127.0.0.1',r));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();activePage=page;await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
 page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('fonts.googleapis'))report.errors.push(m.text());});
 const snap=()=>page.evaluate(()=>FootballStrike.snapshot());
 const step=s=>page.evaluate(t=>FootballStrike.test.step(t),s);
 const screenshot=async name=>{const bytes=await page.screenshot({path:path.join(output,name+'.jpg'),type:'jpeg',quality:84});fs.writeFileSync(path.join(output,name+'.base64.txt'),Buffer.from(bytes).toString('base64'));report.screenshots.push(name+'.jpg');};
 await page.goto('http://127.0.0.1:8080/?test=1',{waitUntil:'networkidle0',timeout:90000});
 await page.waitForFunction(()=>window.FootballStrike?.ready,{timeout:90000});
 await check('Blender assets load and WebGL scene renders',async()=>{const s=await snap();assert.equal(s.actorReady,true);assert.equal(s.ballAssetLoaded,true);assert.deepEqual(s.assetErrors,[]);assert.ok(s.triangles>5000);assert.ok(s.crowd>3000);report.render=s;});
 await screenshot('01-home-desktop');
 await check('all 12 countries select and update the 3D kit',async()=>{
 await page.click('#nav-nations');const ids=await page.$$eval('.nation-card',els=>els.map(e=>e.dataset.id));assert.equal(ids.length,12);
 for(const id of ids){await page.click('[data-id="'+id+'"]');assert.equal((await snap()).nation,id);const map=await page.evaluate(()=>FootballStrike.test.world.strikerRig.materials.Shirt.map?.isTexture);assert.equal(map,true);}
 await page.click('[data-id="swe"]');});
 await screenshot('02-nations-desktop');await page.click('#nation-confirm');
 await check('training starts with a stationary ball during the run-up',async()=>{
 await page.click('[data-mode="practice"]');await page.evaluate(()=>FootballStrike.test.setKeeper(false));await page.evaluate(()=>FootballStrike.test.fire(2.7,1.8,.7));
 assert.equal((await snap()).phase,'runup');const b=await page.evaluate(()=>FootballStrike.test.getPhysics().ball);assert.equal(b.z,11);
 });
 await step(1.25);
 await check('a real scored penalty increments training once',async()=>{const s=await snap();assert.equal(s.outcome,'goal');assert.equal(s.goals,1);assert.equal(s.shots,1);});
 await screenshot('03-goal-desktop');await step(1.0);
 await check('replay returns without counting the goal twice',async()=>{
 await page.click('#replay');assert.equal((await snap()).phase,'replay');await step(14);assert.equal((await snap()).phase,'result');assert.equal((await snap()).shots,1);
 });await page.click('#next-shot');await screenshot('04-match-desktop');
 await check('mouse swipe shoots, and pause freezes the simulation',async()=>{
 await page.evaluate(()=>FootballStrike.test.setKeeper(false));
 const ball=await page.evaluate(()=>FootballStrike.project(0,.11,11)),target=await page.evaluate(()=>FootballStrike.project(-2.6,1.6,0));
 await page.mouse.move(ball.x,ball.y);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:14});await page.mouse.up();await page.click('#pause-open');
 const before=await page.evaluate(()=>FootballStrike.test.getPhysics());await step(3);const after=await page.evaluate(()=>FootballStrike.test.getPhysics());assert.deepEqual(after,before);assert.equal((await snap()).paused,true);await page.click('#resume');await step(2);assert.equal((await snap()).shots,2);
 });
 await check('quit and restart clear shot and match state',async()=>{await page.click('#pause-open');await page.click('#quit');await page.click('[data-mode="shootout"]');const s=await snap();assert.equal(s.shots,0);assert.deepEqual(s.score,[0,0]);assert.equal(s.phase,'aim');});
 await check('five-shot match or sudden death reaches a result and restarts',async()=>{
 for(let n=0;n<35;n++){await page.evaluate(()=>{FootballStrike.test.setKeeper(false);FootballStrike.test.fire(2.6,1.6,.8);});await step(2);
 const text=await page.$eval('#next-shot',e=>e.textContent);await page.click('#next-shot');if(text.includes('RESULT'))break;}
 assert.equal((await snap()).phase,'complete');await screenshot('05-match-result');await page.click('#result-next');assert.equal((await snap()).shots,0);
 });
 await check('keyboard aiming and Space release fire a penalty',async()=>{
 await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('ArrowLeft');await page.keyboard.down('Space');await page.keyboard.up('Space');assert.ok(['runup','flight'].includes((await snap()).phase));await step(2);
 });
 await check('Target Rush expires once and cannot take another shot',async()=>{
 await page.click('#pause-open');await page.click('#quit');await page.click('[data-mode="rush"]');await page.evaluate(()=>FootballStrike.test.setTime(.15));await step(1);assert.equal((await snap()).phase,'complete');assert.equal(await page.evaluate(()=>FootballStrike.test.fire(0,1,.6)),false);await page.click('#result-menu');
 });
 await check('settings persist and performance mode works',async()=>{
 await page.click('#settings-open');await page.select('#quality-setting','low');await page.click('#audio-setting');await page.click('#motion-setting');await page.click('#settings-dialog .primary');
 assert.equal(await page.evaluate(()=>FootballStrike.test.world.renderer.shadowMap.enabled),false);
 await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>window.FootballStrike?.ready);assert.equal(await page.$eval('#quality-setting',e=>e.value),'low');
 });
 await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>window.FootballStrike?.ready);
 await screenshot('06-home-mobile');
 await check('mobile menu and nation grid fit the viewport',async()=>{
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const box=await page.$eval('[data-mode="practice"]',e=>{const r=e.getBoundingClientRect();return {bottom:r.bottom,top:r.top};});assert.ok(box.bottom<=844&&box.top>=0);
 await page.tap('#nav-nations');await page.tap('[data-id="eng"]');await screenshot('07-nations-mobile');await page.tap('#nation-confirm');
 });
 await page.tap('[data-mode="practice"]');await page.evaluate(()=>FootballStrike.test.setKeeper(false));await screenshot('08-match-mobile');
 await check('touch swipe fires a penalty on a phone viewport',async()=>{
 const cdp=await page.createCDPSession(),b=await page.evaluate(()=>FootballStrike.project(0,.11,11)),t=await page.evaluate(()=>FootballStrike.project(2.65,1.5,0));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x,y:b.y}]});
 for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+(t.x-b.x)*i/10,y:b.y+(t.y-b.y)*i/10}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await step(2);assert.equal((await snap()).shots,1);
 });
 await check('mobile landscape controls remain on screen',async()=>{await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true});await page.evaluate(()=>FootballStrike.test.next());await screenshot('09-match-landscape');const r=await page.$eval('#shot-controls',e=>({bottom:e.getBoundingClientRect().bottom,top:e.getBoundingClientRect().top}));assert.ok(r.bottom<=390&&r.top>=0);});
 await check('no JavaScript or WebGL shader errors',async()=>assert.deepEqual(report.errors,[]));
 report.passed=true;
})().catch(e=>{report.failure=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{
 if(activePage&&!report.passed){try{const bytes=await activePage.screenshot({path:path.join(output,'failure.jpg'),type:'jpeg',quality:80});fs.writeFileSync(path.join(output,'failure.base64.txt'),Buffer.from(bytes).toString('base64'));report.browserState=await activePage.evaluate(()=>({error:document.getElementById('error-text')?.textContent,ready:window.FootballStrike?.ready,state:window.FootballStrike?.snapshot()}));}catch{}}
 report.finished=new Date().toISOString();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 if(browser)await browser.close();server.close();
});

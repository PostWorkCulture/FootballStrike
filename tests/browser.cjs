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
 await page.waitForFunction(()=>window.FootballStrike?.ready||!document.getElementById('error-screen').hidden,{timeout:90000});
 assert.equal(await page.evaluate(()=>window.FootballStrike?.ready),true,await page.$eval('#error-text',e=>e.textContent));
 await check('Blender assets load and WebGL scene renders',async()=>{const s=await snap();assert.equal(s.actorReady,true);assert.equal(s.ballAssetLoaded,true);assert.deepEqual(s.assetErrors,[]);assert.ok(s.triangles>5000);assert.ok(s.crowd>3000);report.render=s;});
 await screenshot('01-home-desktop');
 await check('all 12 countries select and update the 3D kit',async()=>{
 await page.click('#nav-nations');const ids=await page.$$eval('.nation-card',els=>els.map(e=>e.dataset.id));assert.equal(ids.length,12);
 for(const id of ids){await page.click('[data-id="'+id+'"]');assert.equal((await snap()).nation,id);const map=await page.evaluate(()=>FootballStrike.test.world.strikerRig.materials.Shirt.map?.isTexture);assert.equal(map,true);}
 await page.click('[data-id="swe"]');});
 await screenshot('02-nations-desktop');await page.click('#nation-confirm');
 await check('Easy, Normal and Hard are visible, and Easy is the initial setting',async()=>{
 assert.deepEqual(await page.$eval('#difficulty option',nodes=>nodes.map(e=>e.textContent)),['Easy','Normal','Hard']);
 assert.equal((await snap()).difficulty,'rookie');await page.select('#difficulty','elite');
 });
 await check('difficulty can change before a penalty and remains synchronised',async()=>{
 await page.click('[data-mode="practice"]');assert.equal(await page.$eval('#match-difficulty',e=>e.value),'elite');
 await page.select('#match-difficulty','pro');assert.equal((await snap()).difficulty,'pro');
 assert.equal(await page.$eval('#difficulty',e=>e.value),'pro');
 await page.click('#pause-open');await page.click('#quit');await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>window.FootballStrike?.ready);
 assert.equal((await snap()).difficulty,'pro');await page.select('#difficulty','rookie');
 });
 await check('training starts with a stationary ball during the run-up',async()=>{
 await page.click('[data-mode="practice"]');
 const view=await snap();assert.equal(view.view,'first-person');assert.equal(view.strikerVisible,false);
 assert.ok(await page.evaluate(()=>Math.abs(FootballStrike.test.world.camera.position.y-1.72)<.01));
 assert.equal(await page.$('#power-fill'),null);assert.equal(await page.$('#curve'),null);
 await screenshot('11-keeper-ready');await page.evaluate(()=>FootballStrike.test.setKeeper(false));await page.evaluate(()=>FootballStrike.test.fire(2.7,1.8,.7));
 assert.equal((await snap()).phase,'runup');const b=await page.evaluate(()=>FootballStrike.test.getPhysics().ball);assert.equal(b.z,11);
 });
 await step(1.25);
 await check('a real scored penalty increments training once',async()=>{const s=await snap();assert.equal(s.outcome,'goal');assert.equal(s.goals,1);assert.equal(s.shots,1);});
 await screenshot('03-goal-desktop');await step(1.0);
 await check('replay returns without counting the goal twice',async()=>{
 await page.click('#replay');assert.equal((await snap()).phase,'replay');assert.equal((await snap()).strikerVisible,true);await step(.4);await screenshot('10-replay');await step(14);assert.equal((await snap()).phase,'result');assert.equal((await snap()).shots,1);assert.equal((await snap()).strikerVisible,false);
 });await page.click('#next-shot');await screenshot('04-match-desktop');
 await check('the ball is clearly above the bottom controls',async()=>{const ball=await page.evaluate(()=>FootballStrike.project(0,.11,11)),top=await page.$eval('#shot-controls',e=>e.getBoundingClientRect().top);assert.ok(ball.y>100&&ball.y<top-35);assert.equal((await snap()).strikerVisible,false);});
 await check('mouse swipe shoots, and pause freezes the simulation',async()=>{
 await page.evaluate(()=>FootballStrike.test.setKeeper(false));
 const ball=await page.evaluate(()=>FootballStrike.project(0,.11,11)),target=await page.evaluate(()=>FootballStrike.project(-2.6,1.6,0));
 await page.mouse.move(ball.x,ball.y);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:14});await page.mouse.up();await page.click('#pause-open');
 const before=await page.evaluate(()=>FootballStrike.test.getPhysics());await step(3);const after=await page.evaluate(()=>FootballStrike.test.getPhysics());assert.deepEqual(after,before);assert.equal((await snap()).paused,true);await page.click('#resume');await step(2);assert.equal((await snap()).shots,2);
 });
 await check('mouse direction controls curl; straight strokes and different speeds keep the same shot pace',async()=>{
 const results=[];
 for(const bend of [-75,75,0]){
 await page.evaluate(()=>{FootballStrike.test.next();FootballStrike.test.setKeeper(false);});
 const b=await page.evaluate(()=>FootballStrike.project(0,.11,11)),t=await page.evaluate(()=>FootballStrike.project(2.5,1.5,0));
 await page.mouse.move(b.x,b.y);await page.mouse.down();
 for(let i=1;i<=12;i++){const u=i/12;await page.mouse.move(b.x+(t.x-b.x)*u+Math.sin(u*Math.PI)*bend,b.y+(t.y-b.y)*u);if(bend===75)await new Promise(r=>setTimeout(r,25));}
 await page.mouse.up();results.push(await snap());await step(2);
 }
 assert.ok(results[0].shotCurve>.3);assert.ok(results[1].shotCurve<-.3);assert.equal(results[2].shotCurve,0);
 assert.deepEqual(results.map(r=>r.shotPower),[.7,.7,.7]);
 assert.equal(await page.$('#power-fill'),null);assert.equal(await page.$('input[type="range"]'),null);
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
 await check('Target Rush awards accurate hits, expires once and blocks further shots',async()=>{
 await page.click('#pause-open');await page.click('#quit');await page.click('[data-mode="rush"]');await page.evaluate(()=>{const w=FootballStrike.test.world,t=w.targets[w.activeTarget].position;FootballStrike.test.fire(t.x,t.y,.8);});await step(2);assert.ok((await snap()).points>=100);await page.evaluate(()=>FootballStrike.test.setTime(.15));await step(1);assert.equal((await snap()).phase,'complete');assert.equal(await page.evaluate(()=>FootballStrike.test.fire(0,1,.6)),false);await page.click('#result-menu');
 });
 await check('Nations Cup advances through all three rounds and records a trophy',async()=>{
 await page.click('[data-mode="cup"]');await page.evaluate(()=>FootballStrike.test.setSeed(7321));
 for(let round=0;round<3;round++){
 assert.equal((await snap()).stage,round);
 for(let n=0;n<35;n++){await page.evaluate(()=>{FootballStrike.test.setKeeper(false);FootballStrike.test.fire(2.7,1.7,.8);});await step(2);const label=await page.$eval('#next-shot',e=>e.textContent);await page.click('#next-shot');if(label.includes('RESULT'))break;}
 assert.equal((await snap()).phase,'complete');assert.ok((await page.$eval('#result-title',e=>e.textContent)).match(/through|Champions/));
 if(round<2)await page.click('#result-next');
 }
 assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('football-strike-v2')).cups>=1));await page.click('#result-menu');
 });
 await check('settings persist and performance mode works',async()=>{
 await page.click('#settings-open');await page.select('#quality-setting','low');await page.click('#audio-setting');await page.click('#motion-setting');await page.click('#settings-dialog .primary');
 assert.equal(await page.evaluate(()=>FootballStrike.test.world.renderer.shadowMap.enabled),false);
 await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>window.FootballStrike?.ready);assert.equal(await page.$eval('#quality-setting',e=>e.value),'low');assert.equal((await snap()).difficulty,'rookie');
 });
 await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>window.FootballStrike?.ready);
 await screenshot('06-home-mobile');
 await check('mobile menu and nation grid fit the viewport',async()=>{
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const box=await page.$eval('[data-mode="practice"]',e=>{const r=e.getBoundingClientRect();return {bottom:r.bottom,top:r.top};});assert.ok(box.bottom<=844&&box.top>=0);
 await page.tap('#nav-nations');await page.tap('[data-id="eng"]');await screenshot('07-nations-mobile');await page.tap('#nation-confirm');
 });
 await page.tap('[data-mode="practice"]');await page.evaluate(()=>FootballStrike.test.setKeeper(false));await screenshot('08-match-mobile');
 const touch=await page.createCDPSession();
 async function touchStroke(bend=0){
 const b=await page.evaluate(()=>FootballStrike.project(0,.11,11)),t=await page.evaluate(()=>FootballStrike.project(2.65,1.5,0));
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x,y:b.y,id:0}]});
 for(let i=1;i<=12;i++){const u=i/12;await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+(t.x-b.x)*u+Math.sin(Math.PI*u)*bend,y:b.y+(t.y-b.y)*u,id:0}]});}
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await step(2);
 }
 async function checkFraming(){
 const geometry=await page.evaluate(()=>{
 const b=FootballStrike.project(0,.11,11),left=FootballStrike.project(-3.66,2.44,0),right=FootballStrike.project(3.66,2.44,0);
 return {b,left,right,width:innerWidth,height:innerHeight,controls:document.getElementById('shot-controls').getBoundingClientRect().top,score:document.querySelector('.scoreboard').getBoundingClientRect().bottom};
 });
 assert.ok(geometry.b.y<geometry.controls-35);assert.ok(geometry.b.y>geometry.score);
 assert.ok(geometry.left.x>8&&geometry.right.x<geometry.width-8);assert.ok(geometry.left.y>geometry.score+5);
 assert.equal((await snap()).strikerVisible,false);
 }
 await check('touch swipe scores a straight penalty on a phone without scrolling',async()=>{
 await checkFraming();await touchStroke();assert.equal((await snap()).shots,1);assert.equal((await snap()).goals,1);assert.equal((await snap()).shotCurve,0);
 assert.equal(await page.evaluate(()=>scrollY),0);
 });
 await check('cancelled touch and screen rotation do not launch accidental penalties',async()=>{
 await page.evaluate(()=>FootballStrike.test.next());
 const b=await page.evaluate(()=>FootballStrike.project(0,.11,11));
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x,y:b.y,id:0}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+20,y:b.y-35,id:0}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 assert.equal((await snap()).phase,'aim');assert.equal((await snap()).inputActive,false);assert.equal((await snap()).shots,1);
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x,y:b.y,id:0}]});
 await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal((await snap()).phase,'aim');assert.equal((await snap()).inputActive,false);assert.equal((await snap()).shots,1);
 });
 await check('phone landscape keeps the goal, ball and controls usable',async()=>{
 await screenshot('09-match-landscape');await checkFraming();
 const r=await page.$eval('#shot-controls',e=>({bottom:e.getBoundingClientRect().bottom,top:e.getBoundingClientRect().top}));assert.ok(r.bottom<=390&&r.top>=0);
 await touchStroke(-45);assert.equal((await snap()).goals,2);assert.ok((await snap()).shotCurve>.2);
 });
 await check('tablet portrait and landscape support curved touch shots and difficulty selection',async()=>{
 for(const [width,height,name,bend] of [[820,1180,'12-tablet-portrait',-85],[1180,820,'13-tablet-landscape',85]]){
 await page.setViewport({width,height,isMobile:true,hasTouch:true});await page.evaluate(()=>FootballStrike.test.next());
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.select('#match-difficulty','pro');assert.equal((await snap()).difficulty,'pro');await checkFraming();await screenshot(name);
 const before=(await snap()).goals;await touchStroke(bend);const after=await snap();assert.equal(after.goals,before+1);assert.ok(Math.abs(after.shotCurve)>.2);
 }
 });
 await check('a second finger does not replace the active shooting gesture',async()=>{
 await page.evaluate(()=>FootballStrike.test.next());const b=await page.evaluate(()=>FootballStrike.project(0,.11,11)),before=(await snap()).shots;
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x,y:b.y,id:0}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x,y:b.y,id:0},{x:b.x+100,y:b.y-80,id:1}]});
 assert.equal((await snap()).inputActive,true);
 await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 assert.equal((await snap()).phase,'aim');assert.equal((await snap()).shots,before);
 });
 await check('no JavaScript or WebGL shader errors',async()=>assert.deepEqual(report.errors,[]));
 const legacy=await browser.newPage();
 try {
 await legacy.setViewport({width:1440,height:900,deviceScaleFactor:1});
 await legacy.goto('http://127.0.0.1:8080/legacy.html',{waitUntil:'networkidle0',timeout:60000});
 await legacy.evaluate(()=>{if(window.selectMode)window.selectMode('practice');});
 await legacy.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const oldImage=await legacy.screenshot({path:path.join(output,'00-original-game.jpg'),type:'jpeg',quality:80});
 fs.writeFileSync(path.join(output,'00-original-game.base64.txt'),Buffer.from(oldImage).toString('base64'));report.screenshots.push('00-original-game.jpg');
 }catch(e){report.legacyCaptureError=e.message;}finally{await legacy.close();}
 report.passed=true;
})().catch(e=>{report.failure=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{
 if(activePage&&!report.passed){try{const bytes=await activePage.screenshot({path:path.join(output,'failure.jpg'),type:'jpeg',quality:80});fs.writeFileSync(path.join(output,'failure.base64.txt'),Buffer.from(bytes).toString('base64'));report.browserState=await activePage.evaluate(()=>({error:document.getElementById('error-text')?.textContent,ready:window.FootballStrike?.ready,state:window.FootballStrike?.snapshot()}));}catch{}}
 report.finished=new Date().toISOString();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 if(browser)await browser.close();server.close();
});

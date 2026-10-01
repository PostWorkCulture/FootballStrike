// Read-only check of the public feature-commit preview. Does not deploy or change Pages.
const fs=require('node:fs'),path=require('node:path'),puppeteer=require('puppeteer');
const sha=process.env.PREVIEW_SHA||process.env.GITHUB_SHA;if(!/^[a-f0-9]{40}$/.test(sha||''))throw Error('A full GitHub commit SHA is required');
const url='https://raw.githack.com/PostWorkCulture/FootballStrike/'+sha+'/index.html';
const report={url,commit:sha,passed:false,checked:new Date().toISOString(),errors:[]};
let browser;
(async()=>{
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();await page.setViewport({width:1280,height:800});
 page.on('pageerror',e=>report.errors.push(e.message));
 const response=await page.goto(url+'?test=1',{waitUntil:'domcontentloaded',timeout:60000});report.httpStatus=response?.status();
 const controls=await page.$$eval('a,button,input[type="submit"]',nodes=>nodes.map((e,i)=>({index:i,text:e.textContent||e.value||'',href:e.href||''})));
 const confirm=controls.find(e=>/^(continue|proceed|confirm|open|yes)/i.test(e.text.trim()));
 const gamePresent=await page.evaluate(()=>!!window.FootballStrike);
 if(!gamePresent&&confirm){
 report.previewConfirmation=confirm.text.trim();
 const handles=await page.$$('a,button,input[type="submit"]');await handles[confirm.index].click();
 }
 await page.waitForFunction(()=>window.FootballStrike?.ready,{timeout:90000});
 report.home=await page.evaluate(()=>FootballStrike.snapshot());
 report.homeMenu=await page.evaluate(()=>({modes:Array.from(document.querySelectorAll('.mode-card'),e=>e.dataset.mode),countries:document.querySelectorAll('#country-select option').length,photos:Array.from(document.querySelectorAll('.football-photo img'),e=>e.complete&&e.naturalWidth>700)}));
 await page.click('[data-mode="practice"]');
 report.shot=await page.evaluate(()=>{FootballStrike.test.setKeeper(false);FootballStrike.test.fire(2.7,1.8,.8);FootballStrike.test.step(1);return {feedback:document.getElementById('feedback-detail').textContent,speed:FootballStrike.test.getShot().speed};});
 await page.evaluate(()=>FootballStrike.test.step(4));
 report.ui=await page.evaluate(()=>{const r=document.getElementById('match-settings').getBoundingClientRect();return {aimMarker:!!document.getElementById('aim-reticle'),instructions:!!document.getElementById('shot-help'),controlsLeft:r.left,controlsTop:r.top};});
 report.match=await page.evaluate(()=>FootballStrike.snapshot());
 report.passed=report.homeMenu.modes.join(',')==='practice,shootout,rush,cup'&&report.homeMenu.countries===12&&report.homeMenu.photos.every(Boolean)&&report.home.countryCount===12&&report.home.actorReady&&report.home.keeperLoaded&&report.match.goals===1&&report.match.shots===1&&report.match.phase==='aim'&&report.match.originX===-2.7&&!report.ui.aimMarker&&!report.ui.instructions&&report.ui.controlsLeft<40&&report.ui.controlsTop<130&&report.shot.feedback.includes(Math.round(report.shot.speed/1.609344)+' mph')&&report.match.view==='first-person'&&!report.match.strikerVisible&&report.match.shotPower===.7&&report.errors.length===0;
 if(!report.passed)throw Error('Public preview did not pass its loading, scoring and automatic progression checks');
 console.log('PREVIEW_VERIFIED '+url);
})().catch(e=>{report.failure=e.message;process.exitCode=1;console.error('Preview unavailable: '+e.message);}).finally(async()=>{
 fs.mkdirSync('verification',{recursive:true});fs.writeFileSync('verification/public-preview.json',JSON.stringify(report,null,2));if(browser)await browser.close();
});

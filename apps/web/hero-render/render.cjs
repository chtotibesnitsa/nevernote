// Renders the hero frames from index.html + scene.js, served on :8765 (python3 -m http.server 8765).
// node rend.js out W H q list  (list: comma progresses)  OR  node rend.js out W H q seq N LOOPN
const {chromium}=require('playwright-core');const fs=require('fs');
const [out,W,H,q,mode,a,b2]=process.argv.slice(2);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://127.0.0.1:8765/index.html');await p.waitForFunction(()=>window.ready,null,{timeout:60000});
fs.mkdirSync(out,{recursive:true});
const jobs=[];
if(mode==='seq'){const N=+a;for(let i=0;i<N;i++)jobs.push([`s${String(i).padStart(3,'0')}`,i/(N-1),i*2]);for(let i=0;i<+b2;i++)jobs.push([`i${String(i).padStart(2,'0')}`,0,i*2]);}
else for(const pr of mode.split(',').map(Number))jobs.push([`f-${pr}`,pr,Math.round(pr*120)]);
const lo=+(process.env.FROM||0),hi=+(process.env.TO||jobs.length);
for(const [name,pr,fn] of jobs.slice(lo,hi)){const d=await p.evaluate(([pr,fn,W,H,q])=>window.renderFrame(pr,fn,W,H,q),[pr,fn,+W,+H,+q]);
 fs.writeFileSync(`${out}/${name}.webp`,Buffer.from(d.split(',')[1],'base64'));}
await b.close()})();

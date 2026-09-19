// Durable server journal; camera inference stays in the same page.
import {createComparison} from '/vision-compare.mjs';
const compareSample=createComparison();
const instructions=[
 '移开手和身体，点击下方「记住空墙」。校准完成后开始记录空墙。',
 '把一只手伸入白框，手背朝相机、手指展开；保持可见。',
 '手背中心在白框内，在离墙半米以内缓慢左右移动，观察墙上的光。',
 '把手退到离墙约60厘米处，保持可见，观察互动退出。',
 '把手完全移出画面，保持空墙8秒。'
];
const names=['空墙','伸入手','半米内移动','退出半米范围','移开手'];
const panel=document.createElement('details');
panel.style.cssText='border:1px solid #568274;padding:20px;margin:20px 0;border-radius:16px';
panel.innerHTML=`<summary>辅助记录（可选）：五步测试与本地报告</summary><p>不用录屏。每步记录8秒；只保存数值和关节坐标，不保存照片或视频。无需完成测试即可互动。完成记录不等于硬件验收通过。</p><p id="guide-text">准备好后开始新测试。</p><progress id="guide-progress" max="8" value="0" style="width:100%"></progress><p id="save-state">尚未开始</p><button id="session-start">开始新测试</button> <button id="step-start" disabled>开始这一步</button> <button id="session-stop" disabled>停止并保存</button><div id="guide-result"></div><details><summary>最近的本地记录（关闭页面后也保留）</summary><div id="past-records"></div></details>`;
document.querySelector('main').prepend(panel);
const el=id=>document.getElementById(id);
let id=null, step=0, running=false, busy=false, deadline=0, latest=null, latestAt=0;
export function observe(sample){latest=sample;latestAt=performance.now();compareSample(sample)}
async function bridge(){
 const s=latest&&performance.now()-latestAt<500?latest:null;
 const center=s?.joints?.length===21?[0,1].map(k=>[0,5,9,13,17].reduce((v,i)=>v+s.joints[i][k],0)/5):null;
 const reason=!s?'手部后台未更新，请保持后台窗口可见':!s.usable?s.reason:!s.calibrated?'空墙校准无效，请移开身体重新记住空墙':!center?'未识别到完整手部，请让手背和手指进入白框':s.mm===null?'手部距离无效，请保持手在白框内':!s.active?'请把手移到离墙半米内并稍作停留':'';
 try{await fetch('/api/interaction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({detected:!!(s?.usable&&center),center,mm:s?.mm??null,active:!!(s?.usable&&s?.active),reason}),signal:AbortSignal.timeout(800)})}catch{}
 setTimeout(bridge,80);
}
void bridge();
async function api(action,data={}){
 const r=await fetch('/api/record/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...data}),signal:AbortSignal.timeout(5000)});
 const j=await r.json();if(!r.ok)throw Error(j.error||'保存失败');return j;
}
function prompt(){el('guide-text').textContent=`第${step+1}/5步：${names[step]}。${instructions[step]}`;el('step-start').textContent=`开始记录「${names[step]}」`;}
function failure(e){running=false;el('save-state').textContent='记录已暂停：'+e.message+'。已写入的数据保留，请停止并保存后重新开始。';el('step-start').disabled=true;}
function showReport(r){
 const box=el('guide-result');box.replaceChildren();
 const title=document.createElement('p');title.textContent=`${r.status} · 已保存本机。以下是观察数据，不自动判为通过。`;box.append(title);
 const table=document.createElement('table');table.style.cssText='width:100%;text-align:left';
 const head=document.createElement('tr');for(const s of ['步骤','采样数','识别手帧','激活帧','异常帧','距离中位数']){const th=document.createElement('th');th.textContent=s;head.append(th)}table.append(head);
 for(const s of r.steps){const row=document.createElement('tr');for(const v of [s.name+(s.completed?' ✓':'（未完成）'),s.samples,s.hand_frames,s.active_frames,s.invalid_frames,s.distance_mm_median==null?'—':(s.distance_mm_median/10).toFixed(1)+'cm']){const td=document.createElement('td');td.textContent=v;row.append(td)}table.append(row)}box.append(table);
 const link=document.createElement('a');link.href='/api/recordings/'+r.id;link.textContent='下载完整JSON记录';link.download='hand-session-'+r.id+'.json';link.style.color='#bde9c3';box.append(link);
}
async function history(){try{const r=await fetch('/api/recordings');const rows=await r.json();el('past-records').replaceChildren();for(const row of rows){const b=document.createElement('button');b.textContent=row.status+' · '+row.id.slice(0,8);b.onclick=async()=>{try{const r=await fetch('/api/recordings/'+row.id);showReport(await r.json())}catch(e){failure(e)}};el('past-records').append(b)}}catch{el('past-records').textContent='记录服务未连接，请打开 http://127.0.0.1:8773/hands'}}
el('session-start').onclick=async()=>{if(busy)return;busy=true;try{
 const j=await api('start');id=j.id;step=0;running=false;el('guide-result').replaceChildren();el('session-start').disabled=true;el('session-stop').disabled=false;el('step-start').disabled=false;el('guide-progress').value=0;el('save-state').textContent='会话已保存。先校准空墙，再开始第一步。';prompt();
}catch(e){failure(e)}finally{busy=false}};
el('step-start').onclick=async()=>{if(busy||running)return;
 if(!latest?.usable||!latest?.calibrated||performance.now()-latestAt>1000){el('save-state').textContent='请先等待真实彩色画面、模型和空墙校准就绪。';return}
 busy=true;el('step-start').disabled=true;try{await api('step',{step});deadline=performance.now()+8000;running=true;el('save-state').textContent='正在记录，保持当前动作…'}catch(e){failure(e)}finally{busy=false}};
async function finish(complete){const r=await api('finish',{complete});id=null;running=false;el('session-start').disabled=false;el('step-start').disabled=true;el('session-stop').disabled=true;el('save-state').textContent='报告已保存到本机 reports/hands。';showReport(r);await history()}
el('session-stop').onclick=async()=>{if(busy)return;busy=true;running=false;try{await finish(false)}catch(e){failure(e)}finally{busy=false}};
async function tick(){
 if(running&&!busy){busy=true;try{
 const sample=latest&&performance.now()-latestAt<700?latest:{usable:false,reason:'画面或识别中断',joints:[],mm:null,active:false};
 await api('sample',sample);el('guide-progress').value=Math.min(8,8-(deadline-performance.now())/1000);
 el('save-state').textContent=`已写入本机 · 本步剩余${Math.max(0,Math.ceil((deadline-performance.now())/1000))}秒`;
 if(performance.now()>=deadline){await api('end');running=false;if(step===4){await finish(true)}else{step++;prompt();el('step-start').disabled=false;el('save-state').textContent='本步已保存。准备下一个动作，再点击开始记录。'}}
 }catch(e){failure(e)}finally{busy=false}}
 setTimeout(tick,150);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)failure(Error('页面切到后台，当前步骤未完成'))});
window.addEventListener('beforeunload',e=>{if(id){e.preventDefault()}});
void history();void tick();

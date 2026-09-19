export function diagnose(d, hand, mm, active, fresh=true) {
 const full=Array.isArray(hand)&&hand.length===21&&hand.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);
 const center=full?[0,1].map(k=>[0,5,9,13,17].reduce((s,i)=>s+hand[i][k?'y':'x'],0)/5):null;
 const roi=d.roi||[.2,.2,.8,.8];
 const inside=!!center&&center[0]>=roi[0]&&center[0]<=roi[2]&&center[1]>=roi[1]&&center[1]<=roi[3];
 const camera=fresh&&!!d.color_image&&['pipe','camera'].includes(d.mode);
 const aligned=d.alignment==='depth_to_color';
 const reason=!camera?'采集未就绪或画面过期':!full?'画面已收到，但算法没有可靠识别完整手部':!inside?'已识别手，但中心在白框外':!aligned?'已识别手，但彩色和深度未对齐':!d.hand_field?(d.result?.message||'已识别手，但空墙参考未就绪，请先移开身体校准'):mm===null?'已识别手，但中心附近的深度不可靠':!active?'手与距离有效，尚未进入半米互动范围或正在确认':'手部和距离有效，已发送互动输入';
 return {camera,full,center,inside,aligned,reason};
}

export function createDiagnostics() {
 const color=document.querySelector('#view');
 const section=document.createElement('section');section.innerHTML='<h2>机器现在看见什么</h2><p>左：彩色画面与手部关节。右：同一份采集数据的深度伪彩；颜色表示远近，不代表识别到手。白框是当前测距范围，橙点是算法估算的手部中心。</p><div class="vision-grid"><div id="color-slot"><h3>彩色 / 手部识别</h3></div><div><h3>深度 / 同位置对照</h3><canvas id="depth-view" width="320" height="180"></canvas></div></div><p id="vision-reason" role="status"></p><div id="vision-chain"></div><p id="vision-rate">等待观测</p><p>先看左图：如果你能看到自己的手而没有绿色关节线，说明拍到了手，但识别算法尚未成功。不要据此继续按空格。</p>';
 color.before(section);section.querySelector('#color-slot').append(color);
 const style=document.createElement('style');style.textContent='.vision-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.vision-grid canvas{width:100%;height:auto}.vision-grid h3{font-size:16px}#vision-chain{display:flex;gap:10px;flex-wrap:wrap}#vision-chain span{padding:8px;background:#20332f;border-radius:8px}#vision-reason{padding:14px;border-left:4px solid #ffc477;background:#1b2c2a}@media(max-width:750px){.vision-grid{grid-template-columns:1fr}}';document.head.append(style);
 const depth=section.querySelector('#depth-view'),ctx=depth.getContext('2d');let history=[];
 return async(d,hand,mm,active,fresh=true)=>{
   const q=diagnose(d,hand,mm,active,fresh),now=performance.now();
   history.push({t:now,full:q.full&&q.camera});history=history.filter(p=>now-p.t<5000);
   section.querySelector('#vision-reason').textContent=q.reason;
   const chain=section.querySelector('#vision-chain');chain.replaceChildren();
   for(const [label,ok] of [['真实画面',q.camera],['手部节点',q.full],['中心在框内',q.inside],['深度对齐',q.aligned],['距离有效',mm!==null],['互动输入',active]]){const tag=document.createElement('span');tag.textContent=(ok?'✓ ':'— ')+label;chain.append(tag)}
   section.querySelector('#vision-rate').textContent=`最近5秒：${history.length}次观测，${history.filter(p=>p.full).length}次识别到完整手部。帧龄 ${d.age_ms??'未知'}ms。`;
   if(!q.camera||!d.image)ctx.clearRect(0,0,depth.width,depth.height);
   if(q.camera&&d.image){const im=new Image();im.src='data:image/jpeg;base64,'+d.image;await im.decode();depth.width=im.width;depth.height=im.height;ctx.drawImage(im,0,0);if(q.aligned){const r=d.roi||[.2,.2,.8,.8];ctx.strokeStyle='white';ctx.strokeRect(r[0]*im.width,r[1]*im.height,(r[2]-r[0])*im.width,(r[3]-r[1])*im.height);if(q.center){ctx.strokeStyle='#ffad43';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.center[0]*im.width,q.center[1]*im.height,7,0,7);ctx.stroke()}}}
   return q;
 };
}

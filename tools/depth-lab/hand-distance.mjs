export function sampleDistance(field, x, y) {
  if (!field || !Number.isFinite(x) || !Number.isFinite(y) || x<0 || x>=1 || y<0 || y>=1) return null;
  const bytes=Uint8Array.from(atob(field.data), c=>c.charCodeAt(0));
  if(bytes.length!==field.width*field.height*4) return null;
  const data=new DataView(bytes.buffer),cx=Math.floor(x*field.width),cy=Math.floor(y*field.height),values=[];
  // Fixed 5x5 patch, rejecting holes rather than treating zero as contact.
  if(cx<2||cy<2||cx>=field.width-2||cy>=field.height-2)return null;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const v=data.getFloat32(((cy+dy)*field.width+cx+dx)*4,true);
    if(Number.isFinite(v))values.push(v);
  }
  if(values.length<20)return null;
  values.sort((a,b)=>a-b);
  if(values[Math.floor(values.length*.9)]-values[Math.floor(values.length*.1)]>40)return null;
  const mm=values[Math.floor(values.length/2)];
  return mm>=0&&mm<=800?mm:null;
}
export class Proximity {
  constructor(){this.active=false;this.since=null;}
  update(mm,now){
    if(mm===null||!Number.isFinite(mm)||mm<0||mm>530){this.active=false;this.since=null;return false;}
    if(this.active)return true;
    if(mm>500){this.since=null;return false;}
    this.since??=now;
    this.active=now-this.since>=150;
    return this.active;
  }
}

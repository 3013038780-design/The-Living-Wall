export const targets=[[.15,.15],[.85,.15],[.85,.85],[.15,.85]];
export function fit(points){
 if(points.length!==4||points.some(p=>!p||p.length!==2||p.some(v=>!Number.isFinite(v))))throw Error('需要四个有效位置');
 const a=[];
 points.forEach(([x,y],i)=>{const [u,v]=targets[i];a.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v])});
 for(let i=0;i<8;i++){let pivot=i;for(let k=i+1;k<8;k++)if(Math.abs(a[k][i])>Math.abs(a[pivot][i]))pivot=k;
 if(Math.abs(a[pivot][i])<1e-7)throw Error('四点太近或重合，请重新对齐');[a[i],a[pivot]]=[a[pivot],a[i]];
 const d=a[i][i];for(let j=i;j<9;j++)a[i][j]/=d;
 for(let k=0;k<8;k++)if(k!==i){const f=a[k][i];for(let j=i;j<9;j++)a[k][j]-=f*a[i][j]}}
 return a.map(r=>r[8]);
}
export function map(h,[x,y]){const d=h[6]*x+h[7]*y+1;if(Math.abs(d)<1e-6)return null;const p=[(h[0]*x+h[1]*y+h[2])/d,(h[3]*x+h[4]*y+h[5])/d];return p.every(v=>Number.isFinite(v)&&v>=0&&v<=1)?p:null;}

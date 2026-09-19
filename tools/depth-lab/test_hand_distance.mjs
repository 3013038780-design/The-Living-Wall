import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleDistance,Proximity} from './hand-distance.mjs';
test('20/23cm hysteresis, debounce and invalid clearing',()=>{
 const p=new Proximity();assert.equal(p.update(199,0),false);assert.equal(p.update(199,160),true);
 assert.equal(p.update(220,200),true);assert.equal(p.update(231,250),false);
 assert.equal(p.update(220,300),false);p.update(180,400);assert.equal(p.update(180,560),true);
 assert.equal(p.update(null,580),false);
});
test('patch distance rejects missing and mixed depth',()=>{
 const a=new Float32Array(100).fill(180),field=()=>({width:10,height:10,data:Buffer.from(a.buffer).toString('base64')});
 assert.equal(sampleDistance(field(),.5,.5),180);assert.equal(sampleDistance(field(),0,0),null);
 for(let y=3;y<8;y++)for(let x=3;x<5;x++)a[y*10+x]=0;
 assert.equal(sampleDistance(field(),.5,.5),null);a.fill(NaN);assert.equal(sampleDistance(field(),.5,.5),null);
});

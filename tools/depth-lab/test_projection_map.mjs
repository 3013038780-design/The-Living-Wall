import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fit,map,targets} from './projection-map.mjs';
void test('perspective mapping fits four asymmetric corners and rejects degeneracy',()=>{
 const points=[[.2,.1],[.75,.23],[.8,.8],[.15,.9]],h=fit(points);
 points.forEach((p,i)=>map(h,p).forEach((v,j)=>assert.ok(Math.abs(v-targets[i][j])<1e-8)));
 assert.throws(()=>fit([[0,0],[0,0],[0,0],[0,0]]));
 assert.equal(map([1,0,0,0,1,0,0,0],[2,2]),null);
});

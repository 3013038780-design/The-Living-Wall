import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wallPoint} from '../lib/wall-input.ts';
void test('wall input rejects invalid coordinates and preserves release events',()=>{
 assert.deepEqual(wallPoint({type:'living-wall-hand',x:.2,y:.8,active:true}),{x:.2,y:.8,active:true});
 for(const value of [NaN,Infinity,1.1,-.1,'0.2',null])assert.equal(wallPoint({type:'living-wall-hand',x:value,y:.5,active:true})?.active,false);
 assert.equal(wallPoint({type:'living-wall-hand',active:false})?.active,false);
 assert.equal(wallPoint({type:'different',x:.2,y:.8,active:true}),null);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnose} from './vision-diagnostics.mjs';
void test('diagnostic gates distinguish visible stream, hand, ROI, depth and activation',()=>{
 const d={mode:'pipe',color_image:'present',alignment:'depth_to_color',roi:[.2,.2,.8,.8],hand_field:{}};
 const hand=Array.from({length:21},()=>({x:.5,y:.5}));
 assert.match(diagnose(d,null,null,false).reason,/没有可靠识别/);
 assert.match(diagnose(d,hand.map(()=>({x:.9,y:.9})),null,false).reason,/白框外/);
 assert.match(diagnose({...d,hand_field:null,result:{message:'参考已移动'}},hand,null,false).reason,/参考已移动/);
 assert.match(diagnose(d,hand,null,false).reason,/深度不可靠/);
 assert.match(diagnose(d,hand,200,true).reason,/已发送/);
 assert.match(diagnose(d,hand,200,true,false).reason,/过期/);
});

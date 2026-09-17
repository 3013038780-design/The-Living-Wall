// Design comparison using the real renderer at a controlled state and native resolution.
// These fixtures do not replace the actual pointer test in lighting-browser-qa.mjs.
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ts = require('typescript');
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
const creature = moduleUrl(await readFile('lib/creature.ts','utf8'));
const renderer = moduleUrl((await readFile('lib/draw-creature.ts','utf8')).replace('./creature.ts',creature));
const output = process.env.QA_OUTPUT_DIR || 'docs/references/lighting/iteration-20260917';
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,channel:'chrome'});
try {
  const page = await browser.newPage({viewport:{width:1280,height:720}});
  for(const pose of ['idle','touch']) {
    await page.evaluate(async ({creature,renderer,pose})=>{
      const {Creature}=await import(creature);
      const {CreatureRenderer}=await import(renderer);
      const c=new Creature(); c.resize(1280,720); c.x=.5;c.y=.5;c.time=10;c.breath=.5;
      if(pose==='touch') {
        c.enjoyment=.95;c.heading=1.3;c.radius=1.08;c.core=1;
        c.disturbIntensity=1;c.disturbX=.555;c.disturbY=.59;c.stretchY=.12;
      }
      const r=new CreatureRenderer();
      const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
      document.body.style.margin='0';document.body.style.background='#000';document.body.replaceChildren(canvas);
      const ctx=canvas.getContext('2d');
      // Magnify geometry before rasterization, instead of enlarging a low-resolution crop.
      const zoom=pose==='idle'?2.8:2.2;
      ctx.setTransform(zoom,0,0,zoom,640*(1-zoom),360*(1-zoom));
      for(let i=0;i<240;i++)r.draw(ctx,1280,720,1/60,c,false);
    },{creature,renderer,pose});
    await page.screenshot({path:resolve(output,pose+'.png')});
  }
  await writeFile(resolve(output,'fixture.json'),JSON.stringify({description:'Native-resolution renderer fixtures, not actual gesture evidence',viewport:[1280,720],care:0,zoom:{idle:2.8,touch:2.2}},null,2));
} finally {await browser.close();}

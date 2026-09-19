"""Local numeric-only tracking and guided capture; consumes the existing depth lab."""
import argparse
import json
import math
import threading
import time
import urllib.request
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STEPS = [('空墙：手和身体移出白框', 8), ('伸入一只手，离墙约 2～3 厘米，缓慢左右移动', 12),
         ('手保持不动，靠近墙面停留', 8), ('手保持靠墙，让前臂和上半身进入画面', 10),
         ('把手和身体全部移开，留下空墙', 8)]

class Tracker:
    def __init__(self):
        self.items = {}
        self.serial = 0
        self.last = None

    def update(self, snapshot, now):
        r = snapshot.get('result', {})
        good = (snapshot.get('mode') in ('pipe', 'camera') and
                r.get('background_model') == 'pixel-wall-v2' and
                r.get('diagnostic_valid') and snapshot.get('age_ms') is not None and
                snapshot['age_ms'] < 300)
        if not good or (self.last is not None and now-self.last > .4):
            self.items.clear()
        self.last = now
        if not good:
            return [], False
        # Only near-wall patches can drive interaction; the torso centroid cannot.
        candidates = r.get('near_regions', [])
        pairs = sorted((math.dist(v['center'], c['center']), key, i)
                       for key, v in self.items.items() for i, c in enumerate(candidates))
        assigned, used, next_items = set(), set(), {}
        for distance, key, i in pairs:
            if distance > .10 or key in assigned or i in used:
                continue
            assigned.add(key); used.add(i)
            old, c = self.items[key], candidates[i]
            next_items[key] = dict(center=[.65*b+.35*a for a,b in zip(old['center'],c['center'])],
                                   since=old['since'], gap_mm=c['gap_mm'], area_px=c['area_px'])
        for i, c in enumerate(candidates):
            if i not in used:
                self.serial += 1
                next_items[self.serial] = dict(center=c['center'], since=now,
                                              gap_mm=c['gap_mm'], area_px=c['area_px'])
        self.items = next_items  # No ghost cursor after a missing region.
        return [dict(id=k, center=v['center'], gap_mm=v['gap_mm'], area_px=v['area_px'])
                for k,v in self.items.items() if now-v['since'] >= .15], True

class Check:
    def __init__(self, source, output):
        self.source, self.output = source, Path(output)
        self.lock = threading.RLock()
        self.tracker = Tracker()
        self.current = dict(good=False, tracks=[], foreground=0, near=0)
        self.report = None
        self.started = None
        self.phase = 'idle'
        self.message = '等待相机数据'
        self.saved = None
        self.preview = None
        self.roi = [.2,.2,.8,.8]
        self.reason = '等待相机'
        self.bad_since = None

    def start(self):
        with self.lock:
            if self.started is not None:
                raise ValueError('测试正在进行')
            if not self.current['good']:
                raise ValueError('请先在原测试台完成校准，确保相机正常')
            self.output.mkdir(parents=True, exist_ok=True)
            self.saved = str(self.output / time.strftime('wall-check-%Y%m%d-%H%M%S.json'))
            self.report = dict(version=1, started_at=time.strftime('%Y-%m-%dT%H:%M:%S%z'),
                               steps=STEPS, status='running', samples=[],
                               note='动作仅为提示，未自动确认执行；几何近墙区域不等于手或真实触碰。仅保存数值。')
            self.bad_since = None
            self.started = time.monotonic()
            self.persist()

    def persist(self):
        path = Path(self.saved)
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(self.report, ensure_ascii=False), encoding='utf-8')
        temp.replace(path)

    def calibrate(self):
        with self.lock:
            if self.started is not None:
                raise ValueError('测试中不能重新校准')
            request = urllib.request.Request(self.source+'/api/calibrate',
                data=json.dumps(dict(roi=self.roi)).encode(), headers={'Content-Type':'application/json'})
            with urllib.request.urlopen(request,timeout=3) as response:
                response.read()
            self.tracker = Tracker()
            self.current['good'] = False
            self.phase = 'idle'

    def health(self, good, now):
        if good:
            self.bad_since = None
        elif self.started is not None:
            if self.bad_since is None:
                self.bad_since = now
            if now-self.bad_since >= .8:
                self.report['status'] = 'interrupted'
                self.report['interruption'] = dict(t=now-self.started, reason=self.reason)
                self.started = None
                self.phase = 'interrupted'
                self.message = '测试已中止并保存：'+self.reason
                self.persist()

    def poll(self):
        while True:
            try:
                with urllib.request.urlopen(self.source+'/api/state', timeout=1) as response:
                    d = json.load(response)
            except Exception:
                d = {}
            now = time.monotonic()
            with self.lock:
                tracks, good = self.tracker.update(d, now)
                r = d.get('result', {})
                self.preview = d.get('image') if (d.get('age_ms') is not None and d['age_ms']<1500) else None
                self.roi = d.get('roi', self.roi)
                self.reason = '' if good else (r.get('message') or ('正在校准，请保持空墙' if r.get('state')=='calibrating' else '相机数据过期、未校准或未连接'))
                self.health(good, now)
                self.current = dict(good=bool(good), tracks=tracks,
                                    foreground=len(r.get('regions', [])), near=len(r.get('near_regions', [])),
                                    age_ms=d.get('age_ms'), measurement=r.get('measurement'))
                if self.started is not None:
                    elapsed = now-self.started
                    cursor = 0
                    chosen = None
                    for i,(label, duration) in enumerate(STEPS):
                        # Each step has a separate transition buffer, excluded from measurements.
                        if elapsed < cursor+5+duration:
                            chosen = i
                            self.phase = 'prepare' if elapsed < cursor+5 else 'record'
                            self.message = label
                            self.remaining = math.ceil(cursor+(5 if self.phase=='prepare' else 5+duration)-elapsed)
                            break
                        cursor += 5+duration
                    if chosen is None:
                        self.report['status'] = 'completed'
                        self.report['summary'] = []
                        for i,(label,_) in enumerate(STEPS):
                            samples = [s for s in self.report['samples'] if s['step']==i]
                            self.report['summary'].append(dict(action=label, samples=len(samples),
                                invalid=sum(not s['good'] for s in samples),
                                near_present=sum(s['near']>0 for s in samples),
                                tracked=sum(bool(s['tracks']) for s in samples)))
                        self.started = None; self.phase = 'done'; self.message = '测试结束，记录已自动保存；等待分析，不代表触摸验收通过。'
                        self.persist()
                    elif self.phase == 'record':
                        self.report['samples'].append(dict(t=round(elapsed,3), step=chosen, **self.current))
                        # Persist every measurement so closing the page does not lose the report.
                        self.persist()
                elif self.phase not in ('done','interrupted'):
                    self.message = '已连接，可以开始' if good else self.reason
            time.sleep(.1)

    def state(self):
        with self.lock:
            return dict(**self.current, phase=self.phase, message=self.message,
                        remaining=getattr(self,'remaining',0), saved=self.saved,
                        image=self.preview, roi=self.roi, reason=self.reason,
                        summary=self.report.get('summary') if self.report else None)

HTML = '''<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>碎光 · 自动动作测试</title>
<style>body{background:#091313;color:#e7f5eb;font:22px system-ui;max-width:1050px;margin:40px auto;padding:20px}h1{font-size:36px}button{font:inherit;padding:15px 28px;border:0;border-radius:12px;background:#c2efbb}#action{font-size:34px;min-height:100px}canvas{width:100%;background:#122326;border:1px solid #49615b;border-radius:15px}small{color:#adc1bb}#count{font-size:48px}#saved{font-size:15px;overflow-wrap:anywhere}</style>
<h1>碎光 · 自动动作测试</h1><p>点一次开始，再按大字提示做动作。约 71 秒，记录自动保存在电脑上。</p>
<p><small>先把手和身体移出白框；如果相机动过，点击「记住现在的空墙」。</small></p><button id="calibrate">记住现在的空墙</button> <button id="start" disabled>开始测试</button><p id="action">正在连接…</p><b id="count"></b><p id="stats"></p>
<p id="reason" style="color:#ffcf9b"></p><p><small>实时深度画面（不是彩色录像）· 白框是检测范围</small></p><canvas id="view" width="960" height="500"></canvas><p><small>圆点表示持续检测到的近墙区域，不代表已确认手掌或真实接触。编号仅用于短时跟踪。</small></p><p id="measure"></p><p id="saved"></p>
<script>
const $=id=>document.getElementById(id),ctx=$('view').getContext('2d');
$('calibrate').onclick=async()=>{let r=await fetch('/calibrate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)alert(await r.text())};
$('start').onclick=async()=>{try{let r=await fetch('/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)alert(await r.text())}catch(e){$('action').textContent='连接失败，请保留页面等待恢复'}};
async function poll(){try{let r=await fetch('/state');if(!r.ok)throw Error();let s=await r.json();$('action').textContent=(s.phase==='prepare'?'准备：':'')+s.message;$('count').textContent=['prepare','record'].includes(s.phase)?s.remaining+' 秒':'';$('stats').textContent=`${s.good?'数据正常':'数据不可用'} · 前景 ${s.foreground} · 近墙 ${s.near} · 稳定点 ${s.tracks.length}`;$('start').disabled=!s.good||['prepare','record'].includes(s.phase);$('calibrate').disabled=['prepare','record'].includes(s.phase);$('reason').textContent=s.reason||'';$('saved').textContent=s.saved?'记录位置：'+s.saved:'';ctx.clearRect(0,0,960,500);if(s.image){let im=new Image();im.src='data:image/jpeg;base64,'+s.image;await im.decode();ctx.drawImage(im,0,0,960,500)}let [x0,y0,x1,y1]=s.roi;let m=s.measurement;$('measure').textContent=m?('固定框表面离墙估算：'+(m.signed_gap_mm??'无有效读数')+' mm；框内有效比例 '+Math.round(m.valid_ratio*100)+'%。不是手掌接触距离。'):'当前相机后台尚未加载距离测量模块；本页原有圆点不能用于验证测距精度。';if(m){let [a,b,c,d]=m.bounds;ctx.strokeStyle='#ffca80';ctx.strokeRect(a*960,b*500,(c-a)*960,(d-b)*500)}ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(x0*960,y0*500,(x1-x0)*960,(y1-y0)*500);for(let t of s.tracks){let [x,y]=t.center;ctx.beginPath();ctx.arc(x*960,y*500,18,0,7);ctx.fillStyle='#c2efbb';ctx.fill();ctx.font='18px system-ui';ctx.fillText('#'+t.id+' · '+t.gap_mm+' mm',x*960+24,y*500)}}catch(e){$('action').textContent='连接中断，暂时不要继续动作';$('start').disabled=true;ctx.clearRect(0,0,960,500)}setTimeout(poll,150)}poll();
</script></html>'''

def serve(check, port):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args): pass
        def respond(self, code, body, mime='application/json'):
            self.send_response(code); self.send_header('Content-Type', mime+'; charset=utf-8')
            self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(body.encode())
        def allowed(self):
            return self.headers.get('Host') in (f'127.0.0.1:{port}', f'localhost:{port}')
        def do_GET(self):
            if not self.allowed(): return self.respond(403,'Forbidden')
            if self.path=='/': return self.respond(200,HTML,'text/html')
            if self.path=='/state': return self.respond(200,json.dumps(check.state(),ensure_ascii=False))
            self.respond(404,'Not found')
        def do_POST(self):
            if not self.allowed() or self.headers.get('Origin') not in (None,f'http://127.0.0.1:{port}',f'http://localhost:{port}'):
                return self.respond(403,'Forbidden')
            if self.path not in ('/start','/calibrate'): return self.respond(404,'Not found')
            if self.headers.get('Content-Type')!='application/json': return self.respond(415,'JSON required')
            try:
                (check.start if self.path=='/start' else check.calibrate)()
                self.respond(200,'{}')
            except (ValueError,OSError) as e: self.respond(409,str(e),'text/plain')
    threading.Thread(target=check.poll,daemon=True).start()
    ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',default='http://127.0.0.1:8769');p.add_argument('--port',type=int,default=8771)
    p.add_argument('--output',default=str(Path.home()/'Documents'/'LivingWall-test-reports'))
    a=p.parse_args();serve(Check(a.source,a.output),a.port)

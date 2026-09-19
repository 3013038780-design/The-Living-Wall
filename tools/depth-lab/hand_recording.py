"""Local numeric hand-session journal. Never stores camera images."""
import json
import math
import os
from pathlib import Path
import threading
import time
import uuid

STEPS = ['空墙', '伸入手', '半米内移动', '退出半米范围', '移开手']


class Recorder:
    def __init__(self, root, steps=None):
        self.root = Path(root)
        self.steps = steps or STEPS
        self.lock = threading.RLock()
        self.current = None

    def write(self, event):
        event['saved_at'] = time.time()
        with (self.root / (self.current + '.jsonl')).open('a', encoding='utf-8') as f:
            f.write(json.dumps(event, ensure_ascii=False, allow_nan=False) + '\n')
            f.flush()
            os.fsync(f.fileno())

    def events(self, sid):
        if not isinstance(sid, str) or len(sid) != 32 or any(c not in '0123456789abcdef' for c in sid):
            raise ValueError('无效记录编号')
        path = self.root / (sid + '.jsonl')
        if not path.exists():
            raise ValueError('记录不存在')
        events = []
        for line in path.read_text().splitlines():
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                pass  # Keep earlier durable samples after an interrupted final write.
        return events

    def report(self, sid):
        events = self.events(sid)
        rows = []
        for i, name in enumerate(events[0].get('steps', self.steps)):
            samples = [e for e in events if e.get('type') == 'sample' and e['step'] == i]
            distances = sorted(e['mm'] for e in samples if e['mm'] is not None)
            valid = [e for e in samples if e['usable']]
            rows.append(dict(name=name, samples=len(samples), reliable_frames=len(valid),
                hand_frames=sum(e['hand'] for e in samples), active_frames=sum(e['active'] for e in samples),
                invalid_frames=len(samples)-len(valid),
                distance_mm_median=distances[len(distances)//2] if distances else None,
                distance_mm_range=[distances[0], distances[-1]] if distances else None,
                completed=any(e.get('type') == 'step_end' and e['step'] == i for e in events)))
        finished = next((e for e in reversed(events) if e.get('type') == 'finish'), None)
        return dict(id=sid, status=finished['status'] if finished else '未完成', steps=rows,
            started_at=events[0]['saved_at'] if events else None,
            note='数值观察记录，不是测距精度认证。步骤中的实际动作与距离由操作者提供。无彩色视频；关节为归一化图像坐标。',
            events=events)

    def command(self, action, args):
        with self.lock:
            if action == 'start':
                if self.current:
                    self.write(dict(type='finish', status='中止'))
                self.root.mkdir(parents=True, exist_ok=True)
                self.current = uuid.uuid4().hex
                self.step = -1
                self.step_started = None
                self.write(dict(type='start', schema=1, steps=self.steps, activate_mm=500, release_mm=530))
                return dict(id=self.current)
            if not self.current or args.get('id') != self.current:
                raise ValueError('记录会话已变化，请重新开始测试')
            if action == 'step':
                step = args.get('step')
                if type(step) is not int or step != self.step+1 or step not in range(len(self.steps)) or self.step_started is not None:
                    raise ValueError('请按顺序完成当前步骤')
                self.step = step
                self.step_started = time.monotonic()
                self.write(dict(type='step', step=step))
            elif action == 'sample':
                if self.step_started is None:
                    raise ValueError('尚未开始步骤')
                def number(v):
                    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
                mm = args.get('mm')
                if mm is not None and (not number(mm) or not 0 <= mm <= 800):
                    raise ValueError('距离无效')
                points = args.get('joints', [])
                if not isinstance(points, list) or len(points) not in (0, 21) or any(not isinstance(p, list) or len(p) != 2 or any(not number(v) or not 0 <= v <= 1 for v in p) for p in points):
                    raise ValueError('关节无效')
                usable = args.get('usable') is True
                hand = len(points) == 21 and usable
                center = [sum(points[i][k] for i in (0,5,9,13,17))/5 for k in (0,1)] if hand else None
                self.write(dict(type='sample', step=self.step, elapsed_s=round(time.monotonic()-self.step_started,3),
                    usable=usable, hand=hand, joints=points if hand else [], center=center,
                    mm=mm if hand else None, active=args.get('active') is True and hand and mm is not None,
                    reason=str(args.get('reason',''))[:250]))
            elif action == 'end':
                if self.step_started is None or time.monotonic()-self.step_started < 7.5:
                    raise ValueError('每一步至少记录8秒')
                self.write(dict(type='step_end', step=self.step))
                self.step_started = None
            elif action == 'finish':
                complete = self.step == len(self.steps)-1 and self.step_started is None
                self.write(dict(type='finish', status='已完成' if complete and args.get('complete') is True else '中止'))
                sid = self.current
                self.current = None
                report = self.report(sid)
                (self.root / (sid+'.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2))
                return report
            else:
                raise ValueError('未知记录操作')
            return dict(ok=True)

    def listing(self):
        return [dict(id=p.stem, status=self.report(p.stem)['status']) for p in sorted(self.root.glob('*.jsonl'), key=lambda p:p.stat().st_mtime, reverse=True)[:20]]

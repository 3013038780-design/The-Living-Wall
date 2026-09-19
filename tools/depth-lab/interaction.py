"""Ephemeral hand bridge; only numeric input, expires without a producer."""
import math
import threading
import time


class Interaction:
    def __init__(self):
        self.lock=threading.Lock()
        self.at=0
        self.value={}

    def publish(self, args):
        center=args.get('center')
        mm=args.get('mm')
        detected=(args.get('detected') is True and isinstance(center,list) and len(center)==2 and all(type(v) in (int,float) and math.isfinite(v) and 0<=v<=1 for v in center))
        valid=(detected and type(mm) in (int,float) and math.isfinite(mm) and 0<=mm<=530 and args.get('active') is True)
        with self.lock:
            self.at=time.monotonic()
            self.value=dict(active=bool(valid),detected=detected,center=center if detected else None,mm=mm if valid else None,reason=str(args.get('reason','未识别到可靠手部位置'))[:250])

    def snapshot(self):
        with self.lock:
            age=(time.monotonic()-self.at)*1000
            return dict(self.value if age<=500 else dict(active=False,detected=False,center=None,mm=None,reason='手部后台未更新。请保持后台窗口可见。'),age_ms=round(age))

import unittest
from wall_check import Tracker

def snapshot(near=None, good=True, age=1):
 return dict(mode='pipe',age_ms=age,result=dict(background_model='pixel-wall-v2',diagnostic_valid=good,near_regions=near or [],regions=[dict(center=[.8,.8])]))
def patch(x=.4,y=.5): return dict(center=[x,y],gap_mm=20,area_px=100)
class TrackingTests(unittest.TestCase):
 def test_debounce_follow_and_leave(self):
  t=Tracker();self.assertEqual(t.update(snapshot([patch()]),0)[0],[])
  a=t.update(snapshot([patch(.42)]),.2)[0];self.assertEqual(len(a),1)
  b=t.update(snapshot([patch(.43)]),.3)[0];self.assertEqual(a[0]['id'],b[0]['id'])
  self.assertGreater(b[0]['center'][0],a[0]['center'][0]);self.assertEqual(t.update(snapshot(),.4)[0],[])
 def test_body_cannot_create_pointer(self):
  t=Tracker();t.update(snapshot(),0);self.assertEqual(t.update(snapshot(),.2)[0],[])
 def test_stale_clears_track(self):
  t=Tracker();t.update(snapshot([patch()]),0);t.update(snapshot([patch()]),.2)
  self.assertEqual(t.update(snapshot([patch()],age=400),.3),( [],False))
  self.assertEqual(t.update(snapshot([patch()]),.4)[0],[])
 def test_multiple_and_jump(self):
  t=Tracker();t.update(snapshot([patch(.3),patch(.6)]),0)
  self.assertEqual(len(t.update(snapshot([patch(.3),patch(.6)]),.2)[0]),2)
  self.assertEqual(t.update(snapshot([patch(.9)]),.3)[0],[])

class RecordingTests(unittest.TestCase):
 def test_report_persists_locally_and_refuses_double_start(self):
  import tempfile,json
  from pathlib import Path
  from wall_check import Check
  with tempfile.TemporaryDirectory() as folder:
   c=Check('http://127.0.0.1:8769',folder)
   with self.assertRaises(ValueError): c.start()
   c.current['good']=True;c.start()
   with self.assertRaises(ValueError): c.start()
   report=json.loads(Path(c.saved).read_text())
   self.assertEqual(report['status'],'running')
   self.assertEqual(report['samples'],[])
   c.report['samples'].append(dict(step=0,good=True,tracks=[]));c.persist()
   self.assertEqual(len(json.loads(Path(c.saved).read_text())['samples']),1)

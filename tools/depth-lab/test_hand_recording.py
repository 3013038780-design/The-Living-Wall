import json
import tempfile
import unittest
from hand_recording import Recorder


class RecordingTests(unittest.TestCase):
    def test_two_stage_comparison_recovers_labels(self):
        with tempfile.TemporaryDirectory() as path:
            r=Recorder(path,['关闭','开启']);sid=r.command('start',{})['id']
            for i in range(2):
                r.command('step',dict(id=sid,step=i))
                r.command('sample',dict(id=sid,usable=True,joints=[[.5,.5]]*21,mm=None,active=False))
                r.step_started-=8;r.command('end',dict(id=sid))
            report=r.command('finish',dict(id=sid,complete=True))
            self.assertEqual(report['status'],'已完成')
            self.assertEqual(Recorder(path).report(sid)['steps'][1]['name'],'开启')
            self.assertEqual(report['steps'][1]['hand_frames'],1)

    def test_durable_partial_session_recovered_by_new_process(self):
        with tempfile.TemporaryDirectory() as path:
            r=Recorder(path)
            sid=r.command('start',{})['id']
            r.command('step',dict(id=sid,step=0))
            r.command('sample',dict(id=sid,usable=True,joints=[],mm=None,active=False))
            recovered=Recorder(path).report(sid)
            self.assertEqual(recovered['status'],'未完成')
            self.assertEqual(recovered['steps'][0]['samples'],1)
            self.assertFalse(recovered['steps'][0]['completed'])

    def test_sequence_completion_and_invalid_sample(self):
        with tempfile.TemporaryDirectory() as path:
            r=Recorder(path); sid=r.command('start',{})['id']
            with self.assertRaises(ValueError):r.command('step',dict(id=sid,step=2))
            for i in range(5):
                r.command('step',dict(id=sid,step=i))
                with self.assertRaises(ValueError):r.command('end',dict(id=sid))
                r.command('sample',dict(id=sid,usable=False,joints=[[.5,.5]]*21,mm=100,active=True))
                r.step_started-=8
                r.command('end',dict(id=sid))
            report=r.command('finish',dict(id=sid,complete=True))
            self.assertEqual(report['status'],'已完成')
            self.assertEqual(report['steps'][2]['active_frames'],0)
            self.assertIsNone(report['steps'][2]['distance_mm_median'])
            self.assertTrue(all(s['completed'] for s in report['steps']))
            self.assertEqual(Recorder(path).listing()[0]['status'],'已完成')

    def test_rejects_bad_points_and_path_traversal(self):
        with tempfile.TemporaryDirectory() as path:
            r=Recorder(path);sid=r.command('start',{})['id']
            r.command('step',dict(id=sid,step=0))
            with self.assertRaises(ValueError):r.command('sample',dict(id=sid,joints=[[float('nan'),0]]*21))
            with self.assertRaises(ValueError):r.report('../../etc/passwd')
            report=r.command('finish',dict(id=sid,complete=True))
            self.assertEqual(report['status'],'中止')

if __name__=='__main__':unittest.main()

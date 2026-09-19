import unittest
from interaction import Interaction

class InteractionTests(unittest.TestCase):
    def test_expiry_and_missing_depth_fail_closed(self):
        b=Interaction();b.publish(dict(detected=True,center=[.4,.5],mm=400,active=True))
        self.assertTrue(b.snapshot()['active'])
        b.at-=.6
        self.assertFalse(b.snapshot()['active'])
        b.publish(dict(detected=True,center=[.4,.5],mm=None,active=True))
        self.assertFalse(b.snapshot()['active'])
        b.publish(dict(detected=True,center=[.4,.5],mm=600,active=True))
        self.assertFalse(b.snapshot()['active'])

    def test_calibration_position_survives_missing_distance_but_not_expiry(self):
        b=Interaction();b.publish(dict(detected=True,center=[.1,.2],mm=None,active=False))
        self.assertTrue(b.snapshot()['detected'])
        self.assertEqual(b.snapshot()['center'],[.1,.2])
        self.assertFalse(b.snapshot()['active'])
        b.at-=.6
        self.assertFalse(b.snapshot()['detected'])
        self.assertIsNone(b.snapshot()['center'])

import unittest
import base64
import numpy as np
from detector import Detector
from hand_distance import distance_field

class DistanceFieldTests(unittest.TestCase):
    def test_aligned_field_keeps_holes_and_offsets(self):
        d=Detector();wall=np.full((240,320),1000.,dtype=np.float32);intr=(300.,300.,159.5,119.5)
        d.begin((.2,.2,.8,.8))
        for i in range(30):d.update(wall,intr,now=i*.1)
        frame=wall.copy();frame[110:130,150:170]-=180;frame[115,155]=0
        f=distance_field(frame,intr,d,True,True)
        a=np.frombuffer(base64.b64decode(f['data']),dtype='<f4').reshape(240,320)
        self.assertAlmostEqual(a[120,160],180)
        self.assertTrue(np.isnan(a[115,155]));self.assertTrue(np.isnan(a[0,0]))
        self.assertIsNone(distance_field(frame,intr,d,False,True))
        self.assertIsNone(distance_field(frame,intr,d,True,False))

import unittest
import numpy as np
from detector import Detector
I=(300.,300.,159.5,119.5)
class Tests(unittest.TestCase):
 def setUp(self):
  self.d=Detector();self.wall=np.full((240,320),1000,dtype=np.float32);self.cal(self.wall)
 def cal(self,w):
  self.d.begin((.2,.2,.8,.8))
  for i in range(30):self.d.update(w,I,now=i*.1)
 def frame(self,g):
  x=self.wall.copy();x[90:145,130:190]-=g;return x
 def settle(self,f,t=10):
  for k in range(5):r=self.d.update(f,I,now=t+k*.1)
  return r
 def test_lifecycle_hysteresis(self):
  for t,g,s in [(10,80,'near'),(11,12,'contact_candidate'),(12,18,'contact_candidate'),(13,30,'near'),(14,0,'away')]:self.assertEqual(self.settle(self.frame(g),t)['state'],s)
 def test_debounce(self):
  self.assertNotEqual(self.d.update(self.frame(12),I,now=10)['state'],'contact_candidate')
  self.assertEqual(self.settle(self.wall,11)['state'],'away')
 def test_missing(self):
  self.settle(self.frame(12));r=self.settle(np.zeros_like(self.wall),11);self.assertEqual(r['state'],'unknown');self.assertIsNone(r['gap_mm'])
 def test_noise(self):
  self.assertEqual(self.settle(self.wall+np.random.default_rng(42).normal(0,1,self.wall.shape))['state'],'away')
 def test_speckles(self):
  x=self.wall.copy();x[100:103,100:103]-=12;self.assertEqual(self.settle(x)['state'],'away')
 def test_plane_movement(self):
  self.assertEqual(self.settle(self.wall-70)['state'],'unknown')
 def test_bad_calibration(self):
  self.cal(np.zeros_like(self.wall));self.assertIsNone(self.d.plane)
 def test_tilt(self):
  y,x=np.indices(self.wall.shape);n=np.array([.2,0,1.]);n/=np.linalg.norm(n);denom=n[0]*(x-I[2])/I[0]+n[2];dep=(1000/denom).astype(np.float32);self.cal(dep)
  near=dep.copy();near[90:145,130:190]-=50/denom[90:145,130:190];self.assertAlmostEqual(self.settle(near)['gap_mm'],50,places=0)
 def test_reset(self):
  self.settle(self.frame(12));self.d.reset();r=self.d.update(self.wall,I);self.assertEqual(r['state'],'uncalibrated');self.assertIsNone(r['position'])
if __name__=='__main__':unittest.main()

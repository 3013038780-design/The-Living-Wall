"""Same-frameset wall displacement field for the local color landmark viewer."""
import base64
import numpy as np
from detector import points

def distance_field(depth, intrinsics, detector, aligned, valid):
    if not aligned or not valid or detector.reference is None or detector.calibrating:
        return None
    if depth.shape != detector.reference_valid.shape or tuple(intrinsics) != detector.intrinsics:
        return None
    known = detector.reference_valid & np.isfinite(depth) & (depth > 100) & (depth < 5000)
    gap = (detector.reference-points(depth, intrinsics)) @ detector.plane[0]
    field = np.where(known, gap, np.nan).astype('<f4')
    h,w = depth.shape
    return dict(width=w, height=h, encoding='float32le', data=base64.b64encode(field.tobytes()).decode())

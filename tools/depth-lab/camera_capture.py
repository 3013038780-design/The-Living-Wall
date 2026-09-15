"""Temporary privileged USB reader. No HTTP server, file writes, or command input."""
import os
import sys
import json
import struct
# Keep a dedicated binary output; send SDK console messages to stderr.
stream = os.fdopen(os.dup(sys.stdout.fileno()), 'wb', buffering=0)
os.dup2(sys.stderr.fileno(), sys.stdout.fileno())
import numpy as np
from pyorbbecsdk import Context, Pipeline, Config, OBSensorType, OBFormat, OBLogLevel

pipeline = None
started = False
try:
    # Avoid SDK file logs from the elevated reader.
    Context.set_logger_to_console(OBLogLevel.ERROR)
    Context.set_logger_to_file(OBLogLevel.NONE, '')
    ctx = Context()
    devices = ctx.query_devices()
    device = None
    for i in range(devices.get_count()):
        candidate = devices.get_device_by_index(i)
        if '335' in candidate.get_device_info().get_name():
            device = candidate
            break
    if device is None:
        raise RuntimeError('没有检测到 Gemini 335，请检查 USB 连接。')
    pipeline = Pipeline(device)
    profile = pipeline.get_stream_profile_list(OBSensorType.DEPTH_SENSOR).get_default_video_stream_profile()
    if profile.get_format() != OBFormat.Y16:
        raise RuntimeError('不支持的默认深度格式。')
    intr = profile.get_intrinsic()
    config = Config()
    config.enable_stream(profile)
    pipeline.start(config)
    started = True
    missed = 0
    while True:
        frames = pipeline.wait_for_frames(1000)
        frame = frames.get_depth_frame() if frames else None
        if frame is None:
            missed += 1
            if missed >= 5:
                raise RuntimeError('深度画面中断，请重新连接。')
            continue
        missed = 0
        w, h = frame.get_width(), frame.get_height()
        data = np.frombuffer(frame.get_data(), dtype=np.uint16).reshape(h,w).astype('<f4') * frame.get_depth_scale()
        header = json.dumps({'width':w,'height':h,'intrinsics':[intr.fx,intr.fy,intr.cx,intr.cy]}).encode()
        stream.write(struct.pack('!I',len(header)))
        stream.write(header)
        stream.write(data.tobytes())
except (BrokenPipeError,KeyboardInterrupt):
    pass
except Exception as exc:
    print('相机读取失败：'+str(exc),file=sys.stderr,flush=True)
    sys.exit(1)
finally:
    if started:
        pipeline.stop()

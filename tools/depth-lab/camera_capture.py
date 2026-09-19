"""Temporary privileged USB reader. No HTTP server, file writes, or command input."""
import os
import sys
import json
import struct
import time
import argparse
parser = argparse.ArgumentParser()
parser.add_argument('--color', action='store_true')
args = parser.parse_args()
# Keep a dedicated binary output; send SDK console messages to stderr.
stream = os.fdopen(os.dup(sys.stdout.fileno()), 'wb', buffering=0)
os.dup2(sys.stderr.fileno(), sys.stdout.fileno())
import numpy as np
import cv2
from pyorbbecsdk import Context, Pipeline, Config, OBSensorType, OBFormat, OBLogLevel, AlignFilter, OBStreamType, OBFrameAggregateOutputMode

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
    if args.color:
        color_profile = pipeline.get_stream_profile_list(OBSensorType.COLOR_SENSOR).get_default_video_stream_profile()
        config.enable_stream(color_profile)
        config.set_frame_aggregate_output_mode(OBFrameAggregateOutputMode.FULL_FRAME_REQUIRE)
        pipeline.enable_frame_sync()
    pipeline.start(config)
    started = True
    align = AlignFilter(OBStreamType.COLOR_STREAM) if args.color else None
    if align:
        align.set_match_target_resolution(True)
    last_success = time.monotonic()
    received_raw = False
    while True:
        frames = pipeline.wait_for_frames(1000)
        raw_depth = frames.get_depth_frame() if frames else None
        raw_color = frames.get_color_frame() if frames and args.color else None
        received_raw = received_raw or raw_depth is not None
        reason = '未收到原始深度帧'
        if align and raw_depth is not None and raw_color is not None:
            aligned = align.process(frames)
            frames = aligned.as_frame_set() if aligned else None
            reason = '原始彩色与深度已到达，但SDK对齐尚未输出深度'
        elif align:
            frames = None
            reason = '等待同组彩色和深度帧'
        frame = frames.get_depth_frame() if frames else None
        if frame is None:
            if time.monotonic()-last_success >= 10:
                raise RuntimeError(f'连续10秒无可用帧：{reason}；本次是否收到过原始深度：{received_raw}')
            continue
        last_success = time.monotonic()
        if align:
            intr = frame.get_stream_profile().as_video_stream_profile().get_intrinsic()
        w, h = frame.get_width(), frame.get_height()
        data = np.frombuffer(frame.get_data(), dtype=np.uint16).reshape(h,w).astype('<f4') * frame.get_depth_scale()
        color_bytes = b''
        if args.color:
            color = frames.get_color_frame()
            if color is not None:
                if abs(color.get_timestamp_us()-frame.get_timestamp_us()) > 100000:
                    raise RuntimeError('彩色与深度帧时间差超过100ms，不能配对测距。')
                if (color.get_width(), color.get_height()) != (w, h):
                    raise RuntimeError('SDK对齐后尺寸仍不一致，禁止读取手部距离。')
                raw = np.frombuffer(color.get_data(), dtype=np.uint8)
                fmt = color.get_format()
                if fmt == OBFormat.MJPG:
                    image = cv2.imdecode(raw, cv2.IMREAD_COLOR)
                elif fmt in (OBFormat.RGB, OBFormat.BGR):
                    image = raw.reshape(color.get_height(), color.get_width(), 3)
                    if fmt == OBFormat.RGB:
                        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
                elif fmt in (OBFormat.YUYV, OBFormat.YUY2):
                    image = cv2.cvtColor(raw.reshape(color.get_height(), color.get_width(), 2), cv2.COLOR_YUV2BGR_YUY2)
                else:
                    raise RuntimeError('彩色格式暂不支持：'+str(fmt))
                if image is not None:
                    image = cv2.resize(image, (640, round(image.shape[0]*640/image.shape[1])))
                    ok, encoded = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    if ok:
                        color_bytes = encoded.tobytes()
        header = json.dumps({'width':w,'height':h,'intrinsics':[intr.fx,intr.fy,intr.cx,intr.cy], 'color_bytes':len(color_bytes), 'alignment':'depth_to_color' if align else None}).encode()
        stream.write(struct.pack('!I',len(header)))
        stream.write(header)
        stream.write(data.tobytes())
        if color_bytes:
            stream.write(color_bytes)
except (BrokenPipeError,KeyboardInterrupt):
    pass
except Exception as exc:
    print('相机读取失败：'+str(exc),file=sys.stderr,flush=True)
    # Send the root cause through the existing local pipe, without image data.
    try:
        error_header=json.dumps({'error':str(exc)[:800]}).encode()
        stream.write(struct.pack('!I',len(error_header)))
        stream.write(error_header)
    except (BrokenPipeError,OSError):
        pass
    sys.exit(1)
finally:
    if started:
        pipeline.stop()

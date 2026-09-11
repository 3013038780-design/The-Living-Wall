'use client';
import { useEffect, useRef } from 'react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
export default function HandCamera({
  onPoint,
  onStatus,
  onFailure,
}: {
  onPoint: (x: number, y: number, active: boolean) => void;
  onStatus: (text: string) => void;
  onFailure: (text: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let cancelled = false,
      stream: MediaStream | undefined,
      tracker: HandLandmarker | undefined,
      raf = 0,
      lastTime = -1,
      lastRun = 0,
      lastSeen = 0,
      lastStatus = '';
    const status = (s: string) => {
      if (!cancelled && s !== lastStatus) {
        lastStatus = s;
        onStatus(s);
      }
    };
    const cleanup = () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      tracker?.close();
      tracker = undefined;
    };
    const begin = async () => {
      try {
        status('正在准备手部识别…');
        const { FilesetResolver, HandLandmarker } =
          await import('@mediapipe/tasks-vision');
        const files = await FilesetResolver.forVisionTasks('/mediapipe');
        if (cancelled) return;
        const options = {
          baseOptions: { modelAssetPath: '/models/hand_landmarker.task' },
          runningMode: 'VIDEO' as const,
          numHands: 1,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        };
        try {
          tracker = await HandLandmarker.createFromOptions(files, {
            ...options,
            baseOptions: { ...options.baseOptions, delegate: 'GPU' },
          });
        } catch {
          if (cancelled) return;
          tracker = await HandLandmarker.createFromOptions(files, options);
        }
        if (cancelled) {
          cleanup();
          return;
        }
        status('请允许摄像头访问。只在本机处理，不录制。');
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            '这个浏览器无法访问摄像头，请在 Chrome 或 Safari 中打开。',
          );
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: 'user',
          },
        });
        if (cancelled) {
          cleanup();
          return;
        }
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        if (cancelled) {
          cleanup();
          return;
        }
        status('把一只手放进画面，掌心朝向摄像头。');
        const track = (now: number) => {
          if (cancelled) return;
          try {
            if (v.readyState < 2 || now - lastSeen > 200)
              onPoint(0.5, 0.5, false);
            if (
              v.readyState >= 2 &&
              now - lastRun > 45 &&
              v.currentTime !== lastTime
            ) {
              lastRun = now;
              lastTime = v.currentTime;
              const result = tracker!.detectForVideo(v, now);
              const hand = result.landmarks[0];
              if (hand) {
                const points = [hand[0], hand[5], hand[9], hand[13], hand[17]];
                const x = 1 - points.reduce((s, p) => s + p.x, 0) / 5;
                const y = points.reduce((s, p) => s + p.y, 0) / 5;
                onPoint(x, y, true);
                lastSeen = now;
                status('已找到手 · 缓慢移动，或快速挥动。');
              } else if (now - lastSeen > 200) {
                onPoint(0.5, 0.5, false);
                status('没有看到手 · 请让手掌完整进入画面。');
              }
            }
            raf = requestAnimationFrame(track);
          } catch {
            cleanup();
            if (!cancelled)
              onFailure('手部识别中断，已回到鼠标模式。可以重新启用摄像头。');
          }
        };
        raf = requestAnimationFrame(track);
      } catch (error) {
        cleanup();
        if (cancelled) return;
        const name = error instanceof Error ? error.name : '';
        onFailure(
          name === 'NotAllowedError'
            ? '未获得摄像头权限。可以继续用鼠标，或在浏览器设置中允许后重试。'
            : name === 'NotFoundError'
              ? '没有找到摄像头，请连接摄像头后重试。'
              : name === 'NotReadableError'
                ? '摄像头可能正被其他应用占用，请关闭占用它的应用后重试。'
                : '摄像头或识别模型未能启动。可以继续使用鼠标，再尝试重新启用。',
        );
      }
    };
    void begin();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [onPoint, onStatus, onFailure]);
  return (
    <video
      ref={video}
      className="camera-preview"
      autoPlay
      muted
      playsInline
      aria-label="摄像头预览，画面仅在本机处理"
    />
  );
}

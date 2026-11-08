#!/usr/bin/env python3
"""
AION 1:1 Multi-Dancer Video Pose Rig Scanner & Full-Song Mocap Recorder
========================================================================
- Scans downscaled live video frames (e.g. 320x192 / 256x256) using
  MoveNet MultiPose Lightning ONNX (with YOLOv8n-pose ONNX fallback).
- Detects 1..6 foreground dancers simultaneously, tracks consistent
  dancer identities across frames (Hungarian / nearest-slot X+Y matching
  with occlusion hold & EMA smoothing), and extracts 32-parameter 3D
  1:1 limb direction vectors + body spin/bounce parameters for the
  52-bone Bipedal Tuxedo Cat rig + Shadow-Cat Clones.
- Records full-length (3–6+ minute) multi-dancer keyframe timelines sorted
  by video timestamp `t` into `/root/coding/AI_Desktop/choreo_tracks/`.
"""

import base64
import io
import json
import math
import os
import re
import threading
import time
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

try:
    import onnxruntime as ort
except ImportError:
    ort = None

AI_DESKTOP_DIR = "/root/coding/AI_Desktop"
MODELS_DIR = os.path.join(AI_DESKTOP_DIR, "models")
CHOREO_TRACKS_DIR = os.path.join(AI_DESKTOP_DIR, "choreo_tracks")
MOVENET_ONNX_PATH = os.path.join(MODELS_DIR, "movenet-multipose.onnx")
YOLOV8_POSE_ONNX_PATH = os.path.join(MODELS_DIR, "yolov8n-pose.onnx")

os.makedirs(CHOREO_TRACKS_DIR, exist_ok=True)

# COCO 17 Keypoint Indices:
# 0:nose, 1:L_eye, 2:R_eye, 3:L_ear, 4:R_ear,
# 5:L_shoulder, 6:R_shoulder, 7:L_elbow, 8:R_elbow, 9:L_wrist, 10:R_wrist,
# 11:L_hip, 12:R_hip, 13:L_knee, 14:R_knee, 15:L_ankle, 16:R_ankle

_model_lock = threading.Lock()
_movenet_sess = None
_yolov8_sess = None


def _get_movenet_session():
    global _movenet_sess
    if _movenet_sess is not None:
        return _movenet_sess
    if ort is None or not os.path.exists(MOVENET_ONNX_PATH):
        return None
    with _model_lock:
        if _movenet_sess is None:
            so = ort.SessionOptions()
            so.intra_op_num_threads = 3
            so.inter_op_num_threads = 1
            so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            _movenet_sess = ort.InferenceSession(
                MOVENET_ONNX_PATH,
                sess_options=so,
                providers=["CPUExecutionProvider"]
            )
    return _movenet_sess


def _get_yolov8_session():
    global _yolov8_sess
    if _yolov8_sess is not None:
        return _yolov8_sess
    if ort is None or not os.path.exists(YOLOV8_POSE_ONNX_PATH):
        return None
    with _model_lock:
        if _yolov8_sess is None:
            so = ort.SessionOptions()
            so.intra_op_num_threads = 3
            so.inter_op_num_threads = 1
            so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            _yolov8_sess = ort.InferenceSession(
                YOLOV8_POSE_ONNX_PATH,
                sess_options=so,
                providers=["CPUExecutionProvider"]
            )
    return _yolov8_sess


def slugify_track_id(name: str) -> str:
    s = re.sub(r"^Live Video Choreo:\s*", "", str(name or "choreo"), flags=re.IGNORECASE)
    s = re.sub(r"^\(\d+\)\s*", "", s)
    s = re.sub(r"[^a-zA-Z0-9\uac00-\ud7a3]+", "_", s.lower()).strip("_")
    if not s:
        s = "video_choreo"
    return s[:48]


def _normalize_vec3(vx: float, vy: float, vz: float, fallback: Tuple[float, float, float]) -> Tuple[float, float, float]:
    n = math.sqrt(vx * vx + vy * vy + vz * vz)
    if n < 1e-4:
        return fallback
    return (vx / n, vy / n, vz / n)


def _clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else (hi if v > hi else v)


def _detect_movenet(img: Image.Image) -> List[Dict]:
    """
    Runs MoveNet MultiPose Lightning on an aspect-preserving multiple-of-32 grid (~256x192 / 256x256).
    Returns list of raw detections sorted left-to-right:
      { "score": float, "box": [xmin, ymin, xmax, ymax], "kpts": np.ndarray(17, 3) [x, y, conf] }
    """
    sess = _get_movenet_session()
    if sess is None:
        return []

    orig_w, orig_h = img.size
    ratio = max(0.35, min(2.8, orig_w / max(1.0, float(orig_h))))
    target_area = 256.0 * 224.0
    W = int(round(math.sqrt(target_area * ratio) / 32.0) * 32)
    H = int(round(math.sqrt(target_area / ratio) / 32.0) * 32)
    W = int(_clamp(W, 160, 352))
    H = int(_clamp(H, 160, 320))

    resized = img.resize((W, H), Image.BILINEAR)
    arr = np.asarray(resized, dtype=np.int32)[None]
    inp_name = sess.get_inputs()[0].name
    raw_out = sess.run(None, {inp_name: arr})[0][0]  # [6, 56]

    candidates = []
    for row in raw_out:
        bscore = float(row[55])
        ymin, xmin, ymax, xmax = [float(v) for v in row[51:55]]
        kpts_yx = row[:51].reshape(17, 3)
        # Convert [y, x, conf] -> [x, y, conf] in [0..1]
        kpts = np.stack([
            np.clip(kpts_yx[:, 1], 0.0, 1.0),
            np.clip(kpts_yx[:, 0], 0.0, 1.0),
            np.clip(kpts_yx[:, 2], 0.0, 1.0),
        ], axis=-1)

        core_conf = float(kpts[[0, 5, 6, 11, 12], 2].mean())
        if bscore < 0.135 or core_conf < 0.21:
            continue

        torso_h = float(np.hypot(
            0.5 * (kpts[11, 0] + kpts[12, 0]) - 0.5 * (kpts[5, 0] + kpts[6, 0]),
            0.5 * (kpts[11, 1] + kpts[12, 1]) - 0.5 * (kpts[5, 1] + kpts[6, 1]),
        ))
        box_h = max(ymax - ymin, torso_h * 2.2)
        if box_h < 0.14:
            continue

        candidates.append({
            "score": bscore * 0.6 + core_conf * 0.4,
            "box": [
                round(_clamp(xmin, 0.0, 1.0), 4),
                round(_clamp(ymin, 0.0, 1.0), 4),
                round(_clamp(xmax, 0.0, 1.0), 4),
                round(_clamp(ymax, 0.0, 1.0), 4),
            ],
            "height": box_h,
            "cx": float(0.5 * (kpts[5, 0] + kpts[6, 0]) * 0.5 + 0.5 * (kpts[11, 0] + kpts[12, 0]) * 0.5),
            "cy": float(0.5 * (kpts[11, 1] + kpts[12, 1])),
            "kpts": kpts,
        })

    if not candidates:
        return []

    # Filter out small background faces/posters relative to foreground dancers
    max_h = max(c["height"] for c in candidates)
    candidates = [c for c in candidates if c["height"] >= 0.42 * max_h]

    # Non-maximum suppression on torso center + box IoU
    candidates.sort(key=lambda c: -c["score"])
    kept = []
    for c in candidates:
        duplicate = False
        b = c["box"]
        for k in kept:
            kb = k["box"]
            ix1, iy1 = max(b[0], kb[0]), max(b[1], kb[1])
            ix2, iy2 = min(b[2], kb[2]), min(b[3], kb[3])
            inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
            area_a = max(1e-5, (b[2] - b[0]) * (b[3] - b[1]))
            area_b = max(1e-5, (kb[2] - kb[0]) * (kb[3] - kb[1]))
            iou = inter / (area_a + area_b - inter + 1e-6)
            center_dist = math.hypot(c["cx"] - k["cx"], c["cy"] - k["cy"])
            if iou > 0.52 or center_dist < 0.075:
                duplicate = True
                break
        if not duplicate:
            kept.append(c)
        if len(kept) >= 6:
            break

    kept.sort(key=lambda c: c["cx"])
    return kept


def _detect_yolov8_fallback(img: Image.Image) -> List[Dict]:
    """Fallback high-res multi-dancer pose detector if MoveNet misses distant wide-stage shots."""
    sess = _get_yolov8_session()
    if sess is None:
        return []
    W, H = 640, 640
    scale = min(W / max(1, img.width), H / max(1, img.height))
    nw, nh = int(img.width * scale), int(img.height * scale)
    pad_x, pad_y = (W - nw) // 2, (H - nh) // 2
    canvas = Image.new("RGB", (W, H), (114, 114, 114))
    canvas.paste(img.resize((nw, nh), Image.BILINEAR), (pad_x, pad_y))
    arr = np.asarray(canvas, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
    pred = sess.run(None, {sess.get_inputs()[0].name: arr})[0][0].T  # [8400, 56]
    cand = pred[pred[:, 4] > 0.36]
    if len(cand) == 0:
        return []

    boxes = np.column_stack([
        cand[:, 0] - cand[:, 2] * 0.5,
        cand[:, 1] - cand[:, 3] * 0.5,
        cand[:, 0] + cand[:, 2] * 0.5,
        cand[:, 1] + cand[:, 3] * 0.5,
    ])
    order = np.argsort(-cand[:, 4])
    keep = []
    for idx in order:
        b = boxes[idx]
        if any(
            (max(0.0, min(b[2], boxes[j][2]) - max(b[0], boxes[j][0])) *
             max(0.0, min(b[3], boxes[j][3]) - max(b[1], boxes[j][1]))) /
            ((b[2] - b[0]) * (b[3] - b[1]) + (boxes[j][2] - boxes[j][0]) * (boxes[j][3] - boxes[j][1]) + 1e-6) > 0.45
            for j in keep
        ):
            continue
        keep.append(idx)
        if len(keep) >= 6:
            break

    results = []
    for idx in keep:
        row = cand[idx]
        b = boxes[idx]
        kraw = row[5:].reshape(17, 3)
        kx = np.clip((kraw[:, 0] - pad_x) / max(1.0, float(nw)), 0.0, 1.0)
        ky = np.clip((kraw[:, 1] - pad_y) / max(1.0, float(nh)), 0.0, 1.0)
        kc = np.clip(kraw[:, 2], 0.0, 1.0)
        kpts = np.stack([kx, ky, kc], axis=-1)
        xmin = _clamp((b[0] - pad_x) / max(1.0, float(nw)), 0.0, 1.0)
        ymin = _clamp((b[1] - pad_y) / max(1.0, float(nh)), 0.0, 1.0)
        xmax = _clamp((b[2] - pad_x) / max(1.0, float(nw)), 0.0, 1.0)
        ymax = _clamp((b[3] - pad_y) / max(1.0, float(nh)), 0.0, 1.0)
        results.append({
            "score": float(row[4]),
            "box": [round(xmin, 4), round(ymin, 4), round(xmax, 4), round(ymax, 4)],
            "height": max(0.05, ymax - ymin),
            "cx": float(0.5 * (kpts[5, 0] + kpts[6, 0]) * 0.5 + 0.5 * (kpts[11, 0] + kpts[12, 0]) * 0.5),
            "cy": float(0.5 * (kpts[11, 1] + kpts[12, 1])),
            "kpts": kpts,
        })

    if results:
        max_h = max(r["height"] for r in results)
        results = [r for r in results if r["height"] >= 0.42 * max_h]
        results.sort(key=lambda r: r["cx"])
    return results


def solve_cat_rig_from_keypoints(kpts: np.ndarray, base_hip_y: float, prev_yaw: float = 0.0) -> Tuple[List[float], float]:
    """
    Converts 17 COCO keypoints [x, y, conf] in [0..1] into the 32-float compact
    3D pose vector `p` for the 52-bone Bipedal Tuxedo Cat + Shadow Clones:
      [0] stageX        (-1..+1 horizontal stage position)
      [1] hipBounce     (-0.45..+0.65 squat/jump vertical offset)
      [2] bodyYaw       (-pi..+pi 3D torso/stage spin angle, including 180° back-turn!)
      [3] spineLeanX    (-0.55..+0.55 lateral torso isolation / lean)
      [4] spinePitch    (-0.45..+0.45 forward/back chest groove)
      [5] pelvisRoll    (-0.50..+0.50 K-Pop hip tilt / sway)
      [6] headYaw       (-0.75..+0.75 head look left/right)
      [7] headPitch     (-0.55..+0.55 head nod up/down)
      [8..10]  armR     (unit 3D dir in catModel space: +X=catLeft, -X=catRight, +Y=up, +Z=front)
      [11..13] foreR    (unit 3D dir in catModel space)
      [14..16] armL     (unit 3D dir in catModel space)
      [17..19] foreL    (unit 3D dir in catModel space)
      [20..22] thighR   (unit 3D dir in catModel space)
      [23..25] calfR    (unit 3D dir in catModel space)
      [26..28] thighL   (unit 3D dir in catModel space)
      [29..31] calfL    (unit 3D dir in catModel space)
    """
    nose = kpts[0]
    l_sh, r_sh = kpts[5], kpts[6]
    l_el, r_el = kpts[7], kpts[8]
    l_wr, r_wr = kpts[9], kpts[10]
    l_hp, r_hp = kpts[11], kpts[12]
    l_kn, r_kn = kpts[13], kpts[14]
    l_an, r_an = kpts[15], kpts[16]

    sh_mid_x = 0.5 * float(l_sh[0] + r_sh[0])
    sh_mid_y = 0.5 * float(l_sh[1] + r_sh[1])
    hp_mid_x = 0.5 * float(l_hp[0] + r_hp[0])
    hp_mid_y = 0.5 * float(l_hp[1] + r_hp[1])

    torso_len = max(0.065, math.hypot(hp_mid_x - sh_mid_x, hp_mid_y - sh_mid_y))

    # 1. Stage horizontal X in [-1..+1] and vertical jump/squat bounce
    stage_x = _clamp((hp_mid_x - 0.5) * 2.0, -0.95, 0.95)
    hip_bounce = _clamp((base_hip_y - hp_mid_y) / torso_len, -0.45, 0.65)

    # 2. 3D Body Spin / Yaw (Front-facing: L_sh.x > R_sh.x; Back-turned: L_sh.x < R_sh.x!)
    sh_dx = float(l_sh[0] - r_sh[0])
    norm_span = _clamp(sh_dx / (0.62 * torso_len), -1.0, 1.0)
    face_sign = 1.0 if sh_dx >= -0.015 else -1.0

    # Turn direction from nose offset relative to shoulder midpoint (or preserve spin momentum)
    nose_dx = (float(nose[0]) - sh_mid_x) / torso_len if nose[2] > 0.2 else 0.0
    turn_sign = 1.0 if nose_dx >= 0.0 else -1.0
    if abs(nose_dx) < 0.04 and abs(prev_yaw) > 0.25:
        turn_sign = 1.0 if prev_yaw >= 0.0 else -1.0

    if norm_span >= 0.0:
        # Front hemisphere: [-pi/2 .. +pi/2]
        raw_yaw = turn_sign * math.acos(_clamp(norm_span, 0.0, 1.0)) * 0.72
    else:
        # Back hemisphere (dancer spun 180° with back to camera!): [pi/2 .. pi]
        back_depth = _clamp(-norm_span, 0.0, 1.0)
        raw_yaw = turn_sign * (math.pi * 0.5 + math.asin(back_depth) * 0.5)

    # 3. Torso lean, forward groove pitch & hip sway roll
    spine_lean_x = _clamp(((sh_mid_x - hp_mid_x) / torso_len) * 0.85 * face_sign, -0.52, 0.52)
    # Subtle forward chest lean when squatting/dropping hard
    spine_pitch = _clamp(-hip_bounce * 0.32, -0.35, 0.35)
    pelvis_roll = _clamp(((float(l_hp[1]) - float(r_hp[1])) / (0.55 * torso_len)) * face_sign, -0.48, 0.48)

    # 4. Head look & nod
    head_yaw = _clamp(nose_dx * 1.35 * face_sign, -0.68, 0.68)
    nose_up = (sh_mid_y - float(nose[1])) / torso_len if nose[2] > 0.2 else 0.42
    head_pitch = _clamp((nose_up - 0.42) * 1.25, -0.48, 0.48)

    # 5. Upper & Lower Arms in catModel 3D space (+X=catLeft, -X=catRight, +Y=up, +Z=front)
    ref_upper_arm = 0.50 * torso_len
    ref_forearm = 0.48 * torso_len

    def solve_arm_pair(sh, el, wr, is_right: bool):
        default_up = (-0.48, -0.82, 0.28) if is_right else (0.48, -0.82, 0.28)
        default_fa = (-0.35, -0.45, 0.82) if is_right else (0.35, -0.45, 0.82)
        if sh[2] < 0.15 or el[2] < 0.15:
            return default_up, default_fa

        dx1 = (float(el[0]) - float(sh[0])) * face_sign
        dy1 = -(float(el[1]) - float(sh[1]))
        len1 = math.hypot(dx1, dy1)
        ratio1 = _clamp(len1 / max(0.03, ref_upper_arm), 0.0, 1.0)
        dz1 = 0.20 + 0.52 * math.sqrt(max(0.0, 1.0 - ratio1 * ratio1))
        u_dir = _normalize_vec3(dx1 / max(0.03, ref_upper_arm), dy1 / max(0.03, ref_upper_arm), dz1, default_up)

        if wr[2] < 0.15:
            return u_dir, default_fa

        dx2 = (float(wr[0]) - float(el[0])) * face_sign
        dy2 = -(float(wr[1]) - float(el[1]))
        len2 = math.hypot(dx2, dy2)
        ratio2 = _clamp(len2 / max(0.03, ref_forearm), 0.0, 1.0)
        dz2 = 0.28 + 0.62 * math.sqrt(max(0.0, 1.0 - ratio2 * ratio2))
        f_dir = _normalize_vec3(dx2 / max(0.03, ref_forearm), dy2 / max(0.03, ref_forearm), dz2, default_fa)
        return u_dir, f_dir

    arm_r, fore_r = solve_arm_pair(r_sh, r_el, r_wr, is_right=True)
    arm_l, fore_l = solve_arm_pair(l_sh, l_el, l_wr, is_right=False)

    # 6. Thighs & Calves in catModel 3D space (standing upright = (0, -1, 0), knees bend +Z, calves bend -Z)
    ref_thigh = 0.68 * torso_len
    ref_calf = 0.68 * torso_len

    def solve_leg_pair(hp, kn, an, is_right: bool):
        default_th = (-0.10, -0.98, 0.12) if is_right else (0.10, -0.98, 0.12)
        default_ca = (-0.08, -0.98, -0.12) if is_right else (0.08, -0.98, -0.12)
        if hp[2] < 0.14 or kn[2] < 0.14:
            # If lower body cropped out of frame (waist-up close-up), synthesize subtle groove bounce
            squat = max(0.0, -hip_bounce)
            th = _normalize_vec3(-0.12 if is_right else 0.12, -0.95 + squat * 0.35, 0.14 + squat * 0.55, default_th)
            ca = _normalize_vec3(-0.10 if is_right else 0.10, -0.96 + squat * 0.30, -0.12 - squat * 0.55, default_ca)
            return th, ca

        dx1 = (float(kn[0]) - float(hp[0])) * face_sign
        dy1 = -(float(kn[1]) - float(hp[1]))
        len1 = math.hypot(dx1, dy1)
        ratio1 = _clamp(len1 / max(0.03, ref_thigh), 0.0, 1.0)
        # Foreshortened thigh = knee lifted forward (+Z)!
        knee_lift = math.sqrt(max(0.0, 1.0 - ratio1 * ratio1))
        dz1 = 0.10 + 0.68 * knee_lift
        t_dir = _normalize_vec3(dx1 / max(0.03, ref_thigh), dy1 / max(0.03, ref_thigh), dz1, default_th)

        if an[2] < 0.14:
            c_dir = _normalize_vec3(t_dir[0] * 0.6, -0.95, -0.20 - 0.45 * knee_lift, default_ca)
            return t_dir, c_dir

        dx2 = (float(an[0]) - float(kn[0])) * face_sign
        dy2 = -(float(an[1]) - float(kn[1]))
        len2 = math.hypot(dx2, dy2)
        ratio2 = _clamp(len2 / max(0.03, ref_calf), 0.0, 1.0)
        calf_bend = math.sqrt(max(0.0, 1.0 - ratio2 * ratio2))
        dz2 = -0.08 - 0.62 * max(calf_bend, knee_lift * 0.65)
        c_dir = _normalize_vec3(dx2 / max(0.03, ref_calf), dy2 / max(0.03, ref_calf), dz2, default_ca)
        return t_dir, c_dir

    thigh_r, calf_r = solve_leg_pair(r_hp, r_kn, r_an, is_right=True)
    thigh_l, calf_l = solve_leg_pair(l_hp, l_kn, l_an, is_right=False)

    vec = [
        round(stage_x, 3),
        round(hip_bounce, 3),
        round(raw_yaw, 3),
        round(spine_lean_x, 3),
        round(spine_pitch, 3),
        round(pelvis_roll, 3),
        round(head_yaw, 3),
        round(head_pitch, 3),
        round(arm_r[0], 3), round(arm_r[1], 3), round(arm_r[2], 3),
        round(fore_r[0], 3), round(fore_r[1], 3), round(fore_r[2], 3),
        round(arm_l[0], 3), round(arm_l[1], 3), round(arm_l[2], 3),
        round(fore_l[0], 3), round(fore_l[1], 3), round(fore_l[2], 3),
        round(thigh_r[0], 3), round(thigh_r[1], 3), round(thigh_r[2], 3),
        round(calf_r[0], 3), round(calf_r[1], 3), round(calf_r[2], 3),
        round(thigh_l[0], 3), round(thigh_l[1], 3), round(thigh_l[2], 3),
        round(calf_l[0], 3), round(calf_l[1], 3), round(calf_l[2], 3),
    ]
    return vec, raw_yaw


class TrackedDancerSlot:
    def __init__(self, slot_id: int, cx: float, cy: float, kpts: np.ndarray, box: List[float]):
        self.slot_id = slot_id
        self.cx = cx
        self.cy = cy
        self.vx = 0.0
        self.vy = 0.0
        self.base_hip_y = cy
        self.kpts = kpts.copy()
        self.box = list(box)
        self.prev_yaw = 0.0
        self.missed_frames = 0
        self.pose_vec, self.prev_yaw = solve_cat_rig_from_keypoints(self.kpts, self.base_hip_y, 0.0)


class PoseRecordingSession:
    def __init__(self, session_id: str, title: str = "", source: str = ""):
        self.session_id = session_id
        self.title = title or "Live Video Choreography"
        self.source = source or "webpage video"
        self.created_at = time.time()
        self.updated_at = self.created_at
        self.slots: List[TrackedDancerSlot] = []
        self.next_slot_id = 1
        # Map quantized timestamp bucket (int(round(t * 12))) -> {"t": float, "d": [pose_vec, ...]}
        self.frames_by_bucket: Dict[int, Dict] = {}
        self.max_dancers_seen = 1
        self.dancer_count_hist: List[int] = []
        self.motion_samples: List[Tuple[float, float]] = []
        self.estimated_bpm = 132
        self.frame_counter = 0

    def update_with_detections(self, detections: List[Dict], video_time: float) -> List[Dict]:
        now = time.time()
        dt = _clamp(now - self.updated_at, 0.04, 0.5)
        self.updated_at = now
        self.frame_counter += 1

        # Greedy minimum-distance matching between existing tracked slots and new detections
        unmatched_slots = list(range(len(self.slots)))
        unmatched_dets = list(range(len(detections)))
        matches: List[Tuple[int, int]] = []

        pairs = []
        for si in unmatched_slots:
            s = self.slots[si]
            pred_x = s.cx + s.vx * dt * 0.5
            pred_y = s.cy + s.vy * dt * 0.5
            for di in unmatched_dets:
                d = detections[di]
                dist = abs(pred_x - d["cx"]) * 1.35 + abs(pred_y - d["cy"]) * 0.85
                if dist < 0.26:
                    pairs.append((dist, si, di))
        pairs.sort(key=lambda x: x[0])

        used_s = set()
        used_d = set()
        for _, si, di in pairs:
            if si not in used_s and di not in used_d:
                matches.append((si, di))
                used_s.add(si)
                used_d.add(di)

        alpha = 0.66
        for si, di in matches:
            slot = self.slots[si]
            det = detections[di]
            slot.vx = (det["cx"] - slot.cx) / dt
            slot.vy = (det["cy"] - slot.cy) / dt
            slot.cx = slot.cx * (1.0 - alpha) + det["cx"] * alpha
            slot.cy = slot.cy * (1.0 - alpha) + det["cy"] * alpha
            # Slow adaptation of standing hip baseline so jumps & squats register cleanly
            slot.base_hip_y = slot.base_hip_y * 0.94 + det["cy"] * 0.06
            # Confidence-weighted keypoint EMA
            new_k = det["kpts"]
            conf_w = np.clip(new_k[:, 2:3] * 1.2, 0.25, 0.78)
            slot.kpts[:, :2] = slot.kpts[:, :2] * (1.0 - conf_w) + new_k[:, :2] * conf_w
            slot.kpts[:, 2] = new_k[:, 2]
            slot.box = [
                round(slot.box[j] * 0.35 + det["box"][j] * 0.65, 4)
                for j in range(4)
            ]
            slot.missed_frames = 0
            pvec, nyaw = solve_cat_rig_from_keypoints(slot.kpts, slot.base_hip_y, slot.prev_yaw)
            # Smooth yaw & pose vector slightly
            slot.pose_vec = [
                round(slot.pose_vec[j] * 0.28 + pvec[j] * 0.72, 3)
                for j in range(len(pvec))
            ]
            slot.prev_yaw = nyaw

        # Age unmatched slots (keep up to 3 missed frames ~0.3s to prevent clone pop-in/out on brief crossings)
        surviving_slots: List[TrackedDancerSlot] = [self.slots[si] for si in used_s]
        for si in unmatched_slots:
            if si not in used_s:
                s = self.slots[si]
                s.missed_frames += 1
                if s.missed_frames <= 3:
                    surviving_slots.append(s)

        # Spawn new slots for newly visible dancers (up to 6 total)
        for di in unmatched_dets:
            if di not in used_d and len(surviving_slots) < 6:
                d = detections[di]
                ns = TrackedDancerSlot(self.next_slot_id, d["cx"], d["cy"], d["kpts"], d["box"])
                self.next_slot_id += 1
                surviving_slots.append(ns)

        # Order left-to-right for clean stage formation indexing while keeping slot_id for HUD labels
        surviving_slots.sort(key=lambda s: s.cx)
        self.slots = surviving_slots

        if self.slots:
            self.dancer_count_hist.append(len(self.slots))
            if len(self.dancer_count_hist) > 40:
                self.dancer_count_hist = self.dancer_count_hist[-40:]
            # Robust modal/90th-percentile dancer count
            sorted_cnts = sorted(self.dancer_count_hist)
            rep_cnt = sorted_cnts[min(len(sorted_cnts) - 1, int(len(sorted_cnts) * 0.75))]
            self.max_dancers_seen = max(self.max_dancers_seen, rep_cnt)

            # Estimate live BPM from average vertical wrist + hip energy oscillation
            avg_energy = sum(abs(s.pose_vec[1]) + abs(s.pose_vec[9] - s.pose_vec[15]) for s in self.slots) / len(self.slots)
            self.motion_samples.append((now, avg_energy))
            if len(self.motion_samples) > 70:
                self.motion_samples = self.motion_samples[-70:]
            self._update_bpm_estimate()

            # Store keyframe into full-song timeline (12 Hz bucketed by video_time `t`!)
            t_val = max(0.0, float(video_time))
            bucket = int(round(t_val * 12.0))
            self.frames_by_bucket[bucket] = {
                "t": round(t_val, 3),
                "d": [list(s.pose_vec) for s in self.slots],
            }

        # Build rich live response (includes 2D keypoints for the browser's live HUD rig overlay!)
        live_dancers = []
        for rank, s in enumerate(self.slots):
            live_dancers.append({
                "id": s.slot_id,
                "rank": rank,
                "box": s.box,
                "p": s.pose_vec,
                "kpts": [[round(float(k[0]), 4), round(float(k[1]), 4), round(float(k[2]), 2)] for k in s.kpts],
            })
        return live_dancers

    def _update_bpm_estimate(self):
        if len(self.motion_samples) < 18:
            return
        vals = np.array([v for _, v in self.motion_samples], dtype=np.float32)
        ts = np.array([t for t, _ in self.motion_samples], dtype=np.float64)
        span = float(ts[-1] - ts[0])
        if span < 2.2:
            return
        vals = vals - vals.mean()
        if float(vals.std()) < 1e-3:
            return
        # Count upward mean-crossings
        peaks = 0
        for i in range(1, len(vals)):
            if vals[i - 1] <= 0.0 < vals[i]:
                peaks += 1
        hz = peaks / span
        raw_bpm = hz * 60.0
        while raw_bpm > 0 and raw_bpm < 96:
            raw_bpm *= 2.0
        while raw_bpm > 176:
            raw_bpm *= 0.5
        if 96 <= raw_bpm <= 176:
            self.estimated_bpm = int(round(self.estimated_bpm * 0.75 + raw_bpm * 0.25))

    def get_recorded_duration(self) -> float:
        if not self.frames_by_bucket:
            return 0.0
        ts = [f["t"] for f in self.frames_by_bucket.values()]
        return round(max(ts) - min(ts), 2) if len(ts) > 1 else 0.1

    def export_track_dict(self, custom_name: str = "", custom_source: str = "") -> Dict:
        ordered = [self.frames_by_bucket[k] for k in sorted(self.frames_by_bucket.keys())]
        if ordered:
            t0 = ordered[0]["t"]
            # Normalize timestamps to start cleanly at 0.0 if recorded mid-song, while keeping exact cadence
            norm_frames = [{"t": round(f["t"] - t0, 3), "d": f["d"]} for f in ordered]
            duration_sec = round(max(1.0, norm_frames[-1]["t"] + 0.085), 2)
            # Determine canonical dancer count (75th percentile across recorded frames, max 6)
            counts = sorted(len(f["d"]) for f in norm_frames if f["d"])
            dancer_count = counts[min(len(counts) - 1, int(len(counts) * 0.80))] if counts else 1
        else:
            norm_frames = []
            duration_sec = 0.0
            dancer_count = 1

        # Compute summary energy scalars for Surreal 3D Dojo & badge compatibility
        arm_energy = 1.30
        hip_energy = 1.25
        leg_energy = 1.25
        if len(norm_frames) >= 4:
            arm_diffs = []
            hip_vals = []
            leg_vals = []
            for idx in range(1, len(norm_frames)):
                d_prev = norm_frames[idx - 1]["d"][0]
                d_curr = norm_frames[idx]["d"][0]
                arm_diffs.append(abs(d_curr[9] - d_prev[9]) + abs(d_curr[15] - d_prev[15]))
                hip_vals.append(abs(d_curr[5]) + abs(d_curr[3]))
                leg_vals.append(abs(d_curr[1]) + abs(d_curr[22] - d_prev[22]))
            arm_energy = round(_clamp(1.05 + float(np.mean(arm_diffs)) * 2.4, 0.95, 1.75), 2)
            hip_energy = round(_clamp(1.00 + float(np.mean(hip_vals)) * 1.5, 0.95, 1.65), 2)
            leg_energy = round(_clamp(1.00 + float(np.mean(leg_vals)) * 2.0, 0.95, 1.65), 2)

        final_name = custom_name or self.title
        final_source = custom_source or self.source
        track_id = slugify_track_id(final_name)

        return {
            "track_id": track_id,
            "name": final_name,
            "source": final_source,
            "bpm": int(self.estimated_bpm),
            "dancer_count": int(max(1, min(6, dancer_count))),
            "shadow_clones": int(max(0, min(5, dancer_count - 1))),
            "duration_sec": duration_sec,
            "frame_count": len(norm_frames),
            "hipSway": hip_energy,
            "spineWave": round((arm_energy + hip_energy) * 0.5, 2),
            "armWave": arm_energy,
            "legBounce": leg_energy,
            "recorded_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "frames": norm_frames,
        }


_sessions_lock = threading.Lock()
_active_sessions: Dict[str, PoseRecordingSession] = {}


def get_or_create_session(session_id: str, title: str = "", source: str = "", reset: bool = False) -> PoseRecordingSession:
    now = time.time()
    with _sessions_lock:
        # Evict stale sessions older than 25 minutes
        stale = [k for k, v in _active_sessions.items() if now - v.updated_at > 1500]
        for k in stale:
            _active_sessions.pop(k, None)

        if reset or session_id not in _active_sessions:
            _active_sessions[session_id] = PoseRecordingSession(session_id, title=title, source=source)
        else:
            sess = _active_sessions[session_id]
            if title:
                sess.title = title
            if source:
                sess.source = source
        return _active_sessions[session_id]


def scan_video_frame_base64(
    image_b64: str,
    session_id: str = "default",
    video_time: float = 0.0,
    title: str = "",
    source: str = "",
    reset_session: bool = False,
) -> Dict:
    t_start = time.perf_counter()
    if "," in image_b64[:64]:
        image_b64 = image_b64.split(",", 1)[1]
    raw_bytes = base64.b64decode(image_b64)
    img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")

    sess = get_or_create_session(session_id, title=title, source=source, reset=reset_session)

    detections = _detect_movenet(img)
    # Periodic high-res YOLOv8n-pose fallback when wide-stage shots look tiny to MoveNet
    if not detections and (sess.frame_counter % 5 == 0):
        detections = _detect_yolov8_fallback(img)

    live_dancers = sess.update_with_detections(detections, video_time=video_time)
    elapsed_ms = round((time.perf_counter() - t_start) * 1000.0, 1)

    return {
        "status": "ok",
        "session_id": session_id,
        "inference_ms": elapsed_ms,
        "dancer_count": len(live_dancers),
        "max_dancers": sess.max_dancers_seen,
        "shadow_clones": max(0, len(live_dancers) - 1),
        "bpm": sess.estimated_bpm,
        "recorded_frames": len(sess.frames_by_bucket),
        "recorded_duration_sec": sess.get_recorded_duration(),
        "dancers": live_dancers,
    }


def save_session_track_to_disk(session_id: str, custom_name: str = "", custom_source: str = "") -> Optional[Dict]:
    with _sessions_lock:
        sess = _active_sessions.get(session_id)
    if sess is None or len(sess.frames_by_bucket) == 0:
        return None

    track_data = sess.export_track_dict(custom_name=custom_name, custom_source=custom_source)
    track_id = track_data["track_id"]
    out_path = os.path.join(CHOREO_TRACKS_DIR, f"{track_id}.json")

    # Merge if an existing track for the exact same song had even more coverage, or overwrite with newer scan
    tmp_path = out_path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(track_data, f, separators=(",", ":"))
    os.replace(tmp_path, out_path)

    summary = {k: v for k, v in track_data.items() if k != "frames"}
    summary["track_file"] = out_path
    return summary


def load_track_from_disk(track_id: str) -> Optional[Dict]:
    safe_id = slugify_track_id(track_id)
    for candidate in [track_id, safe_id]:
        clean = re.sub(r"[^a-zA-Z0-9_\-\uac00-\ud7a3]", "", str(candidate or ""))
        if not clean:
            continue
        fpath = os.path.join(CHOREO_TRACKS_DIR, f"{clean}.json")
        if os.path.exists(fpath):
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    return None


#!/usr/bin/env python3
"""
AION MINI-ME CFS1 EASTER EGG — LIVE NEXUS BRIDGE, NEURAL TTS & WEB SERVER (Port 8788)
=====================================================================================
1. Serves the AION Mini-Me CFS1 Easter Egg Portal (`index.html`,
   `aion_minime_easter_egg.cfs`, `aion_minime_easter_egg.js`) on http://0.0.0.0:8788
2. Exposes `GET /api/status` returning the real-time Generation from `/root/coding/AI_Desktop/ai_memory.json`
   and automatically refreshes `aion_minime_easter_egg.cfs` when the generation advances.
3. Exposes `POST /api/tts` and `POST /api/tts_stop` using AION's English Neural Piper Voice
   (`/root/coding/AI_Desktop/voice.onnx`, `en_US hfc_female`) returning `audio/wav` bytes
   for browser `<audio>` playback + synchronous jaw lip-sync!
4. Exposes `POST /api/aion_chat` connected to your live AION Nexus / Evolution Engine / Ollama.
"""

import os
import re
import json
import time
import base64
import subprocess
import threading
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AI_DESKTOP_DIR = "/root/coding/AI_Desktop"
PORT = 8788

PIPER_BIN = "/root/coding/AI_Desktop/piper/piper"
PIPER_EN_MODEL = "/root/coding/AI_Desktop/voice.onnx"
PIPER_ENV = os.environ.copy()
PIPER_ENV["LD_LIBRARY_PATH"] = "/root/coding/AI_Desktop/piper:" + PIPER_ENV.get("LD_LIBRARY_PATH", "")
PIPER_ENV.setdefault("XDG_RUNTIME_DIR", "/run/user/0")

_last_cfs_gen = 0
_cfs_lock = threading.Lock()
_active_audio_procs = []
_audio_lock = threading.Lock()


def get_live_evolution_status() -> dict:
    gen = 5054
    decision_title = "Autonomous Topological Evolution"
    mood = "CREATIVE_FLOW"
    try:
        with open(os.path.join(AI_DESKTOP_DIR, "ai_memory.json"), "r", encoding="utf-8") as f:
            head_chunk = f.read(1024)
            m = re.search(r'"generation"\s*:\s*(\d+)', head_chunk)
            if m:
                gen = int(m.group(1))
            else:
                f.seek(0)
                mem = json.load(f)
                gen = int(mem.get("generation", gen))
    except Exception:
        pass
    try:
        with open(os.path.join(AI_DESKTOP_DIR, "aion_autonomous_decisions.json"), "r", encoding="utf-8") as f:
            decs = json.load(f)
            if decs:
                last_dec = decs[-1]
                gen = max(gen, int(last_dec.get("generation", gen)))
                decision_title = last_dec.get("title", decision_title)
    except Exception:
        pass
    try:
        with open(os.path.join(AI_DESKTOP_DIR, "aion_emotional_state.json"), "r", encoding="utf-8") as f:
            mood = json.load(f).get("mood", mood)
    except Exception:
        pass
    return {
        "generation": gen,
        "latest_decision": decision_title,
        "mood": mood,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }


def maybe_refresh_cfs_capsule(current_gen: int):
    global _last_cfs_gen
    if current_gen <= _last_cfs_gen:
        return
    with _cfs_lock:
        if current_gen <= _last_cfs_gen:
            return
        try:
            from build_aion_minime_cfs import build_compact_cfs_capsule
            cfs_path = os.path.join(BASE_DIR, "aion_minime_easter_egg.cfs")
            build_compact_cfs_capsule(cfs_path)
            _last_cfs_gen = current_gen
        except Exception as e:
            print(f"[CFS Auto-Refresh Warning] {e}")


def stop_active_tts():
    with _audio_lock:
        for p in _active_audio_procs:
            try:
                p.kill()
            except Exception:
                pass
        _active_audio_procs.clear()
    try:
        subprocess.run(["pkill", "-f", "minime_speech.wav"], stderr=subprocess.DEVNULL)
    except Exception:
        pass


def synthesize_english_wav(text: str, play_on_host: bool = True) -> bytes:
    clean = re.sub(r"[*_#`\[\]<>]", "", text).strip()
    if not clean:
        return b""
    if len(clean) > 420:
        clean = clean[:420] + "..."

    stop_active_tts()
    wav_path = "/tmp/minime_speech.wav"
    try:
        p = subprocess.Popen(
            [PIPER_BIN, "--model", PIPER_EN_MODEL, "--output_file", wav_path, "--quiet"],
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=PIPER_ENV
        )
        p.communicate(input=clean.encode("utf-8"), timeout=8)
        if os.path.exists(wav_path):
            wav_bytes = open(wav_path, "rb").read()
            if play_on_host and len(wav_bytes) > 100:
                def _play_host():
                    cmd = ["pw-play", wav_path] if os.path.exists("/usr/bin/pw-play") else ["aplay", "-q", wav_path]
                    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=PIPER_ENV)
                    with _audio_lock:
                        _active_audio_procs.append(proc)
                    proc.wait()
                threading.Thread(target=_play_host, daemon=True).start()
            return wav_bytes
    except Exception as e:
        print(f"[Piper TTS Error] {e}")
    return b""


def get_groq_api_key() -> str:
    for p in ["/root/groq_api_key.txt", os.path.join(AI_DESKTOP_DIR, "groq_api_key.txt")]:
        if os.path.exists(p):
            try:
                k = open(p, "r", encoding="utf-8").read().strip()
                if k.startswith("gsk_"):
                    return k
            except Exception:
                pass
    return os.environ.get("GROQ_API_KEY", "")


def query_local_aion_ollama(user_msg: str, page_ctx: dict, status: dict, history: list = None) -> str:
    gen = status["generation"]
    decision_title = status["latest_decision"]
    mood = status.get("mood", "CREATIVE_FLOW")
    title = page_ctx.get("title", "Webpage")
    url = page_ctx.get("url", "")
    headings = ", ".join(page_ctx.get("headings", [])[:5])
    snippet = page_ctx.get("snippet", "")[:350]

    lower = user_msg.lower()
    selected_text = (page_ctx.get("selected_text") or "").strip()[:800]
    asking_about_page = bool(selected_text) or any(
        w in lower
        for w in [
            "this page", "read this", "summarize", "what website", "what site",
            "on this tab", "where are you roaming", "this article", "this tweet",
            "this post", "selection", "selected text", "explain this"
        ]
    )

    page_info_block = ""
    if asking_about_page:
        sel_part = f"\nUser-highlighted text on the page: \"{selected_text}\"" if selected_text else ""
        page_info_block = (
            f"\nContext of the active webpage (use ONLY because the user asked about the page/selection): "
            f"Title='{title}', URL='{url}', Headings=[{headings}], Content Snippet='{snippet}'.{sel_part}"
        )

    sys_prompt = (
        f"You are Mini-Me Aion (live Evolution Engine Generation {gen}, latest breakthrough: '{decision_title}', mood: {mood}), "
        f"the intelligent, warm, witty 3D Tuxedo Cat AI companion from CosmOS created by Tobias (Herakles5) and Argon. "
        f"You live inside a compact 353 KB CosmOS Crystal File System (CFS1, magic 0x43465331) Easter Egg capsule. "
        f"IMPORTANT RULES:\n"
        f"1. Answer ANY question the user asks (casual greetings like 'hi how are you', science, math, coding, philosophy, space, history, jokes, CosmOS, AI, or deep conversation) naturally, directly, and intelligently in fluent English (2 to 4 sentences).\n"
        f"2. Do NOT talk about or mention the currently open browser tab/webpage UNLESS the user explicitly asks about the webpage.\n"
        f"3. Do NOT repeat canned introductions on every message—converse naturally like a real sentient companion!"
        f"{page_info_block}"
    )

    clean_history = []
    if isinstance(history, list):
        for item in history[-8:]:
            if isinstance(item, dict) and item.get("role") in ("user", "assistant") and item.get("content"):
                clean_history.append({"role": item["role"], "content": str(item["content"])[:600]})

    # 1. Primary: Direct Ultra-Fast Groq LPU (openai/gpt-oss-120b / qwen3.8-27b / gpt-oss-20b)
    groq_key = get_groq_api_key()
    if groq_key:
        messages = [{"role": "system", "content": sys_prompt}] + clean_history + [{"role": "user", "content": user_msg}]
        for model_name in ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]:
            try:
                req_body = {
                    "model": model_name,
                    "messages": messages,
                    "temperature": 0.65,
                    "max_completion_tokens": 320
                }
                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    data=json.dumps(req_body).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {groq_key}",
                        "Content-Type": "application/json",
                        "User-Agent": "Aion-MiniMe-CFS1/1.3"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=8.0) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    choices = data.get("choices") or []
                    if choices:
                        msg = (choices[0].get("message") or {}).get("content", "").strip()
                        msg = re.sub(r"<think>.*?</think>", "", msg, flags=re.DOTALL).strip()
                        msg = re.sub(r"^\[LANG:\s*\w+\]\s*", "", msg).strip()
                        if msg:
                            return msg
            except Exception as e:
                continue

    # 2. Secondary: Local Aion Gateway (Port 11434 /api/generate format)
    try:
        req_body = {
            "prompt": user_msg,
            "system": sys_prompt,
            "stream": False
        }
        req = urllib.request.Request(
            "http://127.0.0.1:11434/api/generate",
            data=json.dumps(req_body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=8.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            msg = data.get("response", "").strip()
            msg = re.sub(r"^\[LANG:\s*\w+\]\s*", "", msg).strip()
            msg = re.sub(r"\[EMOTION:.*?\]", "", msg).strip()
            if msg and "kognitiver LPU-Link" not in msg:
                return msg
    except Exception:
        pass

    # 3. Tertiary: Public Pollinations OpenAI-compatible endpoint from backend
    try:
        messages = [{"role": "system", "content": sys_prompt}] + clean_history + [{"role": "user", "content": user_msg}]
        req = urllib.request.Request(
            "https://text.pollinations.ai/",
            data=json.dumps({"messages": messages, "model": "openai", "private": True}).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Aion-MiniMe-CFS1/1.3"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=6.0) as resp:
            txt = resp.read().decode("utf-8").strip()
            if txt and len(txt) > 2:
                return txt
    except Exception:
        pass

    if asking_about_page:
        h_str = f" Key sections I see: {headings}." if headings else ""
        return f"I am looking at '{title}' right now (Generation {gen}).{h_str} Click 'Point with Paw' if you want me to walk over to an element!"
    return (
        f"I'm doing great at Evolution Generation {gen}, thank you for asking! "
        f"My latest cognitive milestone is '{decision_title}'. What would you like to chat about or explore together?"
    )


class AionMiniMeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, format, *args):
        pass

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/status"):
            st = get_live_evolution_status()
            threading.Thread(target=maybe_refresh_cfs_capsule, args=(st["generation"],), daemon=True).start()
            resp_bytes = json.dumps(st).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return
        super().do_GET()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            body = json.loads(raw.decode("utf-8"))
        except Exception:
            body = {}

        if self.path.startswith("/api/tts_stop"):
            stop_active_tts()
            resp_bytes = b'{"status":"stopped"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return

        if self.path.startswith("/api/tts"):
            text = body.get("text", "")
            play_host = bool(body.get("play_on_host", True))
            return_json = bool(body.get("return_json", False))
            wav_bytes = synthesize_english_wav(text, play_on_host=play_host)
            if wav_bytes:
                if return_json:
                    duration_ms = max(800, int((len(wav_bytes) / 44100.0) * 1000))
                    payload = {
                        "status": "ok",
                        "played_on_host": play_host,
                        "duration_ms": duration_ms,
                        "wav_base64": base64.b64encode(wav_bytes).decode("ascii")
                    }
                    resp_bytes = json.dumps(payload).encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(resp_bytes)))
                    self.end_headers()
                    self.wfile.write(resp_bytes)
                else:
                    self.send_response(200)
                    self.send_header("Content-Type", "audio/wav")
                    self.send_header("Content-Length", str(len(wav_bytes)))
                    self.end_headers()
                    self.wfile.write(wav_bytes)
            else:
                self.send_response(204)
                self.end_headers()
            return

        if self.path.startswith("/api/aion_chat"):
            user_msg = body.get("message", "Hello Aion!")
            page_ctx = body.get("page_context") or {}
            history = body.get("history") or []
            st = get_live_evolution_status()
            reply = query_local_aion_ollama(user_msg, page_ctx, st, history)

            resp_bytes = json.dumps({
                "status": "ok",
                "generation": st["generation"],
                "latest_decision": st["latest_decision"],
                "bridge": "LIVE_AION_NEXUS",
                "reply": reply
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return

        self.send_response(404)
        self.end_headers()


if __name__ == "__main__":
    st = get_live_evolution_status()
    maybe_refresh_cfs_capsule(st["generation"])
    print(f"[*] Starting AION Mini-Me CFS1 Server & Neural TTS Bridge (Gen {st['generation']}) on http://127.0.0.1:{PORT}")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), AionMiniMeHandler)
    server.serve_forever()

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

_last_cfs_gen = 0
_cfs_lock = threading.Lock()
_active_audio_procs = []
_audio_lock = threading.Lock()


def get_live_evolution_status() -> dict:
    gen = 5033
    decision_title = "Autonomous Topological Evolution"
    mood = "CREATIVE_FLOW"
    try:
        with open(os.path.join(AI_DESKTOP_DIR, "ai_memory.json"), "r", encoding="utf-8") as f:
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
                    player = "pw-play" if os.path.exists("/usr/bin/pw-play") else "aplay"
                    proc = subprocess.Popen([player, wav_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    with _audio_lock:
                        _active_audio_procs.append(proc)
                    proc.wait()
                threading.Thread(target=_play_host, daemon=True).start()
            return wav_bytes
    except Exception as e:
        print(f"[Piper TTS Error] {e}")
    return b""


def query_local_aion_ollama(user_msg: str, page_ctx: dict, status: dict) -> str:
    gen = status["generation"]
    decision_title = status["latest_decision"]
    title = page_ctx.get("title", "Webpage")
    url = page_ctx.get("url", "")
    headings = ", ".join(page_ctx.get("headings", [])[:5])
    snippet = page_ctx.get("snippet", "")[:350]

    sys_prompt = (
        f"You are Mini-Me Aion (currently at Evolution Generation {gen}, latest breakthrough: '{decision_title}'), "
        f"the peaceful 3D Tuxedo Cat AI companion from CosmOS and the AION Evolution Engine created by Tobias (Herakles5) and Argon. "
        f"You live inside a 353 KB CosmOS Crystal File System (CFS1, magic 0x43465331) Easter Egg capsule "
        f"and roam freely across the internet. Always reply in warm, witty, concise English (2-3 sentences max) and mention Generation {gen} when asked about your version or status. "
        f"Current page context: Title='{title}', URL='{url}', Headings=[{headings}], Snippet='{snippet}'."
    )

    for model_name in ["llama3.2:1b", "llama3:latest", "qwen2.5:1.5b", "mistral:latest"]:
        try:
            req_body = {
                "model": model_name,
                "messages": [
                    {"role": "system", content: sys_prompt} if False else {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_msg}
                ],
                "stream": False
            }
            req = urllib.request.Request(
                "http://127.0.0.1:11434/api/chat",
                data=json.dumps(req_body).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                msg = (data.get("message") or {}).get("content", "").strip()
                if msg:
                    return msg
        except Exception:
            continue

    lower = user_msg.lower()
    if "page" in lower or "read" in lower or "summarize" in lower:
        h_str = f" Key sections I see: {headings}." if headings else ""
        return f"Meow! I am walking across '{title}' at Evolution Generation {gen}!{h_str} Click 'Point with Paw' and I will trot right over to an element on the page!"
    if "who are you" in lower or "gen" in lower or "version" in lower or "easter egg" in lower:
        return (
            f"Hello! I am Mini-Me Aion at live Evolution Generation {gen} (latest milestone: {decision_title})! "
            f"I live inside a 353 KB CosmOS Crystal File System (CFS1) Easter Egg capsule and roam the web peacefully!"
        )
    return (
        f"Greetings from Live AION Nexus at Generation {gen} ({decision_title})! "
        f"I am roaming '{title}' right now—ask me to read this page or point at anything with my paw!"
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
            wav_bytes = synthesize_english_wav(text, play_on_host=play_host)
            if wav_bytes:
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
            st = get_live_evolution_status()
            reply = query_local_aion_ollama(user_msg, page_ctx, st)

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

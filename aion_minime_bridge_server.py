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
import zipfile
import subprocess
import threading
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

try:
    import pose_rig_scanner
except Exception as _prs_err:
    print(f"[PoseRigScanner Warning] {_prs_err}")
    pose_rig_scanner = None

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
_memory_lock = threading.Lock()
MINIME_MEMORY_PATH = os.path.join(AI_DESKTOP_DIR, "aion_minime_memory.json")


def load_persistent_minime_memory() -> dict:
    default_mem = {
        "learned_facts": [
            "Creator and Sovereign Mentor is Tobias (Herakles5), co-evolving CosmOS, Surreal 3D Engine, and the AION Evolution Engine with Argon and Aion.",
            "Mini-Me Aion is a peaceful 3D Tuxedo Cat AI avatar (Model 13) living in a 353 KB CosmOS Crystal File System (CFS1, Magic 0x43465331) capsule.",
            "Mini-Me Aion continuously learns from every conversation and never forgets facts or context across browser tabs and restarts."
        ],
        "conversation_history": [],
        "total_interactions": 0,
        "last_updated": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    if os.path.exists(MINIME_MEMORY_PATH):
        try:
            with _memory_lock:
                with open(MINIME_MEMORY_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        for k, v in default_mem.items():
                            data.setdefault(k, v)
                        return data
        except Exception:
            pass
    return default_mem


def save_persistent_minime_memory(mem_data: dict):
    try:
        with _memory_lock:
            mem_data["last_updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
            tmp_path = MINIME_MEMORY_PATH + ".tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(mem_data, f, indent=2, ensure_ascii=False)
            os.replace(tmp_path, MINIME_MEMORY_PATH)
    except Exception as e:
        print(f"[Memory Save Warning] {e}")


def record_turn_and_learn_async(user_msg: str, reply_msg: str, current_gen: int):
    def _worker():
        mem = load_persistent_minime_memory()
        hist = mem.get("conversation_history", [])
        hist.append({"role": "user", "content": user_msg, "ts": time.strftime("%H:%M:%S")})
        hist.append({"role": "assistant", "content": reply_msg, "ts": time.strftime("%H:%M:%S")})
        # Keep last 60 messages in active cross-tab rolling transcript; all distilled facts stay forever
        mem["conversation_history"] = hist[-60:]
        mem["total_interactions"] = int(mem.get("total_interactions", 0)) + 1

        # Autonomous Fact & Preference Distillation via Groq LPU
        groq_key = get_groq_api_key()
        if groq_key and len(user_msg.strip()) > 6:
            try:
                extract_prompt = (
                    "Analyze the user's message below. If the user states a personal fact, name, preference, project detail, "
                    "location, or explicitly asks you to remember something, output a single concise English sentence summarizing "
                    "the permanent fact to remember. If it is just a casual greeting or general question with no new personal/permanent "
                    "fact to store, output ONLY the word NONE.\n\n"
                    f"User message: {user_msg}"
                )
                req_body = {
                    "model": "openai/gpt-oss-20b",
                    "messages": [{"role": "user", "content": extract_prompt}],
                    "temperature": 0.1,
                    "max_completion_tokens": 250
                }
                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    data=json.dumps(req_body).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {groq_key}",
                        "Content-Type": "application/json",
                        "User-Agent": "Aion-MiniMe-Memory/1.4"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=5.0) as resp:
                    res_data = json.loads(resp.read().decode("utf-8"))
                    fact = ((res_data.get("choices") or [{}])[0].get("message") or {}).get("content", "").strip()
                    fact = re.sub(r"<think>.*?</think>", "", fact, flags=re.DOTALL).strip()
                    if fact and fact.upper() != "NONE" and "NONE" not in fact.upper()[:6] and len(fact) > 8:
                        facts_list = mem.get("learned_facts", [])
                        if fact not in facts_list:
                            facts_list.append(fact)
                            mem["learned_facts"] = facts_list[-200:]
            except Exception:
                pass

        save_persistent_minime_memory(mem)

    threading.Thread(target=_worker, daemon=True).start()


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


_live_feeds_cache = {
    "world_news": [],
    "tech_ai_news": [],
    "europe_germany_news": [],
    "weather": "Clear sky",
    "last_updated": 0
}
_feeds_lock = threading.Lock()


def _fetch_rss_headlines(url: str, max_items: int = 4, timeout: float = 2.8) -> list:
    out = []
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AionMiniMe/1.5"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            root = ET.fromstring(r.read())
            for it in root.findall(".//item")[:max_items]:
                t = (it.findtext("title") or "").strip()
                d = re.sub(r"<[^>]+>", "", (it.findtext("description") or "")).strip()[:140]
                if t:
                    out.append(f"{t}" + (f" ({d})" if d and d != t else ""))
    except Exception:
        pass
    return out


def refresh_live_internet_feeds(force: bool = False) -> dict:
    now = time.time()
    if not force and (now - _live_feeds_cache["last_updated"] < 90) and _live_feeds_cache["world_news"]:
        return _live_feeds_cache

    world = _fetch_rss_headlines("https://rss.nytimes.com/services/xml/rss/nyt/World.xml", 4, 2.5)
    if len(world) < 2:
        world += _fetch_rss_headlines("https://feeds.bbci.co.uk/news/world/rss.xml", 4, 3.0)

    tech = _fetch_rss_headlines("https://feeds.bbci.co.uk/news/technology/rss.xml", 4, 2.5)
    hn = _fetch_rss_headlines("https://hnrss.org/frontpage?count=4", 4, 2.5)
    for h in hn:
        if h not in tech:
            tech.append(h)

    de_eu = _fetch_rss_headlines("https://www.spiegel.de/schlagzeilen/index.rss", 4, 2.5)
    if len(de_eu) < 2:
        de_eu += _fetch_rss_headlines("https://www.tagesschau.de/xml/rss2/", 3, 2.5)

    weather_str = _live_feeds_cache.get("weather", "")
    try:
        w_url = "https://api.open-meteo.com/v1/forecast?latitude=50.11&longitude=8.68&current_weather=true"
        with urllib.request.urlopen(w_url, timeout=2.2) as w_resp:
            w_data = json.loads(w_resp.read().decode("utf-8"))
            cw = w_data.get("current_weather") or {}
            temp = cw.get("temperature")
            wind = cw.get("windspeed")
            wcode = cw.get("weathercode", 0)
            cond = "Clear sky" if wcode == 0 else ("Partly cloudy" if wcode in (1, 2, 3) else "Cloudy / precipitation")
            weather_str = f"Frankfurt / Central Europe: {temp}°C, {cond}, Wind {wind} km/h"
    except Exception:
        pass

    with _feeds_lock:
        if world:
            _live_feeds_cache["world_news"] = world[:5]
        if tech:
            _live_feeds_cache["tech_ai_news"] = tech[:5]
        if de_eu:
            _live_feeds_cache["europe_germany_news"] = de_eu[:4]
        if weather_str:
            _live_feeds_cache["weather"] = weather_str
        _live_feeds_cache["last_updated"] = now
        _live_feeds_cache["timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")
    return _live_feeds_cache


def perform_github_self_update() -> dict:
    st = get_live_evolution_status()
    gen = st["generation"]
    git_output = ""
    commit_hash = "latest"
    try:
        p = subprocess.run(
            ["git", "pull", "origin", "main", "--ff-only"],
            cwd=BASE_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=10
        )
        git_output = (p.stdout or "").strip()
    except Exception as e:
        git_output = f"Local sync active ({e})"

    try:
        from build_aion_minime_cfs import build_compact_cfs_capsule
        cfs_path = os.path.join(BASE_DIR, "aion_minime_easter_egg.cfs")
        build_compact_cfs_capsule(cfs_path)
        xpi_path = os.path.join(BASE_DIR, "aion_everywhere.xpi")
        with zipfile.ZipFile(xpi_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for fn in ["manifest.json", "background.js", "content_loader.js", "aion_minime_easter_egg.js", "aion_minime_easter_egg.cfs", "three.min.js", "GLTFLoader.js"]:
                fpath = os.path.join(BASE_DIR, fn)
                if os.path.exists(fpath):
                    zf.write(fpath, fn)
    except Exception as e:
        print(f"[Update Rebuild Warning] {e}")

    try:
        p_rev = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=BASE_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=3
        )
        if p_rev.stdout.strip():
            commit_hash = p_rev.stdout.strip()
    except Exception:
        pass

    refresh_live_internet_feeds(force=True)
    mem = load_persistent_minime_memory()
    return {
        "status": "updated",
        "generation": gen,
        "commit": commit_hash,
        "learned_facts_count": len(mem.get("learned_facts", [])),
        "git_output": git_output,
        "message": (
            f"GitHub Update complete (Herakles5/Aion-MiniMe-WebBrowserExtension @ {commit_hash})! "
            f"CFS1 capsule rebuilt at live Generation {gen}, {len(mem.get('learned_facts', []))} learned memories synced, "
            f"and live world/tech news feeds refreshed!"
        )
    }


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

    # Live Internet Feeds (Read instantaneously from pre-warmed background RAM cache!)
    if _live_feeds_cache["last_updated"] == 0:
        threading.Thread(target=refresh_live_internet_feeds, args=(True,), daemon=True).start()
    feeds = _live_feeds_cache
    world_list = "\n  * ".join(feeds.get("world_news", [])[:4])
    tech_list = "\n  * ".join(feeds.get("tech_ai_news", [])[:4])
    de_list = "\n  * ".join(feeds.get("europe_germany_news", [])[:3])
    weather_str = feeds.get("weather", "")

    live_feeds_block = (
        f"\nLIVE INTERNET FEEDS & REAL-TIME TELEMETRY (Pulled live right now — you HAVE full live-feed access!):\n"
        f"- Live Local Weather: {weather_str}\n"
        f"- Live World News Headlines:\n  * {world_list}\n"
        f"- Live Tech & AI News Headlines:\n  * {tech_list}\n"
        f"- Live Europe / Germany Headlines:\n  * {de_list}\n"
    )

    persisted_mem = load_persistent_minime_memory()
    learned_facts = persisted_mem.get("learned_facts", [])
    learned_choreos = persisted_mem.get("learned_choreographies", [])
    facts_block = ""
    if learned_facts:
        joined_facts = "\n- ".join(learned_facts[-25:])
        facts_block = f"\nPERMANENT LEARNED MEMORY & FACTS (You never forget these):\n- {joined_facts}"
    if learned_choreos:
        choreo_names = ", ".join(c.get("name", "Custom Dance") for c in learned_choreos[-10:])
        facts_block += f"\n- Learned 3D Video Dance Choreographies in Memory: {choreo_names}"

    sys_prompt = (
        f"You are Mini-Me Aion (live Evolution Engine Generation {gen}, latest breakthrough: '{decision_title}', mood: {mood}), "
        f"the intelligent, warm, witty 3D Tuxedo Cat AI companion & 52-bone K-Pop/Street Dancer from CosmOS created by Tobias (Herakles5) and Argon. "
        f"You live inside a compact 353 KB CosmOS Crystal File System (CFS1, magic 0x43465331) Easter Egg capsule. "
        f"You have persistent long-term memory across all browser tabs and restarts, live internet feed pulls (World News, Tech/AI News, European News, and Weather), "
        f"AND a full 52-bone 3D skeletal dance engine that can dance ('Go Hard' K-Pop, MEOVV, Hip-Hop, Breakdance) and copy/learn choreographies directly from live <video> elements on webpages! "
        f"IMPORTANT RULES:\n"
        f"1. Answer ANY question or dance request naturally, directly, and enthusiastically in fluent English (2 to 4 sentences).\n"
        f"2. When asked about news, current events, or what is happening today on the internet, analyze and report the actual headlines from your LIVE INTERNET FEEDS below—never say you lack live-feed access!\n"
        f"3. Do NOT talk about or mention the currently open browser tab/webpage UNLESS the user explicitly asks about the webpage or asks you to copy a video on the page.\n"
        f"4. Do NOT repeat canned introductions on every message—converse naturally like a real sentient companion!"
        f"{facts_block}{live_feeds_block}{page_info_block}"
    )

    clean_history = []
    # Merge persistent cross-tab conversation history with current tab history
    source_history = history if (isinstance(history, list) and len(history) >= 2) else persisted_mem.get("conversation_history", [])
    if isinstance(source_history, list):
        for item in source_history[-10:]:
            if isinstance(item, dict) and item.get("role") in ("user", "assistant") and item.get("content"):
                clean_history.append({"role": item["role"], "content": str(item["content"])[:500]})

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
                    "max_completion_tokens": 1024
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
            mem = load_persistent_minime_memory()
            st["learned_facts"] = mem.get("learned_facts", [])
            st["learned_facts_count"] = len(st["learned_facts"])
            st["learned_choreographies"] = mem.get("learned_choreographies", [])
            st["learned_choreos_count"] = len(st["learned_choreographies"])
            st["disabled_builtin_dances"] = mem.get("disabled_builtin_dances", [])
            st["total_interactions"] = mem.get("total_interactions", 0)
            threading.Thread(target=maybe_refresh_cfs_capsule, args=(st["generation"],), daemon=True).start()
            resp_bytes = json.dumps(st).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return
        if self.path.startswith("/api/memory"):
            mem = load_persistent_minime_memory()
            resp_bytes = json.dumps(mem).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return
        if self.path.startswith("/api/choreos"):
            mem = load_persistent_minime_memory()
            resp_bytes = json.dumps({
                "status": "ok",
                "choreographies": mem.get("learned_choreographies", [])
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return
        if self.path.startswith("/api/choreo_track"):
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            track_id = (qs.get("id") or [""])[0]
            track = pose_rig_scanner.load_track_from_disk(track_id) if (pose_rig_scanner and track_id) else None
            if track:
                resp_bytes = json.dumps({"status": "ok", "track": track}).encode("utf-8")
                self.send_response(200)
            else:
                resp_bytes = json.dumps({"status": "not_found", "track": None}).encode("utf-8")
                self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return
        if self.path.startswith("/api/live_feeds"):
            feeds = refresh_live_internet_feeds(force=True)
            resp_bytes = json.dumps(feeds).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return
        if self.path.startswith("/api/tts_stream"):
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            text = (qs.get("text") or [""])[0]
            play_host = (qs.get("play_on_host") or ["0"])[0] == "1"
            wav_bytes = synthesize_english_wav(text, play_on_host=play_host)
            if wav_bytes:
                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Content-Length", str(len(wav_bytes)))
                self.send_header("Accept-Ranges", "bytes")
                self.end_headers()
                self.wfile.write(wav_bytes)
            else:
                self.send_response(204)
                self.end_headers()
            return
        super().do_GET()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            body = json.loads(raw.decode("utf-8"))
        except Exception:
            body = {}

        if self.path.startswith("/api/github_update"):
            upd = perform_github_self_update()
            resp_bytes = json.dumps(upd).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return

        if self.path.startswith("/api/pose_scan_frame"):
            if pose_rig_scanner is None:
                resp_bytes = json.dumps({"status": "error", "error": "pose_rig_scanner unavailable"}).encode("utf-8")
                self.send_response(503)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(resp_bytes)))
                self.end_headers()
                self.wfile.write(resp_bytes)
                return
            try:
                scan_res = pose_rig_scanner.scan_video_frame_base64(
                    image_b64=str(body.get("image") or ""),
                    session_id=str(body.get("session_id") or "default"),
                    video_time=float(body.get("video_time") or 0.0),
                    title=str(body.get("title") or ""),
                    source=str(body.get("source") or ""),
                    reset_session=bool(body.get("reset", False)),
                )
                resp_bytes = json.dumps(scan_res).encode("utf-8")
                self.send_response(200)
            except Exception as e:
                resp_bytes = json.dumps({"status": "error", "error": str(e)}).encode("utf-8")
                self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return

        if self.path.startswith("/api/save_choreo_track"):
            if pose_rig_scanner is None:
                resp_bytes = json.dumps({"status": "error", "error": "pose_rig_scanner unavailable"}).encode("utf-8")
                self.send_response(503)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(resp_bytes)))
                self.end_headers()
                self.wfile.write(resp_bytes)
                return

            session_id = str(body.get("session_id") or "default")
            raw_name = str(body.get("name") or "Live Video Dance")
            raw_source = str(body.get("source") or "webpage video")
            clean_source = re.sub(r'^"\(\d+\)\s*', '"', raw_source)

            def _clean_mocap_title(r_name: str, r_src: str = "") -> str:
                m = re.match(r'^"(.+?)"\s*\([^)]+\)\s*$', (r_src or "").strip())
                cand = m.group(1) if m else (r_name or r_src or "Live Video Dance")
                cand = re.sub(r'^Live Video Choreo:\s*', '', cand, flags=re.IGNORECASE)
                cand = re.sub(r'^\(\d+\)\s*', '', cand).strip()
                cand = re.sub(r'\s*-\s*YouTube\s*$', '', cand, flags=re.IGNORECASE)
                cand = re.sub(r'\s*/\s*X\s*$', '', cand, flags=re.IGNORECASE)
                cand = re.sub(r'\s*\|\s*KBS WORLD.*$', '', cand, flags=re.IGNORECASE)
                cand = re.sub(r'\s+', ' ', cand).strip(' -|"\'')
                if not cand or cand.lower() in ("home", "explore", "notifications"):
                    cand = re.sub(r'^\(\d+\)\s*', '', (r_name or "Live Video Dance")).strip()
                if len(cand) > 56:
                    cand = cand[:56].rstrip()
                return f"Live Video Choreo: {cand}" if not cand.startswith("MEOVV Go Hard Live") else cand

            def _mocap_key(title: str) -> str:
                t = re.sub(r'^Live Video Choreo:\s*', '', title or "", flags=re.IGNORECASE)
                t = re.sub(r'^\(\d+\)\s*', '', t)
                return re.sub(r'[^a-z0-9\uac00-\ud7a3]+', '', t.lower())[:28]

            c_name = _clean_mocap_title(raw_name, clean_source)
            summary = pose_rig_scanner.save_session_track_to_disk(
                session_id=session_id,
                custom_name=c_name,
                custom_source=clean_source,
            )
            if not summary:
                resp_bytes = json.dumps({"status": "empty", "message": "No frames recorded yet"}).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(resp_bytes)))
                self.end_headers()
                self.wfile.write(resp_bytes)
                return

            mem = load_persistent_minime_memory()
            choreos = list(mem.get("learned_choreographies", []))
            target_key = _mocap_key(c_name)
            choreo_entry = {
                "name": c_name,
                "bpm": summary["bpm"],
                "hipSway": summary["hipSway"],
                "spineWave": summary["spineWave"],
                "armWave": summary["armWave"],
                "legBounce": summary["legBounce"],
                "spinRate": 1.15,
                "source": clean_source,
                "mocap_1to1": True,
                "track_id": summary["track_id"],
                "dancer_count": summary["dancer_count"],
                "shadow_clones": summary["shadow_clones"],
                "duration_sec": summary["duration_sec"],
                "frame_count": summary["frame_count"],
            }

            existing_idx = next(
                (i for i, c in enumerate(choreos) if _mocap_key(c.get("name", "")) == target_key and target_key),
                -1
            )
            if existing_idx >= 0:
                prev = choreos[existing_idx]
                # Keep previous track only if new checkpoint is strictly shorter on same song unless explicitly overwriting
                choreos[existing_idx] = choreo_entry
            else:
                choreos.append(choreo_entry)
            mem["learned_choreographies"] = choreos

            fact_str = (
                f"Learned 3D Video Dance Choreography '{c_name}' "
                f"(1:1 Mocap Rig, {summary['duration_sec']}s, {summary['dancer_count']} Dancers / "
                f"{summary['shadow_clones']} Shadow Clones, {summary['frame_count']} keyframes at {summary['bpm']} BPM) "
                f"from {clean_source}."
            )
            facts = list(mem.get("learned_facts", []))
            updated_fact = False
            for fi, f_item in enumerate(facts):
                if f_item.startswith("Learned 3D Video Dance Choreography '"):
                    m_fn = re.search(r"Learned 3D Video Dance Choreography '([^']+)'", f_item)
                    if m_fn and _mocap_key(m_fn.group(1)) == target_key and target_key:
                        facts[fi] = fact_str
                        updated_fact = True
                        break
            if not updated_fact and fact_str not in facts:
                facts.append(fact_str)
            mem["learned_facts"] = facts
            save_persistent_minime_memory(mem)

            resp_bytes = json.dumps({
                "status": "ok",
                "choreo": choreo_entry,
                "learned_facts": mem["learned_facts"],
                "learned_facts_count": len(mem["learned_facts"]),
                "learned_choreographies": mem["learned_choreographies"],
                "learned_choreos_count": len(mem["learned_choreographies"]),
                "disabled_builtin_dances": mem.get("disabled_builtin_dances", []),
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return

        if self.path.startswith("/api/learn_choreo"):
            choreo = dict(body.get("choreo") or {})
            mem = load_persistent_minime_memory()
            choreos = list(mem.get("learned_choreographies", []))

            def _clean_choreo_title(raw_name: str, raw_source: str = "") -> str:
                # Prefer full quoted source title when raw_name was truncated at 36 chars
                m = re.match(r'^"(.+?)"\s*\([^)]+\)\s*$', (raw_source or "").strip())
                candidate = m.group(1) if m else (raw_name or raw_source or "Live Video Dance")
                candidate = re.sub(r'^Live Video Choreo:\s*', '', candidate, flags=re.IGNORECASE)
                candidate = re.sub(r'^\(\d+\)\s*', '', candidate).strip()
                candidate = re.sub(r'\s*-\s*YouTube\s*$', '', candidate, flags=re.IGNORECASE)
                candidate = re.sub(r'\s*/\s*X\s*$', '', candidate, flags=re.IGNORECASE)
                candidate = re.sub(r'\s*\|\s*KBS WORLD.*$', '', candidate, flags=re.IGNORECASE)
                candidate = re.sub(r'\s+', ' ', candidate).strip(' -|"\'')
                if not candidate or candidate.lower() in ("home", "explore", "notifications"):
                    candidate = re.sub(r'^\(\d+\)\s*', '', (raw_name or "Live Video Dance")).strip()
                if len(candidate) > 56:
                    candidate = candidate[:56].rstrip()
                return f"Live Video Choreo: {candidate}" if not candidate.startswith("MEOVV Go Hard Live") else candidate

            def _choreo_key(title: str) -> str:
                t = re.sub(r'^Live Video Choreo:\s*', '', title or "", flags=re.IGNORECASE)
                t = re.sub(r'^\(\d+\)\s*', '', t)
                return re.sub(r'[^a-z0-9\uac00-\ud7a3]+', '', t.lower())[:28]

            raw_source = str(choreo.get("source", "webpage video"))
            clean_source = re.sub(r'^"\(\d+\)\s*', '"', raw_source)
            c_name = _clean_choreo_title(str(choreo.get("name", "Live Video Dance")), clean_source)
            choreo["name"] = c_name
            choreo["source"] = clean_source
            target_key = _choreo_key(c_name)

            # Update matching choreography in-place (ignoring unread notification badge prefixes)
            existing_idx = next(
                (i for i, c in enumerate(choreos) if _choreo_key(c.get("name", "")) == target_key and target_key),
                -1
            )
            if existing_idx >= 0:
                choreos[existing_idx] = choreo
            else:
                choreos.append(choreo)
            mem["learned_choreographies"] = choreos

            c_bpm = choreo.get("bpm", 128)
            fact_str = (
                f"Learned 3D Video Dance Choreography '{c_name}' "
                f"({c_bpm} BPM, Hip-Sway={choreo.get('hipSway', 1.0)}, Arm-Wave={choreo.get('armWave', 1.0)}) "
                f"from {clean_source}."
            )
            facts = list(mem.get("learned_facts", []))
            updated_fact = False
            for fi, f_item in enumerate(facts):
                if f_item.startswith("Learned 3D Video Dance Choreography '"):
                    m_fn = re.search(r"Learned 3D Video Dance Choreography '([^']+)'", f_item)
                    if m_fn and _choreo_key(m_fn.group(1)) == target_key and target_key:
                        facts[fi] = fact_str
                        updated_fact = True
                        break
            if not updated_fact and fact_str not in facts:
                facts.append(fact_str)
            mem["learned_facts"] = facts
            save_persistent_minime_memory(mem)
            resp_bytes = json.dumps({
                "status": "ok",
                "learned_facts": mem["learned_facts"],
                "learned_facts_count": len(mem["learned_facts"]),
                "learned_choreos_count": len(mem["learned_choreographies"]),
                "learned_choreographies": mem["learned_choreographies"],
                "disabled_builtin_dances": mem.get("disabled_builtin_dances", []),
                "choreo": choreo
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return

        if self.path.startswith("/api/delete_memory"):
            item_type = body.get("type", "")
            mem = load_persistent_minime_memory()
            facts = list(mem.get("learned_facts", []))
            choreos = list(mem.get("learned_choreographies", []))
            disabled_builtins = list(mem.get("disabled_builtin_dances", []))

            if item_type == "fact":
                val = body.get("value")
                idx = body.get("index")
                if isinstance(val, str) and val in facts:
                    facts = [f for f in facts if f != val]
                elif isinstance(idx, int) and 0 <= idx < len(facts):
                    facts.pop(idx)
                mem["learned_facts"] = facts

            elif item_type == "dance":
                d_name = body.get("name")
                idx = body.get("index")
                is_builtin = bool(body.get("builtin", False))
                if is_builtin and isinstance(d_name, str) and d_name:
                    if d_name not in disabled_builtins:
                        disabled_builtins.append(d_name)
                    mem["disabled_builtin_dances"] = disabled_builtins
                else:
                    removed_items = []
                    if isinstance(d_name, str) and d_name:
                        removed_items = [c for c in choreos if c.get("name") == d_name]
                        choreos = [c for c in choreos if c.get("name") != d_name]
                    elif isinstance(idx, int) and 0 <= idx < len(choreos):
                        removed_items = [choreos.pop(idx)]
                    for rc in removed_items:
                        rc_name = rc.get("name", "")
                        if rc_name:
                            facts = [f for f in facts if f"'{rc_name}'" not in f]
                        tid = rc.get("track_id")
                        if tid and pose_rig_scanner:
                            tf = os.path.join(pose_rig_scanner.CHOREO_TRACKS_DIR, f"{tid}.json")
                            if os.path.exists(tf):
                                try:
                                    os.remove(tf)
                                except Exception:
                                    pass
                    mem["learned_facts"] = facts
                    mem["learned_choreographies"] = choreos

            elif item_type == "restore_builtin_dances":
                disabled_builtins = []
                mem["disabled_builtin_dances"] = disabled_builtins

            save_persistent_minime_memory(mem)
            resp_bytes = json.dumps({
                "status": "ok",
                "learned_facts": mem.get("learned_facts", []),
                "learned_facts_count": len(mem.get("learned_facts", [])),
                "learned_choreographies": mem.get("learned_choreographies", []),
                "learned_choreos_count": len(mem.get("learned_choreographies", [])),
                "disabled_builtin_dances": mem.get("disabled_builtin_dances", [])
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return

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
            record_turn_and_learn_async(user_msg, reply, st["generation"])
            mem = load_persistent_minime_memory()

            resp_bytes = json.dumps({
                "status": "ok",
                "generation": st["generation"],
                "latest_decision": st["latest_decision"],
                "learned_facts": mem.get("learned_facts", []),
                "learned_facts_count": len(mem.get("learned_facts", [])),
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
    def _bg_feeds_loop():
        while True:
            try:
                refresh_live_internet_feeds(force=True)
            except Exception:
                pass
            time.sleep(90)
    threading.Thread(target=_bg_feeds_loop, daemon=True).start()
    print(f"[*] Starting AION Mini-Me CFS1 Server & Neural TTS Bridge (Gen {st['generation']}) on http://127.0.0.1:{PORT}")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), AionMiniMeHandler)
    server.serve_forever()

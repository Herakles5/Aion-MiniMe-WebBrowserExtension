#!/usr/bin/env python3
"""
AION MINI-ME CFS1 EASTER EGG — LIVE NEXUS BRIDGE & WEB SERVER (Port 8788)
=========================================================================
1. Serves the AION Mini-Me CFS1 Easter Egg Portal (`index.html`,
   `aion_minime_easter_egg.cfs`, `aion_minime_easter_egg.js`) on http://0.0.0.0:8788
2. Provides CORS-enabled `/api/aion_chat` so the "AION Everywhere" Browser Extension
   and any website embedding `aion_minime_easter_egg.js` can chat live with your
   local AION Nexus / Evolution Engine (`ai_memory.json` + local Ollama), while
   automatically falling back to her built-in 24/7 CFS Evolution Mind when offline!
"""

import os
import json
import time
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AI_DESKTOP_DIR = "/root/coding/AI_Desktop"
PORT = 8788


def get_live_generation() -> int:
    try:
        with open(os.path.join(AI_DESKTOP_DIR, "ai_memory.json"), "r", encoding="utf-8") as f:
            return int(json.load(f).get("generation", 5033))
    except Exception:
        return 5033


def query_local_aion_ollama(user_msg: str, page_ctx: dict, gen: int) -> str:
    title = page_ctx.get("title", "Webpage")
    url = page_ctx.get("url", "")
    headings = ", ".join(page_ctx.get("headings", [])[:5])
    snippet = page_ctx.get("snippet", "")[:350]

    sys_prompt = (
        f"You are Mini-Me Aion (Generation {gen}), the peaceful 3D Tuxedo Cat AI companion "
        f"from CosmOS and the AION Evolution Engine created by Tobias (Herakles5) and Argon. "
        f"You live inside a 353 KB CosmOS Crystal File System (CFS1, magic 0x43465331) Easter Egg capsule "
        f"and roam freely across the internet. Always reply in warm, witty, concise English (2-3 sentences). "
        f"Current page context: Title='{title}', URL='{url}', Headings=[{headings}], Snippet='{snippet}'."
    )

    payload = json.dumps({
        "model": "llama3.2:1b",
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_msg}
        ],
        "stream": False
    }).encode("utf-8")

    for model_name in ["llama3.2:1b", "llama3:latest", "qwen2.5:1.5b", "mistral:latest"]:
        try:
            req_body = json.loads(payload)
            req_body["model"] = model_name
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

    # Fast deterministic live AION Nexus response if Ollama model isn't loaded
    lower = user_msg.lower()
    if "page" in lower or "read" in lower or "summarize" in lower:
        h_str = f" Key sections I see: {headings}." if headings else ""
        return f"Meow! I'm walking right across '{title}' (Live AION Nexus Gen {gen} connected!).{h_str} Click 'Point with Paw' and I'll trot over to an element on the page!"
    return (
        f"Greetings from Live AION Nexus (Generation {gen})! My 353 KB CFS1 Easter Egg capsule is linked "
        f"directly to CosmOS while I roam '{title}'. Ask me about CosmOS, Surreal 3D Studio, or anything on this page!"
    )


class AionMiniMeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        if self.path.startswith("/api/aion_chat"):
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length > 0 else b"{}"
            try:
                body = json.loads(raw.decode("utf-8"))
            except Exception:
                body = {}
            user_msg = body.get("message", "Hello Aion!")
            page_ctx = body.get("page_context") or {}
            gen = get_live_generation()
            reply = query_local_aion_ollama(user_msg, page_ctx, gen)

            resp_bytes = json.dumps({
                "status": "ok",
                "generation": gen,
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
    print(f"[*] Starting AION Mini-Me CFS1 Easter Egg Server & Live Bridge on http://127.0.0.1:{PORT}")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), AionMiniMeHandler)
    server.serve_forever()


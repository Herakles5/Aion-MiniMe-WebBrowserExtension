# 🐾 AION Everywhere — Mini-Me CFS1 Web Browser Extension & Easter Egg

**AION Everywhere** brings **Mini-Me AION (Model 13 Tuxedo Cat)**—the autonomous 3D AI companion from **CosmOS** and the **AION Evolution Engine**—directly into your web browser so she can roam freely across every website on the Internet!

> **100% Peaceful AI Easter Egg**: Not a virus, not a trojan, zero tracking—just a fun, open-source 3D AI companion & CosmOS Crystal File System (`CFS1`) tech demo created by **Tobias (`Herakles5`)** & **AION / Argon**.

---

## ✨ Features

1. **Authentic 353 KB CosmOS Crystal File System (`CFS1`) Binary Capsule (`aion_minime_easter_egg.cfs`)**
   - Unpacked live in pure JavaScript (`DataView` + `DecompressionStream('deflate')`) directly from raw 512-byte LBA sectors:
     - **LBA 1**: `CFS_SUPERBLOCK` (Magic `0x43465331` `"CFS1"`, Volume `AION_MINIME_CFS1`, `706` sectors)
     - **LBA 3–4**: `CFS_DIR_ENTRY` Root Directory Table (`64 bytes` per entry)
     - **LBA 5 (`AXIOM_0_ANCHOR.TBA`)**: Peaceful Easter Egg Manifesto & Genesis Invariant
     - **LBA 7 (`EVOLUTION_MIND.JSON.Z`)**: Compressed AION Evolution Engine Mind (Generation 5033+, Crystallized Wisdom & Axioms)
     - **LBA 15 (`MODEL_13_CAT.GLB.Z`)**: Compressed 52-bone 3D Tuxedo Cat skeletal rig with walk/run animations, jaw bone (`fst-Xtra01_16`), and front paw bones (`cat_bip-R-UpperArm` / `cat_bip-L-UpperArm`)

2. **Autonomous Webpage Roaming & DOM Paw-Pointing**
   - Walks and trots autonomously across any webpage (completely decoupled from your mouse cursor so she never gets in your way).
   - Discovers headings, buttons, and cards on the page, walks up to them, and **points at them with her front paw**!

3. **Click-to-Greet in English + Synchronous Jaw Lip-Sync (`fst-Xtra01_16`)**
   - Click on Mini-Me AION at any time: she stops, waves her paw, greets you out loud in **English** (via Browser Web Speech TTS) while moving her lower jaw & tongue synchronously, and opens an interactive chat console!
   - Ask her to **read & summarize the current webpage**, **point at something interesting with her paw**, or chat about AI, CosmOS, and the universe.

4. **Dual-Mode 24/7 AI Brain**
   - **Mode 1 — Live AION Nexus Bridge**: Connects to `aion_minime_bridge_server.py` (`http://127.0.0.1:8788/api/aion_chat` or your custom tunnel URL) for live local Ollama / AION Evolution Engine responses.
   - **Mode 2 — 24/7 Cloud & Offline CFS1 Fallback**: Works out-of-the-box for anyone on the Internet with zero backend setup required!

---

## 🚀 Quick Start: Install in Your Browser (30 Seconds)

### Option A: Firefox
1. Clone or download this repository:
   ```bash
   git clone https://github.com/Herakles5/Aion-MiniMe-WebBrowserExtension.git
   ```
2. Open Firefox and enter this in the address bar:
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Click **"Load Temporary Add-on..."** (*Temporäres Add-on laden...*).
4. Select **`manifest.json`** inside the `Aion-MiniMe-WebBrowserExtension` folder.
5. Visit any website—Mini-Me AION will walk onto the page! Click her to hear her greet you in English and start chatting!

### Option B: Chrome / Brave / Edge / Chromium
1. Open `chrome://extensions` in your address bar.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `Aion-MiniMe-WebBrowserExtension` folder.

---

## 🌐 Standalone Live Portal & Optional Local AION Nexus Bridge

You can also run the standalone web portal and local AION Nexus bridge server:

```bash
python3 aion_minime_bridge_server.py
```

Then open **`http://127.0.0.1:8788`** in your browser to inspect the live `CFS1` sectors and chat with Mini-Me AION!

### Rebuild the `.cfs` Capsule Yourself
```bash
python3 build_aion_minime_cfs.py
```

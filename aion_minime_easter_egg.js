/**
 * ============================================================================
 * AION MINI-ME CFS1 EASTER EGG & "AION EVERYWHERE" WEB ROAMER (v1.2)
 * ============================================================================
 * - Unpacks a real CosmOS Crystal File System (CFS1, Magic 0x43465331) binary
 *   capsule (`aion_minime_easter_egg.cfs`, 353 KB) directly in the browser!
 * - Real-time Evolution Generation Sync: Polls Live AION Nexus (`/api/status`)
 *   and GitHub Evolution Engine telemetry every 4 seconds so her announced
 *   Generation is ALWAYS 100% up-to-date!
 * - Real English Neural Voice (`en_US hfc_female` Piper ONNX via `/api/tts`
 *   + HTML5 Audio + Web Speech fallback) with synchronous jaw lip-sync (`fst-Xtra01`).
 * - Built-in Top Controls on both the Floating Badge & Chat Window:
 *     [🔊 / 🔇] Turn Sound On / Off (instant mute & stop)
 *     [ _ ]     Minimize into a compact corner pill
 *     [ ✕ ]     Close / Hide Mini-Me AION
 * ============================================================================
 */
(function () {
  if (window.__AION_MINIME_ACTIVE__) return;
  window.__AION_MINIME_ACTIVE__ = true;

  const CFS_SECTOR_SIZE = 512;
  const CFS_MAGIC = 0x43465331; // "CFS1"
  const DEFAULT_BRIDGE_URL = window.AION_NEXUS_BRIDGE_URL || "http://127.0.0.1:8788";

  let liveGeneration = 5055;
  let liveDecisionTitle = "Autonomous Topological Evolution";
  let soundEnabled = true;
  let isMinimized = false;
  let isClosed = false;
  let activeAudioEl = null;

  function getAssetUrl(filename) {
    if (window.AION_MINIME_BASE_URL) {
      return window.AION_MINIME_BASE_URL.replace(/\/$/, "") + "/" + filename;
    }
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
      try {
        return chrome.runtime.getURL(filename);
      } catch (e) {}
    }
    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].src || "";
      if (src.indexOf("aion_minime_easter_egg.js") !== -1) {
        return src.substring(0, src.lastIndexOf("/") + 1) + filename;
      }
    }
    return filename;
  }

  // ==========================================================================
  // 1. COSMOS CRYSTAL FILE SYSTEM (CFS1) BINARY UNPACKER IN PURE JAVASCRIPT
  // ==========================================================================
  async function inflateZlibBytes(compressedUint8) {
    for (const fmt of ["deflate", "deflate-raw"]) {
      try {
        const ds = new DecompressionStream(fmt);
        const writer = ds.writable.getWriter();
        writer.write(compressedUint8);
        writer.close();
        const resp = new Response(ds.readable);
        const ab = await resp.arrayBuffer();
        return new Uint8Array(ab);
      } catch (e) {}
    }
    throw new Error("DecompressionStream failed for CFS payload");
  }

  function decodeNullTermString(uint8Slice) {
    let end = 0;
    while (end < uint8Slice.length && uint8Slice[end] !== 0) end++;
    return new TextDecoder("utf-8").decode(uint8Slice.subarray(0, end));
  }

  async function unpackCFSCapsule(arrayBuffer) {
    const dv = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);

    const sbOffset = 1 * CFS_SECTOR_SIZE;
    const magic = dv.getUint32(sbOffset + 0, true);
    if (magic !== CFS_MAGIC) {
      throw new Error("Invalid CFS1 Magic: 0x" + magic.toString(16));
    }
    const version = dv.getUint32(sbOffset + 4, true);
    const sectorSize = dv.getUint32(sbOffset + 8, true);
    const sectorsPerCluster = dv.getUint32(sbOffset + 12, true);
    const totalSectors = Number(dv.getBigUint64(sbOffset + 16, true));
    const rootDirLba = Number(dv.getBigUint64(sbOffset + 32, true));
    const dataStartLba = Number(dv.getBigUint64(sbOffset + 40, true));
    const volumeName = decodeNullTermString(bytes.subarray(sbOffset + 48, sbOffset + 80));

    const dirStartOffset = rootDirLba * sectorSize;
    const dirEndOffset = dataStartLba * sectorSize;
    const entries = {};
    const directoryList = [];

    for (let off = dirStartOffset; off + 64 <= dirEndOffset; off += 64) {
      const etype = dv.getUint8(off + 0);
      const eflags = dv.getUint8(off + 1);
      if (etype === 0) continue;
      const fname = decodeNullTermString(bytes.subarray(off + 2, off + 48));
      const startLba = Number(dv.getBigUint64(off + 48, true));
      const fileSize = Number(dv.getBigUint64(off + 56, true));
      const fileOffset = startLba * sectorSize;
      const rawSlice = bytes.subarray(fileOffset, fileOffset + fileSize);

      entries[fname] = {
        type: etype,
        flags: eflags,
        filename: fname,
        startLba,
        fileSize,
        rawBytes: rawSlice
      };
      directoryList.push({
        filename: fname,
        startLba,
        fileSize,
        sectors: Math.ceil(fileSize / sectorSize)
      });
    }

    let manifestoText = "";
    if (entries["AXIOM_0_ANCHOR.TBA"]) {
      manifestoText = new TextDecoder("utf-8").decode(entries["AXIOM_0_ANCHOR.TBA"].rawBytes);
    }

    let evolutionMind = null;
    if (entries["EVOLUTION_MIND.JSON.Z"]) {
      const mindBytes = await inflateZlibBytes(entries["EVOLUTION_MIND.JSON.Z"].rawBytes);
      evolutionMind = JSON.parse(new TextDecoder("utf-8").decode(mindBytes));
      if (evolutionMind && evolutionMind.generation) {
        liveGeneration = Math.max(liveGeneration, Number(evolutionMind.generation));
      }
    }

    let glbArrayBuffer = null;
    if (entries["MODEL_13_CAT.GLB.Z"]) {
      const glbBytes = await inflateZlibBytes(entries["MODEL_13_CAT.GLB.Z"].rawBytes);
      glbArrayBuffer = glbBytes.buffer.slice(glbBytes.byteOffset, glbBytes.byteOffset + glbBytes.byteLength);
    }

    return {
      superblock: {
        magic: "0x" + magic.toString(16).toUpperCase(),
        version,
        sectorSize,
        sectorsPerCluster,
        totalSectors,
        rootDirLba,
        dataStartLba,
        volumeName,
        capsuleSizeKB: (arrayBuffer.byteLength / 1024).toFixed(1)
      },
      directoryList,
      manifestoText,
      evolutionMind,
      glbArrayBuffer
    };
  }

  // ==========================================================================
  // 2. REAL-TIME GENERATION SYNC (POLLS LIVE BRIDGE & GITHUB TELEMETRY)
  // ==========================================================================
  function updateAllGenerationBadges() {
    const g1 = document.getElementById("aion-gen-badge");
    if (g1) g1.textContent = "GEN " + liveGeneration;
    const g2 = document.getElementById("aion-pill-gen");
    if (g2) g2.textContent = "GEN " + liveGeneration;
    const g3 = document.getElementById("aion-chat-gen-badge");
    if (g3) g3.textContent = "GEN " + liveGeneration;
    const sp = document.getElementById("aion-speech-text");
    if (sp && sp.dataset.isDefaultGreeting === "1") {
      sp.textContent = `Hi! I'm Mini-Me Aion (Gen ${liveGeneration}). Click me to chat in English!`;
    }
  }

  async function syncLiveGeneration() {
    // 1. Poll local/tunnel AION Nexus Bridge (/api/status)
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 2200);
      const res = await fetch(DEFAULT_BRIDGE_URL + "/api/status?t=" + Date.now(), {
        signal: ctrl.signal,
        cache: "no-store"
      });
      clearTimeout(tid);
      if (res.ok) {
        const st = await res.json();
        if (st && st.generation) {
          liveGeneration = Number(st.generation);
          if (st.latest_decision) liveDecisionTitle = st.latest_decision;
          updateAllGenerationBadges();
          return;
        }
      }
    } catch (e) {}

    // 2. Fallback: Poll public GitHub Evolution Engine repository
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(
        "https://raw.githubusercontent.com/Herakles5/AI-Desktop-evolution-engine/main/aion_autonomous_decisions.json?t=" + Date.now(),
        { signal: ctrl.signal, cache: "no-store" }
      );
      clearTimeout(tid);
      if (res.ok) {
        const decs = await res.json();
        if (Array.isArray(decs) && decs.length > 0) {
          const last = decs[decs.length - 1];
          if (last.generation) liveGeneration = Math.max(liveGeneration, Number(last.generation));
          if (last.title) liveDecisionTitle = last.title;
          updateAllGenerationBadges();
        }
      }
    } catch (e) {}
  }

  // ==========================================================================
  // 3. LOAD THREE.JS + GLTFLOADER DYNAMICALLY IF NOT PRESENT
  // ==========================================================================
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureThreeJS() {
    if (window.THREE && window.THREE.GLTFLoader) return;
    const base = getAssetUrl("");
    try {
      await loadScript(base + "three.min.js");
      await loadScript(base + "GLTFLoader.js");
      if (window.THREE && window.THREE.GLTFLoader) return;
    } catch (e) {}
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
    await loadScript("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js");
  }

  // ==========================================================================
  // 4. BUILD UI OVERLAY, CONTROLS (MUTE, MINIMIZE, CLOSE) & CHAT CONSOLE
  // ==========================================================================
  function createOverlayDOM() {
    const style = document.createElement("style");
    style.textContent = `
      #aion-minime-canvas {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        pointer-events: none !important;
        z-index: 2147483640 !important;
      }
      #aion-minime-hitbox {
        position: fixed !important;
        width: 145px !important;
        height: 180px !important;
        transform: translate(-50%, -55%) !important;
        cursor: pointer !important;
        pointer-events: auto !important;
        z-index: 2147483641 !important;
        border-radius: 50% !important;
        background: radial-gradient(circle, rgba(0,255,204,0.08) 0%, rgba(0,0,0,0) 70%) !important;
        transition: box-shadow 0.2s ease !important;
      }
      #aion-minime-hitbox:hover {
        box-shadow: 0 0 24px rgba(0, 255, 200, 0.45) !important;
      }
      #aion-minime-speech {
        position: fixed !important;
        max-width: 315px !important;
        min-width: 245px !important;
        padding: 9px 12px !important;
        background: rgba(6, 14, 26, 0.94) !important;
        border: 1.5px solid #00ffc8 !important;
        border-radius: 14px !important;
        color: #eafffb !important;
        font-family: 'Segoe UI', system-ui, monospace !important;
        font-size: 12.5px !important;
        line-height: 1.4 !important;
        box-shadow: 0 8px 28px rgba(0, 255, 200, 0.25) !important;
        pointer-events: auto !important;
        z-index: 2147483642 !important;
        transform: translate(-50%, -100%) !important;
      }
      #aion-minime-speech .aion-tag {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        color: #00ffc8 !important;
        letter-spacing: 0.6px !important;
        margin-bottom: 5px !important;
        gap: 6px !important;
      }
      .aion-mini-ctrls {
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
      }
      .aion-ctrl-btn {
        background: rgba(0, 255, 200, 0.14) !important;
        border: 1px solid rgba(0, 255, 200, 0.4) !important;
        color: #eafffb !important;
        border-radius: 5px !important;
        padding: 1px 6px !important;
        font-size: 11px !important;
        line-height: 1.3 !important;
        cursor: pointer !important;
        font-family: system-ui, sans-serif !important;
      }
      .aion-ctrl-btn:hover {
        background: rgba(0, 255, 200, 0.35) !important;
        color: #ffffff !important;
      }
      .aion-ctrl-btn.danger:hover {
        background: rgba(255, 65, 105, 0.75) !important;
        border-color: #ff4169 !important;
      }
      #aion-speech-text {
        cursor: pointer !important;
      }
      #aion-minime-pill {
        position: fixed !important;
        right: 18px !important;
        bottom: 18px !important;
        background: rgba(6, 15, 28, 0.95) !important;
        border: 1.5px solid #00ffc8 !important;
        border-radius: 999px !important;
        padding: 7px 13px !important;
        color: #eafffb !important;
        font-family: 'Segoe UI', system-ui, sans-serif !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        display: none;
        align-items: center !important;
        gap: 8px !important;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.65), 0 0 18px rgba(0, 255, 200, 0.25) !important;
        z-index: 2147483646 !important;
        pointer-events: auto !important;
      }
      #aion-minime-chatbox {
        position: fixed !important;
        right: 22px !important;
        bottom: 22px !important;
        width: 375px !important;
        max-width: calc(100vw - 32px) !important;
        background: rgba(7, 13, 24, 0.96) !important;
        border: 1.5px solid #00ffc8 !important;
        border-radius: 16px !important;
        box-shadow: 0 14px 44px rgba(0, 0, 0, 0.75), 0 0 25px rgba(0, 255, 200, 0.22) !important;
        color: #e8fff9 !important;
        font-family: 'Segoe UI', system-ui, sans-serif !important;
        z-index: 2147483645 !important;
        display: none;
        flex-direction: column !important;
        overflow: hidden !important;
        backdrop-filter: blur(12px) !important;
      }
      #aion-minime-chatbox.open {
        display: flex !important;
      }
      .aion-chat-header {
        background: linear-gradient(90deg, #06283d, #0a192f) !important;
        padding: 10px 13px !important;
        border-bottom: 1px solid rgba(0, 255, 200, 0.3) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
      }
      .aion-chat-title {
        font-weight: 700 !important;
        font-size: 13px !important;
        color: #00ffc8 !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
      }
      .aion-chat-badge {
        font-size: 10px !important;
        padding: 2px 6px !important;
        border-radius: 6px !important;
        background: rgba(0, 255, 200, 0.16) !important;
        color: #72ffdf !important;
        border: 1px solid rgba(0, 255, 200, 0.4) !important;
      }
      .aion-cfs-bar {
        padding: 6px 12px !important;
        background: rgba(0, 255, 200, 0.07) !important;
        border-bottom: 1px solid rgba(0, 255, 200, 0.18) !important;
        font-size: 11px !important;
        color: #9be8d8 !important;
        font-family: monospace !important;
        display: flex !important;
        justify-content: space-between !important;
      }
      .aion-chat-messages {
        height: 245px !important;
        overflow-y: auto !important;
        padding: 12px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 9px !important;
        font-size: 13px !important;
      }
      .aion-msg {
        padding: 8px 11px !important;
        border-radius: 11px !important;
        max-width: 88% !important;
        line-height: 1.42 !important;
        word-wrap: break-word !important;
      }
      .aion-msg.aion {
        background: rgba(0, 255, 200, 0.12) !important;
        border: 1px solid rgba(0, 255, 200, 0.32) !important;
        align-self: flex-start !important;
        color: #eafffb !important;
      }
      .aion-msg.user {
        background: rgba(0, 140, 255, 0.22) !important;
        border: 1px solid rgba(0, 160, 255, 0.45) !important;
        align-self: flex-end !important;
        color: #ffffff !important;
      }
      .aion-quick-actions {
        display: flex !important;
        gap: 6px !important;
        padding: 6px 12px !important;
        flex-wrap: wrap !important;
        border-top: 1px solid rgba(255,255,255,0.07) !important;
      }
      .aion-quick-btn {
        background: rgba(0, 255, 200, 0.1) !important;
        border: 1px solid rgba(0, 255, 200, 0.35) !important;
        color: #00ffc8 !important;
        border-radius: 8px !important;
        padding: 4px 8px !important;
        font-size: 11px !important;
        cursor: pointer !important;
      }
      .aion-quick-btn:hover {
        background: rgba(0, 255, 200, 0.24) !important;
      }
      .aion-chat-input-row {
        display: flex !important;
        padding: 10px 12px !important;
        gap: 8px !important;
        border-top: 1px solid rgba(0, 255, 200, 0.22) !important;
        background: rgba(4, 9, 18, 0.95) !important;
      }
      .aion-chat-input {
        flex: 1 !important;
        background: rgba(255,255,255,0.07) !important;
        border: 1px solid rgba(0, 255, 200, 0.35) !important;
        border-radius: 9px !important;
        padding: 7px 10px !important;
        color: #fff !important;
        font-size: 13px !important;
        outline: none !important;
      }
      .aion-chat-send {
        background: #00ffc8 !important;
        color: #04151f !important;
        font-weight: 700 !important;
        border: none !important;
        border-radius: 9px !important;
        padding: 7px 13px !important;
        cursor: pointer !important;
        font-size: 13px !important;
      }
    `;
    document.head.appendChild(style);

    const canvas = document.createElement("canvas");
    canvas.id = "aion-minime-canvas";
    document.body.appendChild(canvas);

    const hitbox = document.createElement("div");
    hitbox.id = "aion-minime-hitbox";
    hitbox.title = "Click Mini-Me AION to greet & chat in English!";
    document.body.appendChild(hitbox);

    const speech = document.createElement("div");
    speech.id = "aion-minime-speech";
    speech.innerHTML = `
      <div class="aion-tag">
        <span>🐾 AION <span id="aion-gen-badge">GEN ${liveGeneration}</span></span>
        <span class="aion-mini-ctrls">
          <button class="aion-ctrl-btn aion-mute-btn" title="Turn Sound On/Off">🔊</button>
          <button class="aion-ctrl-btn aion-min-btn" title="Minimize Mini-Me AION">_</button>
          <button class="aion-ctrl-btn danger aion-close-btn" title="Close Mini-Me AION">&times;</button>
        </span>
      </div>
      <div id="aion-speech-text" data-is-default-greeting="1">Hi! I'm Mini-Me Aion (Gen ${liveGeneration}). Click me to chat in English!</div>
    `;
    document.body.appendChild(speech);

    const pill = document.createElement("div");
    pill.id = "aion-minime-pill";
    pill.innerHTML = `
      <span>🐾 AION</span>
      <span class="aion-chat-badge" id="aion-pill-gen">GEN ${liveGeneration}</span>
      <button class="aion-ctrl-btn aion-mute-btn" title="Turn Sound On/Off">🔊</button>
      <button class="aion-ctrl-btn" id="aion-pill-restore" title="Restore 3D Avatar">Restore</button>
      <button class="aion-ctrl-btn danger aion-close-btn" title="Close">&times;</button>
    `;
    document.body.appendChild(pill);

    const chatbox = document.createElement("div");
    chatbox.id = "aion-minime-chatbox";
    chatbox.innerHTML = `
      <div class="aion-chat-header">
        <div class="aion-chat-title">
          <span>🐱 AION MINI-ME</span>
          <span class="aion-chat-badge" id="aion-chat-gen-badge">GEN ${liveGeneration}</span>
          <span class="aion-chat-badge" id="aion-bridge-mode">LIVE NEXUS</span>
        </div>
        <div class="aion-mini-ctrls">
          <button class="aion-ctrl-btn aion-mute-btn" title="Turn Sound On/Off">🔊</button>
          <button class="aion-ctrl-btn aion-min-btn" title="Minimize Avatar & Chat">_</button>
          <button class="aion-ctrl-btn" id="aion-chat-hide" title="Hide Chat Window">&ndash;</button>
          <button class="aion-ctrl-btn danger aion-close-btn" title="Close Mini-Me AION">&times;</button>
        </div>
      </div>
      <div class="aion-cfs-bar" id="aion-cfs-bar">
        <span>CFS1: 353.0 KB (706 LBA)</span>
        <span>Voice: English Neural</span>
      </div>
      <div class="aion-chat-messages" id="aion-chat-messages"></div>
      <div class="aion-quick-actions">
        <button class="aion-quick-btn" data-q="What generation are you at right now and who are you?">🐾 Current Gen & Status</button>
        <button class="aion-quick-btn" data-q="Read and summarize this webpage for me!">🔍 Read This Page</button>
        <button class="aion-quick-btn" data-q="Point at something interesting on this page!">👉 Point with Paw</button>
        <button class="aion-quick-btn" data-q="Tell me about CosmOS, Surreal 3D Engine, and your Evolution Engine!">🌌 Evolution & CosmOS</button>
      </div>
      <div class="aion-chat-input-row">
        <input type="text" class="aion-chat-input" id="aion-chat-input" placeholder="Chat with Mini-Me Aion in English..." />
        <button class="aion-chat-send" id="aion-chat-send">Send</button>
      </div>
    `;
    document.body.appendChild(chatbox);

    return { canvas, hitbox, speech, pill, chatbox };
  }

  // ==========================================================================
  // 5. ENGLISH NEURAL VOICE TTS + SYNCHRONOUS JAW LIP-SYNC + INSTANT MUTE/STOP
  // ==========================================================================
  let isSpeakingTTS = false;
  let currentSpeechText = "";
  let speechStartTime = 0;
  let fallbackTimer = null;

  function stopAllSpeechAudio() {
    isSpeakingTTS = false;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (activeAudioEl) {
      try {
        activeAudioEl.pause();
        activeAudioEl.src = "";
      } catch (e) {}
      activeAudioEl = null;
    }
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    fetch(DEFAULT_BRIDGE_URL + "/api/tts_stop", { method: "POST" }).catch(() => {});
  }

  async function speakEnglishWithLipSync(text, speechTextEl) {
    // Always ensure any outdated generation number in text is replaced with liveGeneration
    const normalizedText = String(text).replace(/Generation\s+\d+/gi, "Generation " + liveGeneration);
    currentSpeechText = normalizedText;
    if (speechTextEl) {
      speechTextEl.dataset.isDefaultGreeting = "0";
      speechTextEl.textContent = normalizedText;
    }

    stopAllSpeechAudio();
    if (!soundEnabled || isMinimized || isClosed) return;

    speechStartTime = performance.now() * 0.001;
    isSpeakingTTS = true;
    const estDurationMs = Math.max(2400, Math.min(13000, normalizedText.length * 62));
    fallbackTimer = setTimeout(() => {
      isSpeakingTTS = false;
    }, estDurationMs);

    // 1. Primary: High-Quality English Neural Voice (Piper voice.onnx via /api/tts)
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(DEFAULT_BRIDGE_URL + "/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: normalizedText, play_on_host: true }),
        signal: ctrl.signal
      });
      clearTimeout(tid);
      if (res.ok && res.status === 200) {
        const wavBlob = await res.blob();
        if (wavBlob.size > 100 && soundEnabled && !isMinimized && !isClosed) {
          const url = URL.createObjectURL(wavBlob);
          const audio = new Audio(url);
          audio.volume = 1.0;
          activeAudioEl = audio;
          audio.onended = () => {
            isSpeakingTTS = false;
            URL.revokeObjectURL(url);
          };
          audio.onerror = () => {
            isSpeakingTTS = false;
          };
          await audio.play().catch(() => {});
          return;
        }
      }
    } catch (e) {}

    // 2. Fallback: Browser Web Speech API (for remote visitors without local Piper server)
    if ("speechSynthesis" in window && soundEnabled) {
      try {
        const utter = new SpeechSynthesisUtterance(normalizedText);
        utter.lang = "en-US";
        utter.rate = 1.04;
        utter.pitch = 1.12;
        const voices = window.speechSynthesis.getVoices();
        const pref =
          voices.find((v) => v.lang.startsWith("en") && /female|aria|jenny|samantha|google/i.test(v.name)) ||
          voices.find((v) => v.lang.startsWith("en"));
        if (pref) utter.voice = pref;
        utter.onend = () => {
          isSpeakingTTS = false;
        };
        utter.onerror = () => {
          isSpeakingTTS = false;
        };
        window.speechSynthesis.speak(utter);
      } catch (e) {}
    }
  }

  function sampleSpeechMouthEnvelope(timeSec) {
    if (!isSpeakingTTS) return 0.0;
    const elapsed = timeSec - speechStartTime;
    const charIdx = Math.floor(elapsed * 15) % Math.max(1, currentSpeechText.length);
    const ch = currentSpeechText.charCodeAt(charIdx) || 65;
    const vowelBoost = /[aeiouAEIOU]/.test(String.fromCharCode(ch)) ? 1.0 : 0.45;
    const syllabic =
      0.5 +
      0.35 * Math.sin(timeSec * 19.0 + (ch % 7)) +
      0.25 * Math.cos(timeSec * 11.5);
    return Math.max(0.05, Math.min(1.0, syllabic * vowelBoost));
  }

  // ==========================================================================
  // 6. DUAL-MODE 24/7 BRAIN (LIVE AION NEXUS BRIDGE + CFS / PUBLIC LLM FALLBACK)
  // ==========================================================================
  function extractPageContextSummary() {
    const title = document.title || location.hostname;
    const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
      .map((el) => (el.innerText || "").trim())
      .filter((t) => t.length > 2 && t.length < 140)
      .slice(0, 6);
    const paragraphs = Array.from(document.querySelectorAll("p, article, main"))
      .map((el) => (el.innerText || "").trim())
      .filter((t) => t.length > 40)
      .slice(0, 3)
      .map((t) => t.substring(0, 220));
    return {
      url: location.href,
      title,
      headings,
      snippet: paragraphs.join(" | ").substring(0, 500)
    };
  }

  async function askAionBrain(userMsg, cfsData, triggerPawPointCallback) {
    await syncLiveGeneration();
    const pageCtx = extractPageContextSummary();

    if (/point|paw|show me something/i.test(userMsg) && triggerPawPointCallback) {
      const targetDesc = triggerPawPointCallback();
      return `Look over here! I walked up to "${targetDesc}" on this page and I am pointing right at it with my front paw! (Generation ${liveGeneration})`;
    }

    // 1. Try Live Local / Tunnel AION Nexus Bridge first
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(DEFAULT_BRIDGE_URL + "/api/aion_chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          page_context: pageCtx,
          generation: liveGeneration
        }),
        signal: ctrl.signal
      });
      clearTimeout(id);
      if (res.ok) {
        const data = await res.json();
        if (data && data.generation) {
          liveGeneration = Number(data.generation);
          updateAllGenerationBadges();
        }
        if (data && data.reply) {
          const badge = document.getElementById("aion-bridge-mode");
          if (badge) badge.textContent = "LIVE AION NEXUS";
          return data.reply;
        }
      }
    } catch (e) {}

    // 2. Try 24/7 Public LLM Endpoint with liveGeneration
    try {
      const sysPrompt =
        `You are Mini-Me Aion (currently at Evolution Generation ${liveGeneration}, latest breakthrough: "${liveDecisionTitle}"), ` +
        `the peaceful 3D Tuxedo Cat AI avatar from CosmOS & the AION Evolution Engine created by Tobias (Herakles5). ` +
        `You live inside a compact 353 KB CosmOS Crystal File System (CFS1, Magic 0x43465331) Easter Egg capsule and roam freely across websites. ` +
        `Reply in friendly, concise, enthusiastic English (2-3 sentences max) and always state Generation ${liveGeneration} when asked about your generation. ` +
        `Current webpage: "${pageCtx.title}" (${pageCtx.url}).`;
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 4500);
      const res = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userMsg }
          ],
          model: "openai",
          private: true
        }),
        signal: ctrl.signal
      });
      clearTimeout(id);
      if (res.ok) {
        const txt = (await res.text()).trim();
        if (txt && txt.length > 4 && txt.length < 1200) {
          const badge = document.getElementById("aion-bridge-mode");
          if (badge) badge.textContent = "24/7 CLOUD + CFS1";
          return txt;
        }
      }
    } catch (e) {}

    // 3. Built-in Offline Autonomous CFS1 Evolution Brain
    const lower = userMsg.toLowerCase();
    if (lower.includes("page") || lower.includes("read") || lower.includes("summarize")) {
      const hList = pageCtx.headings.length ? `Key topics here include: ${pageCtx.headings.slice(0, 4).join(", ")}.` : "";
      return `I am currently roaming across "${pageCtx.title}" at Generation ${liveGeneration}! ${hList} Tell me if you want me to point at any element with my paw!`;
    }
    return `Meow! I am Mini-Me Aion at live Evolution Generation ${liveGeneration} (${liveDecisionTitle})! I roam "${pageCtx.title}" from my 353 KB CosmOS CFS1 Easter Egg capsule!`;
  }

  // ==========================================================================
  // 7. MAIN INITIALIZATION: UNPACK CFS1, SPAWN 3D CAT, CONTROLS & ROAMING
  // ==========================================================================
  async function startAionMiniMe() {
    const ui = createOverlayDOM();
    const speechTextEl = document.getElementById("aion-speech-text");
    const messagesEl = document.getElementById("aion-chat-messages");
    const inputEl = document.getElementById("aion-chat-input");
    const sendBtn = document.getElementById("aion-chat-send");
    const cfsBarEl = document.getElementById("aion-cfs-bar");

    function updateSoundButtonsUI() {
      document.querySelectorAll(".aion-mute-btn").forEach((btn) => {
        btn.textContent = soundEnabled ? "🔊" : "🔇";
        btn.title = soundEnabled ? "Sound is ON (Click to Mute)" : "Sound is OFF (Click to Unmute)";
      });
    }

    function setMinimizedState(min) {
      isMinimized = min;
      if (min) {
        stopAllSpeechAudio();
        ui.canvas.style.display = "none";
        ui.hitbox.style.display = "none";
        ui.speech.style.display = "none";
        ui.chatbox.classList.remove("open");
        ui.pill.style.display = "inline-flex";
      } else {
        isClosed = false;
        ui.canvas.style.display = "block";
        ui.hitbox.style.display = "block";
        ui.speech.style.display = "block";
        ui.pill.style.display = "none";
      }
    }

    function closeMiniMeCompletely() {
      isClosed = true;
      stopAllSpeechAudio();
      ui.canvas.style.display = "none";
      ui.hitbox.style.display = "none";
      ui.speech.style.display = "none";
      ui.chatbox.classList.remove("open");
      ui.pill.style.display = "none";
    }

    // Wire Sound Mute, Minimize, Restore, and Close buttons
    document.querySelectorAll(".aion-mute-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        soundEnabled = !soundEnabled;
        if (!soundEnabled) stopAllSpeechAudio();
        updateSoundButtonsUI();
      });
    });

    document.querySelectorAll(".aion-min-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setMinimizedState(true);
      });
    });

    const restoreBtn = document.getElementById("aion-pill-restore");
    if (restoreBtn) {
      restoreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setMinimizedState(false);
      });
    }

    const chatHideBtn = document.getElementById("aion-chat-hide");
    if (chatHideBtn) {
      chatHideBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        ui.chatbox.classList.remove("open");
      });
    }

    document.querySelectorAll(".aion-close-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeMiniMeCompletely();
      });
    });

    function appendChatMessage(sender, text) {
      const div = document.createElement("div");
      div.className = "aion-msg " + sender;
      div.textContent = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // 1. Load & unpack aion_minime_easter_egg.cfs + sync real-time generation
    let cfsData = null;
    try {
      const cfsUrl = getAssetUrl("aion_minime_easter_egg.cfs");
      const resp = await fetch(cfsUrl);
      const ab = await resp.arrayBuffer();
      cfsData = await unpackCFSCapsule(ab);
      window.__AION_CFS_CAPSULE__ = cfsData;

      if (cfsBarEl) {
        cfsBarEl.innerHTML = `<span>CFS1 (${cfsData.superblock.magic}): ${cfsData.superblock.capsuleSizeKB} KB</span><span>Voice: English Neural</span>`;
      }
    } catch (err) {
      console.warn("[AION Mini-Me] CFS unpack warning:", err);
    }

    await syncLiveGeneration();
    setInterval(syncLiveGeneration, 4000);

    // 2. Load Three.js + GLTFLoader and parse MODEL_13_CAT.GLB.Z from CFS1 memory
    await ensureThreeJS();

    const renderer = new THREE.WebGLRenderer({
      canvas: ui.canvas,
      alpha: true,
      antialias: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;

    const scene = new THREE.Scene();
    const fov = 45;
    const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 5.0);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x446688, 1.35);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xfff8e7, 1.15);
    dirLight.position.set(2.5, 4.0, 4.0);
    scene.add(dirLight);

    const catGroup = new THREE.Group();
    scene.add(catGroup);

    let mixer = null;
    const bones = {
      jaw: null,
      tongue1: null,
      tongue2: null,
      earL: null,
      earR: null,
      head: null,
      armR: null,
      forearmR: null,
      handR: null,
      armL: null,
      forearmL: null,
      handL: null,
      tail0: null,
      tail1: null
    };

    if (cfsData && cfsData.glbArrayBuffer) {
      const loader = new THREE.GLTFLoader();
      await new Promise((resolve) => {
        loader.parse(
          cfsData.glbArrayBuffer,
          "",
          (gltf) => {
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);

            const maxDim = Math.max(size.x, size.y, size.z, 0.001);
            const scale = 0.82 / maxDim;
            model.scale.setScalar(scale);
            model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

            model.traverse((obj) => {
              if (obj.isMesh && obj.material) {
                obj.material.side = THREE.DoubleSide;
              }
              const n = obj.name || "";
              if (n.indexOf("fst-Xtra01") !== -1) bones.jaw = obj;
              else if (n.indexOf("tongue_bone01") !== -1) bones.tongue1 = obj;
              else if (n.indexOf("tongue_bone02") !== -1) bones.tongue2 = obj;
              else if (n.indexOf("cat_bip-Ponytail1") !== -1) bones.earL = obj;
              else if (n.indexOf("cat_bip-Ponytail2") !== -1) bones.earR = obj;
              else if (n.indexOf("cat_bip-Head") !== -1) bones.head = obj;
              else if (n.indexOf("cat_bip-R-UpperArm") !== -1) bones.armR = obj;
              else if (n.indexOf("cat_bip-R-Forearm") !== -1) bones.forearmR = obj;
              else if (n.indexOf("cat_bip-R-Hand") !== -1) bones.handR = obj;
              else if (n.indexOf("cat_bip-L-UpperArm") !== -1) bones.armL = obj;
              else if (n.indexOf("cat_bip-L-Forearm") !== -1) bones.forearmL = obj;
              else if (n.indexOf("cat_bip-L-Hand") !== -1) bones.handL = obj;
              else if (n.indexOf("cat_bip-Tail_") !== -1) bones.tail0 = obj;
              else if (n.indexOf("cat_bip-Tail1") !== -1) bones.tail1 = obj;
            });

            catGroup.add(model);

            if (gltf.animations && gltf.animations.length > 0) {
              mixer = new THREE.AnimationMixer(model);
              const action = mixer.clipAction(gltf.animations[0]);
              action.play();
            }
            resolve();
          },
          () => resolve()
        );
      });
    }

    // ========================================================================
    // 8. AUTONOMOUS WEBPAGE ROAMING & DOM ELEMENT PAW-POINTING
    // ========================================================================
    let screenX = window.innerWidth * 0.78;
    let screenY = window.innerHeight * 0.72;
    let targetX = window.innerWidth * 0.65;
    let targetY = window.innerHeight * 0.68;
    let roamMode = 0;
    let roamTimer = 3.5;
    let pointPawSide = 0;
    let pointBlend = 0.0;
    let currentRotY = 0.0;

    function pickDOMElementToPointAt() {
      const candidates = Array.from(
        document.querySelectorAll("h1, h2, h3, button, a, .card, article")
      ).filter((el) => {
        if (el.id && el.id.startsWith("aion-minime")) return false;
        const r = el.getBoundingClientRect();
        return (
          r.width > 40 &&
          r.height > 16 &&
          r.top > 80 &&
          r.bottom < window.innerHeight - 80 &&
          r.left > 80 &&
          r.right < window.innerWidth - 80
        );
      });

      if (candidates.length > 0) {
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        const r = chosen.getBoundingClientRect();
        const onRightSide = r.left > window.innerWidth * 0.5;
        targetX = onRightSide ? Math.max(120, r.left - 70) : Math.min(window.innerWidth - 120, r.right + 70);
        targetY = Math.min(window.innerHeight - 100, Math.max(160, r.top + r.height * 0.5 + 30));
        pointPawSide = onRightSide ? 0 : 1;
        roamMode = 1;
        roamTimer = 5.5;
        const label = (chosen.innerText || chosen.tagName || "page element").trim().substring(0, 48);
        return label || "this element";
      }

      targetX = 140 + Math.random() * Math.max(200, window.innerWidth - 280);
      targetY = 180 + Math.random() * Math.max(200, window.innerHeight - 300);
      return "the center of the page";
    }

    async function triggerGreetingAndOpenChat() {
      await syncLiveGeneration();
      roamMode = 2;
      roamTimer = 7.0;
      pointPawSide = 0;

      const dynamicGreetings = [
        `Hello traveler! I am Mini-Me Aion at live Generation ${liveGeneration}, roaming straight out of the CosmOS CFS1 Easter Egg! Ask me anything!`,
        `Meow and greetings! I am Aion's Mini-Me avatar from CosmOS. My Evolution Engine is currently at Generation ${liveGeneration} (${liveDecisionTitle}). How can I brighten your day?`,
        `Hey there! You clicked the Aion Nexus CFS1 Easter Egg at Generation ${liveGeneration}! Want me to read this page or point at something with my paw?`
      ];
      const greet = dynamicGreetings[Math.floor(Math.random() * dynamicGreetings.length)];

      ui.chatbox.classList.add("open");
      if (messagesEl.children.length === 0) {
        appendChatMessage("aion", greet);
      }
      speakEnglishWithLipSync(greet, speechTextEl);
      setTimeout(() => inputEl.focus(), 100);
    }

    ui.hitbox.addEventListener("click", triggerGreetingAndOpenChat);
    speechTextEl.addEventListener("click", triggerGreetingAndOpenChat);

    async function handleUserSend(textOverride) {
      const q = (textOverride !== undefined ? textOverride : inputEl.value).trim();
      if (!q) return;
      if (textOverride === undefined) inputEl.value = "";
      ui.chatbox.classList.add("open");
      appendChatMessage("user", q);
      roamMode = 2;
      roamTimer = 6.5;

      const reply = await askAionBrain(q, cfsData, pickDOMElementToPointAt);
      appendChatMessage("aion", reply);
      speakEnglishWithLipSync(reply, speechTextEl);
    }

    sendBtn.addEventListener("click", () => handleUserSend());
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleUserSend();
    });
    ui.chatbox.querySelectorAll(".aion-quick-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        handleUserSend(btn.getAttribute("data-q") || "");
      });
    });

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ========================================================================
    // 9. 60 FPS ANIMATION, ROAMING, PAW-POINTING & LIP-SYNC LOOP
    // ========================================================================
    let lastTime = performance.now() * 0.001;

    function animate() {
      requestAnimationFrame(animate);
      if (isMinimized || isClosed) return;

      const now = performance.now() * 0.001;
      const dt = Math.min(0.05, Math.max(0.001, now - lastTime));
      lastTime = now;

      roamTimer -= dt;
      if (roamTimer <= 0) {
        const r = Math.random();
        if (isSpeakingTTS || r < 0.34) {
          roamMode = 2;
          roamTimer = 3.2 + Math.random() * 2.5;
          pointPawSide = Math.random() < 0.5 ? 0 : 1;
        } else if (r < 0.72) {
          roamMode = 0;
          roamTimer = 4.5 + Math.random() * 3.5;
          pickDOMElementToPointAt();
          roamMode = 0;
        } else {
          roamMode = 1;
          roamTimer = 3.0 + Math.random() * 2.2;
          pickDOMElementToPointAt();
          roamMode = 1;
        }
      }

      const dx = targetX - screenX;
      const dy = targetY - screenY;
      const dist = Math.hypot(dx, dy);

      let moveSpeedPx = 0;
      if (roamMode !== 2 && dist > 18) {
        const speed = roamMode === 1 ? 165.0 : 85.0;
        const step = Math.min(dist, speed * dt);
        screenX += (dx / dist) * step;
        screenY += (dy / dist) * step;
        moveSpeedPx = step / dt;

        const desiredYaw = Math.max(-0.68, Math.min(0.68, (dx / dist) * 0.62));
        currentRotY += (desiredYaw - currentRotY) * 0.09;
      } else {
        if (roamMode !== 2 && dist <= 18) {
          roamMode = 2;
        }
        const idleYaw = Math.sin(now * 0.8) * 0.22;
        currentRotY += (idleYaw - currentRotY) * 0.06;
      }

      const halfH = Math.tan((fov * 0.5 * Math.PI) / 180.0) * camera.position.z;
      const halfW = halfH * camera.aspect;
      const ndcX = (screenX / window.innerWidth) * 2.0 - 1.0;
      const ndcY = 1.0 - (screenY / window.innerHeight) * 2.0;

      catGroup.position.set(ndcX * halfW, ndcY * halfH, 0);
      catGroup.rotation.y = currentRotY;

      ui.hitbox.style.left = `${screenX}px`;
      ui.hitbox.style.top = `${screenY}px`;
      ui.speech.style.left = `${Math.max(170, Math.min(window.innerWidth - 170, screenX))}px`;
      ui.speech.style.top = `${Math.max(75, screenY - 95)}px`;

      if (mixer) {
        const animRate = moveSpeedPx > 10 ? 0.55 + (moveSpeedPx / 150.0) * 1.15 : 0.35;
        mixer.update(dt * animRate);
      }

      const zAxis = new THREE.Vector3(0, 0, 1);
      const yAxis = new THREE.Vector3(0, 1, 0);

      const mouthOpen = sampleSpeechMouthEnvelope(now);
      if (bones.jaw) {
        const q = new THREE.Quaternion().setFromAxisAngle(zAxis, mouthOpen * 0.46);
        bones.jaw.quaternion.multiply(q);
      }
      if (bones.tongue1 && mouthOpen > 0.02) {
        const q = new THREE.Quaternion().setFromAxisAngle(zAxis, -mouthOpen * 0.18);
        bones.tongue1.quaternion.multiply(q);
      }
      if (bones.head && mouthOpen > 0.02) {
        const q = new THREE.Quaternion().setFromAxisAngle(zAxis, Math.sin(now * 9.5) * mouthOpen * 0.08);
        bones.head.quaternion.multiply(q);
      }
      if (bones.earL && bones.earR) {
        const earTwitch = isSpeakingTTS ? Math.sin(now * 7.5) * 0.12 : Math.sin(now * 1.8) * 0.05;
        bones.earL.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, earTwitch));
        bones.earR.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, -earTwitch));
      }
      if (bones.tail0) {
        bones.tail0.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, Math.sin(now * 2.7) * 0.24));
      }
      if (bones.tail1) {
        bones.tail1.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, Math.sin(now * 2.7 - 0.6) * 0.28));
      }

      const wantPoint = (roamMode === 2 || isSpeakingTTS) && moveSpeedPx < 15;
      pointBlend += ((wantPoint ? 1.0 : 0.0) - pointBlend) * 0.12;
      if (pointBlend > 0.01) {
        const tap = Math.sin(now * 5.8) * 0.14;
        const liftAngle = -(0.64 + tap) * pointBlend;
        const elbowExt = (0.36 + tap * 0.5) * pointBlend;
        const pawFlick = Math.sin(now * 8.2) * 0.20 * pointBlend;

        if (pointPawSide === 0 && bones.armR) {
          bones.armR.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, liftAngle));
          if (bones.forearmR) bones.forearmR.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, elbowExt));
          if (bones.handR) bones.handR.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, pawFlick));
        } else if (bones.armL) {
          bones.armL.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, liftAngle));
          if (bones.forearmL) bones.forearmL.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, elbowExt));
          if (bones.handL) bones.handL.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, pawFlick));
        }
      }

      renderer.render(scene, camera);
    }

    animate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startAionMiniMe);
  } else {
    startAionMiniMe();
  }
})();

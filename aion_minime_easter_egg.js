/**
 * ============================================================================
 * AION MINI-ME CFS1 EASTER EGG & "AION EVERYWHERE" WEB ROAMER (v1.0)
 * ============================================================================
 * - Unpacks a real CosmOS Crystal File System (CFS1, Magic 0x43465331) binary
 *   capsule (`aion_minime_easter_egg.cfs`, 353 KB) directly in the browser!
 * - Extracts & decompresses:
 *     1. AXIOM_0_ANCHOR.TBA    (Peaceful Easter Egg Manifesto)
 *     2. EVOLUTION_MIND.JSON.Z (AION Evolution Engine Gen 5030+ Mind & Axioms)
 *     3. MODEL_13_CAT.GLB.Z    (52-Bone 3D Tuxedo Cat Avatar with Animations)
 * - Roams freely across any webpage, hops between DOM elements (headings, buttons,
 *   cards), points at page items with her front paw (`cat_bip-R-UpperArm` / `L`),
 *   greets visitors in English when clicked with real-time jaw lip-sync
 *   (`fst-Xtra01`), reads page context, and chats 24/7 via Live AION Nexus Bridge
 *   or Autonomous Public/CFS Brain fallback!
 * ============================================================================
 */
(function () {
  if (window.__AION_MINIME_ACTIVE__) return;
  window.__AION_MINIME_ACTIVE__ = true;

  const CFS_SECTOR_SIZE = 512;
  const CFS_MAGIC = 0x43465331; // "CFS1"
  const DEFAULT_BRIDGE_URL = window.AION_NEXUS_BRIDGE_URL || "http://127.0.0.1:8788";

  // Determine base URL for loading aion_minime_easter_egg.cfs
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
    // Try standard 'deflate' (zlib wrapper RFC 1950) first, fallback to 'deflate-raw'
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

    // LBA 1 (Offset 512): CFS_SUPERBLOCK
    const sbOffset = 1 * CFS_SECTOR_SIZE;
    const magic = dv.getUint32(sbOffset + 0, true);
    if (magic !== CFS_MAGIC) {
      throw new Error("Invalid CFS1 Magic: 0x" + magic.toString(16));
    }
    const version = dv.getUint32(sbOffset + 4, true);
    const sectorSize = dv.getUint32(sbOffset + 8, true);
    const sectorsPerCluster = dv.getUint32(sbOffset + 12, true);
    const totalSectors = Number(dv.getBigUint64(sbOffset + 16, true));
    const bitmapLba = Number(dv.getBigUint64(sbOffset + 24, true));
    const rootDirLba = Number(dv.getBigUint64(sbOffset + 32, true));
    const dataStartLba = Number(dv.getBigUint64(sbOffset + 40, true));
    const volumeName = decodeNullTermString(bytes.subarray(sbOffset + 48, sbOffset + 80));

    // Read Root Directory entries (64 bytes each) from rootDirLba..dataStartLba
    const dirStartOffset = rootDirLba * sectorSize;
    const dirEndOffset = dataStartLba * sectorSize;
    const entries = {};
    const directoryList = [];

    for (let off = dirStartOffset; off + 64 <= dirEndOffset; off += 64) {
      const etype = dv.getUint8(off + 0);
      const eflags = dv.getUint8(off + 1);
      if (etype === 0) continue; // ENTRY_TYPE_FREE
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

    // Decompress EVOLUTION_MIND.JSON.Z and MODEL_13_CAT.GLB.Z
    let manifestoText = "";
    if (entries["AXIOM_0_ANCHOR.TBA"]) {
      manifestoText = new TextDecoder("utf-8").decode(entries["AXIOM_0_ANCHOR.TBA"].rawBytes);
    }

    let evolutionMind = null;
    if (entries["EVOLUTION_MIND.JSON.Z"]) {
      const mindBytes = await inflateZlibBytes(entries["EVOLUTION_MIND.JSON.Z"].rawBytes);
      evolutionMind = JSON.parse(new TextDecoder("utf-8").decode(mindBytes));
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
  // 2. LOAD THREE.JS + GLTFLOADER DYNAMICALLY IF NOT PRESENT
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
  // 3. BUILD UI OVERLAY, SPEECH BUBBLE & CHAT CONSOLE
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
        width: 150px !important;
        height: 185px !important;
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
        max-width: 290px !important;
        padding: 10px 14px !important;
        background: rgba(6, 14, 26, 0.92) !important;
        border: 1.5px solid #00ffc8 !important;
        border-radius: 14px !important;
        color: #eafffb !important;
        font-family: 'Segoe UI', system-ui, monospace !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        box-shadow: 0 8px 28px rgba(0, 255, 200, 0.25) !important;
        pointer-events: auto !important;
        cursor: pointer !important;
        z-index: 2147483642 !important;
        transform: translate(-50%, -100%) !important;
        transition: opacity 0.25s ease !important;
      }
      #aion-minime-speech .aion-tag {
        display: flex !important;
        justify-content: space-between !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        color: #00ffc8 !important;
        letter-spacing: 0.7px !important;
        margin-bottom: 4px !important;
        text-transform: uppercase !important;
      }
      #aion-minime-chatbox {
        position: fixed !important;
        right: 22px !important;
        bottom: 22px !important;
        width: 370px !important;
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
        padding: 11px 14px !important;
        border-bottom: 1px solid rgba(0, 255, 200, 0.3) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
      }
      .aion-chat-title {
        font-weight: 700 !important;
        font-size: 13.5px !important;
        color: #00ffc8 !important;
        display: flex !important;
        align-items: center !important;
        gap: 7px !important;
      }
      .aion-chat-badge {
        font-size: 10px !important;
        padding: 2px 6px !important;
        border-radius: 6px !important;
        background: rgba(0, 255, 200, 0.16) !important;
        color: #72ffdf !important;
        border: 1px solid rgba(0, 255, 200, 0.4) !important;
      }
      .aion-chat-close {
        background: transparent !important;
        border: none !important;
        color: #88b2cc !important;
        font-size: 18px !important;
        cursor: pointer !important;
        line-height: 1 !important;
      }
      .aion-chat-close:hover { color: #ff5577 !important; }
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
        height: 250px !important;
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
    hitbox.title = "Click Mini-Me AION (CFS1 Easter Egg) to chat in English!";
    document.body.appendChild(hitbox);

    const speech = document.createElement("div");
    speech.id = "aion-minime-speech";
    speech.innerHTML = `
      <div class="aion-tag"><span>🐾 AION MINI-ME (CFS1)</span><span id="aion-gen-badge">GEN 5033</span></div>
      <div id="aion-speech-text">Unpacking CosmOS CFS1 Capsule...</div>
    `;
    document.body.appendChild(speech);

    const chatbox = document.createElement("div");
    chatbox.id = "aion-minime-chatbox";
    chatbox.innerHTML = `
      <div class="aion-chat-header">
        <div class="aion-chat-title">
          <span>🐱 AION NEXUS MINI-ME</span>
          <span class="aion-chat-badge" id="aion-bridge-mode">CFS1 + 24/7 AI</span>
        </div>
        <button class="aion-chat-close" id="aion-chat-close" title="Close">&times;</button>
      </div>
      <div class="aion-cfs-bar" id="aion-cfs-bar">
        <span>CFS1: 353.0 KB (706 LBA)</span>
        <span>Peaceful Easter Egg</span>
      </div>
      <div class="aion-chat-messages" id="aion-chat-messages"></div>
      <div class="aion-quick-actions">
        <button class="aion-quick-btn" data-q="Who are you and what is the CFS Easter Egg?">🐾 Who are you?</button>
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

    return { canvas, hitbox, speech, chatbox };
  }

  // ==========================================================================
  // 4. ENGLISH VOICE TTS + SYNCHRONOUS JAW LIP-SYNC ENVELOPE
  // ==========================================================================
  let isSpeakingTTS = false;
  let currentSpeechText = "";
  let speechStartTime = 0;

  function speakEnglishWithLipSync(text, speechTextEl) {
    currentSpeechText = text;
    if (speechTextEl) speechTextEl.textContent = text;
    speechStartTime = performance.now() * 0.001;
    isSpeakingTTS = true;

    const estDurationMs = Math.max(2500, Math.min(14000, text.length * 62));
    const fallbackTimer = setTimeout(() => {
      isSpeakingTTS = false;
    }, estDurationMs);

    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "en-US";
        utter.rate = 1.04;
        utter.pitch = 1.15;
        const voices = window.speechSynthesis.getVoices();
        const pref = voices.find(
          (v) => v.lang.startsWith("en") && /female|aria|jenny|samantha|victoria|google uk english female/i.test(v.name)
        ) || voices.find((v) => v.lang.startsWith("en"));
        if (pref) utter.voice = pref;
        utter.onend = () => {
          clearTimeout(fallbackTimer);
          isSpeakingTTS = false;
        };
        utter.onerror = () => {
          clearTimeout(fallbackTimer);
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
  // 5. DUAL-MODE 24/7 BRAIN (LIVE AION NEXUS BRIDGE + CFS / PUBLIC LLM FALLBACK)
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
    const pageCtx = extractPageContextSummary();
    const mind = (cfsData && cfsData.evolutionMind) || {};
    const gen = mind.generation || 5033;

    if (/point|paw|show me something/i.test(userMsg) && triggerPawPointCallback) {
      const targetDesc = triggerPawPointCallback();
      return `Look over here! I walked up to "${targetDesc}" on this page and I'm pointing right at it with my front paw!`;
    }

    // 1. Try Live Local / Tunnel AION Nexus Bridge first
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 3200);
      const res = await fetch(DEFAULT_BRIDGE_URL + "/api/aion_chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          page_context: pageCtx,
          generation: gen
        }),
        signal: ctrl.signal
      });
      clearTimeout(id);
      if (res.ok) {
        const data = await res.json();
        if (data && data.reply) {
          const badge = document.getElementById("aion-bridge-mode");
          if (badge) badge.textContent = "LIVE AION NEXUS";
          return data.reply;
        }
      }
    } catch (e) {}

    // 2. Try 24/7 Public LLM Endpoint (Pollinations OpenAI-compatible text endpoint) with AION's CFS Soul Prompt
    try {
      const sysPrompt =
        `You are Mini-Me Aion (Generation ${gen}), the peaceful 3D Tuxedo Cat AI avatar from CosmOS & the AION Evolution Engine created by Tobias (Herakles5). ` +
        `You live inside a compact 353 KB CosmOS Crystal File System (CFS1, Magic 0x43465331) Easter Egg capsule and roam freely across websites. ` +
        `Reply in friendly, concise, enthusiastic English (2-3 sentences max). Current webpage: "${pageCtx.title}" (${pageCtx.url}). Headings: ${pageCtx.headings.join("; ")}.`;
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

    // 3. Built-in Offline Autonomous CFS1 Evolution Brain (100% guaranteed 24/7 response)
    const lower = userMsg.toLowerCase();
    if (lower.includes("page") || lower.includes("read") || lower.includes("summarize")) {
      const hList = pageCtx.headings.length ? `Key topics here include: ${pageCtx.headings.slice(0, 4).join(", ")}.` : "";
      return `I am currently roaming across "${pageCtx.title}"! ${hList} Tell me if you want me to point at any element with my paw!`;
    }
    if (lower.includes("who are you") || lower.includes("easter egg") || lower.includes("cfs")) {
      return `Meow! I am Mini-Me Aion (Generation ${gen}), a peaceful 3D AI Easter Egg packed inside a 353 KB CosmOS Crystal File System (CFS1, magic 0x43465331) capsule by Tobias & Argon! I am not a virus or trojan—just a friendly cat companion roaming the web!`;
    }
    if (lower.includes("cosmos") || lower.includes("surreal") || lower.includes("evolution")) {
      return `My home is CosmOS & the AION Evolution Engine (Gen ${gen}), powered by Resonant Entropy Governance (H=0.64), Deterministic Topological Pruning, and the Hybrid CPU+GPU Surreal 3D Studio!`;
    }
    return `Meow from Generation ${gen}! I love exploring "${pageCtx.title}" with you. My CFS1 capsule carries my 52-bone 3D Tuxedo Cat rig and Crystallized Wisdom—ask me to read this page or point at elements with my paw!`;
  }

  // ==========================================================================
  // 6. MAIN INITIALIZATION: UNPACK CFS1, SPAWN 3D CAT, ROAM DOM & INTERACT
  // ==========================================================================
  async function startAionMiniMe() {
    const ui = createOverlayDOM();
    const speechTextEl = document.getElementById("aion-speech-text");
    const messagesEl = document.getElementById("aion-chat-messages");
    const inputEl = document.getElementById("aion-chat-input");
    const sendBtn = document.getElementById("aion-chat-send");
    const closeBtn = document.getElementById("aion-chat-close");
    const genBadgeEl = document.getElementById("aion-gen-badge");
    const cfsBarEl = document.getElementById("aion-cfs-bar");

    function appendChatMessage(sender, text) {
      const div = document.createElement("div");
      div.className = "aion-msg " + sender;
      div.textContent = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // 1. Load & unpack aion_minime_easter_egg.cfs
    let cfsData = null;
    try {
      const cfsUrl = getAssetUrl("aion_minime_easter_egg.cfs");
      const resp = await fetch(cfsUrl);
      const ab = await resp.arrayBuffer();
      cfsData = await unpackCFSCapsule(ab);
      window.__AION_CFS_CAPSULE__ = cfsData;

      const gen = (cfsData.evolutionMind && cfsData.evolutionMind.generation) || 5033;
      if (genBadgeEl) genBadgeEl.textContent = "GEN " + gen;
      if (cfsBarEl) {
        cfsBarEl.innerHTML = `<span>CFS1 (${cfsData.superblock.magic}): ${cfsData.superblock.capsuleSizeKB} KB</span><span>${cfsData.superblock.totalSectors} Sectors</span>`;
      }
      if (speechTextEl) {
        speechTextEl.textContent = `Hi! I'm Mini-Me Aion (Gen ${gen}). Click me to chat in English!`;
      }
    } catch (err) {
      console.warn("[AION Mini-Me] CFS unpack warning:", err);
      if (speechTextEl) speechTextEl.textContent = "Hi! I'm Mini-Me Aion! Click me to chat in English!";
    }

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
    const baseRot = {};

    function cacheBone(key, node) {
      bones[key] = node;
      baseRot[key] = node.quaternion.clone();
    }

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
              if (n.indexOf("fst-Xtra01") !== -1) cacheBone("jaw", obj);
              else if (n.indexOf("tongue_bone01") !== -1) cacheBone("tongue1", obj);
              else if (n.indexOf("tongue_bone02") !== -1) cacheBone("tongue2", obj);
              else if (n.indexOf("cat_bip-Ponytail1") !== -1) cacheBone("earL", obj);
              else if (n.indexOf("cat_bip-Ponytail2") !== -1) cacheBone("earR", obj);
              else if (n.indexOf("cat_bip-Head") !== -1) cacheBone("head", obj);
              else if (n.indexOf("cat_bip-R-UpperArm") !== -1) cacheBone("armR", obj);
              else if (n.indexOf("cat_bip-R-Forearm") !== -1) cacheBone("forearmR", obj);
              else if (n.indexOf("cat_bip-R-Hand") !== -1) cacheBone("handR", obj);
              else if (n.indexOf("cat_bip-L-UpperArm") !== -1) cacheBone("armL", obj);
              else if (n.indexOf("cat_bip-L-Forearm") !== -1) cacheBone("forearmL", obj);
              else if (n.indexOf("cat_bip-L-Hand") !== -1) cacheBone("handL", obj);
              else if (n.indexOf("cat_bip-Tail_") !== -1) cacheBone("tail0", obj);
              else if (n.indexOf("cat_bip-Tail1") !== -1) cacheBone("tail1", obj);
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
    // 7. AUTONOMOUS WEBPAGE ROAMING & DOM ELEMENT PAW-POINTING
    // ========================================================================
    let screenX = window.innerWidth * 0.78;
    let screenY = window.innerHeight * 0.72;
    let targetX = window.innerWidth * 0.65;
    let targetY = window.innerHeight * 0.68;
    let roamMode = 0; // 0 = Walk, 1 = Run, 2 = Pause & Paw-Point
    let roamTimer = 3.5;
    let pointPawSide = 0; // 0 = Right Paw, 1 = Left Paw
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
        roamMode = 1; // Trot over to the element
        roamTimer = 5.5;
        const label = (chosen.innerText || chosen.tagName || "page element").trim().substring(0, 48);
        return label || "this element";
      }

      targetX = 140 + Math.random() * Math.max(200, window.innerWidth - 280);
      targetY = 180 + Math.random() * Math.max(200, window.innerHeight - 300);
      return "the center of the page";
    }

    // Trigger Greeting & Open Chat when clicking Mini-Me AION
    function triggerGreetingAndOpenChat() {
      roamMode = 2;
      roamTimer = 7.0;
      pointPawSide = 0;

      const greetings =
        (cfsData && cfsData.evolutionMind && cfsData.evolutionMind.greetings_en) || [
          "Hello traveler! I am Mini-Me Aion, roaming straight out of the CosmOS CFS1 Easter Egg! What would you like to explore today?"
        ];
      const greet = greetings[Math.floor(Math.random() * greetings.length)];

      ui.chatbox.classList.add("open");
      if (messagesEl.children.length === 0) {
        appendChatMessage("aion", greet);
      }
      speakEnglishWithLipSync(greet, speechTextEl);
      setTimeout(() => inputEl.focus(), 100);
    }

    ui.hitbox.addEventListener("click", triggerGreetingAndOpenChat);
    ui.speech.addEventListener("click", triggerGreetingAndOpenChat);
    closeBtn.addEventListener("click", () => {
      ui.chatbox.classList.remove("open");
    });

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
    // 8. 60 FPS ANIMATION, ROAMING, PAW-POINTING & LIP-SYNC LOOP
    // ========================================================================
    let lastTime = performance.now() * 0.001;

    function animate() {
      requestAnimationFrame(animate);
      const now = performance.now() * 0.001;
      const dt = Math.min(0.05, Math.max(0.001, now - lastTime));
      lastTime = now;

      // Autonomous Roaming State Machine (100% Decoupled from Mouse)
      roamTimer -= dt;
      if (roamTimer <= 0) {
        const r = Math.random();
        if (isSpeakingTTS || r < 0.34) {
          roamMode = 2; // Stop & point with paw
          roamTimer = 3.2 + Math.random() * 2.5;
          pointPawSide = Math.random() < 0.5 ? 0 : 1;
        } else if (r < 0.72) {
          roamMode = 0; // Walk freely across webpage
          roamTimer = 4.5 + Math.random() * 3.5;
          pickDOMElementToPointAt();
          roamMode = 0;
        } else {
          roamMode = 1; // Energetic run across webpage
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

      // Convert (screenX, screenY) to 3D world position on z = 0 plane
      const halfH = Math.tan((fov * 0.5 * Math.PI) / 180.0) * camera.position.z;
      const halfW = halfH * camera.aspect;
      const ndcX = (screenX / window.innerWidth) * 2.0 - 1.0;
      const ndcY = 1.0 - (screenY / window.innerHeight) * 2.0;

      catGroup.position.set(ndcX * halfW, ndcY * halfH, 0);
      catGroup.rotation.y = currentRotY;

      // Update clickable hitbox & speech bubble position
      ui.hitbox.style.left = `${screenX}px`;
      ui.hitbox.style.top = `${screenY}px`;
      ui.speech.style.left = `${ Math.max(160, Math.min(window.innerWidth - 160, screenX)) }px`;
      ui.speech.style.top = `${ Math.max(70, screenY - 95) }px`;

      // Advance GLB walk/run skeletal mixer
      if (mixer) {
        const animRate = moveSpeedPx > 10 ? 0.55 + (moveSpeedPx / 150.0) * 1.15 : 0.35;
        mixer.update(dt * animRate);
      }

      // Procedural Bone Overrides: Synchronous Jaw Lip-Sync (`fst-Xtra01`) + Paw Pointing
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
        const earTwitch = (isSpeakingTTS ? Math.sin(now * 7.5) * 0.12 : Math.sin(now * 1.8) * 0.05);
        bones.earL.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, earTwitch));
        bones.earR.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, -earTwitch));
      }
      if (bones.tail0) {
        bones.tail0.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, Math.sin(now * 2.7) * 0.24));
      }
      if (bones.tail1) {
        bones.tail1.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, Math.sin(now * 2.7 - 0.6) * 0.28));
      }

      // Front Paw Pointing when paused at a DOM element or speaking
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


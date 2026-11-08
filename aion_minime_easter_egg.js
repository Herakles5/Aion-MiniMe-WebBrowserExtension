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
  const DEFAULT_BRIDGE_URL =
    window.AION_NEXUS_BRIDGE_URL ||
    (window.location && window.location.port === "8788" ? window.location.origin : "http://127.0.0.1:8788");
  let lastWorkingBridgeUrl = DEFAULT_BRIDGE_URL;

  let liveGeneration = 5077;
  let liveDecisionTitle = "Autonomous Topological Evolution";
  let learnedFactsCount = 3;
  let learnedFactsList = [];
  let learnedChoreoLibrary = [];
  let disabledBuiltinDances = [];
  let activeInspectorTab = null; // null | "facts" | "dances"
  let renderMemoryInspectorDrawer = null;
  let launchSpecificChoreoCallback = null;
  let choreoCycleIndex = 0;
  const BUILTIN_CHOREOGRAPHIES = [
    {
      name: "MEOVV 'Go Hard' K-Pop Stage Choreo",
      bpm: 132,
      hipSway: 1.25,
      spineWave: 1.30,
      armWave: 1.45,
      legBounce: 1.35,
      spinRate: 1.2,
      source: "AION 52-Bone Choreography Engine",
      builtin: true
    },
    {
      name: "CosmOS Cyber Breakdance & 360 Spin",
      bpm: 140,
      hipSway: 1.30,
      spineWave: 1.35,
      armWave: 1.50,
      legBounce: 1.45,
      spinRate: 1.6,
      source: "AION 52-Bone Choreography Engine",
      builtin: true
    },
    {
      name: "Street Hip-Hop Bounce & Wave",
      bpm: 116,
      hipSway: 1.35,
      spineWave: 1.25,
      armWave: 1.20,
      legBounce: 1.30,
      spinRate: 0.8,
      source: "AION 52-Bone Choreography Engine",
      builtin: true
    }
  ];

  function getActiveBuiltinChoreos() {
    return BUILTIN_CHOREOGRAPHIES.filter((c) => !disabledBuiltinDances.includes(c.name));
  }

  function getTotalDancesCount() {
    return getActiveBuiltinChoreos().length + learnedChoreoLibrary.length;
  }

  function copyTextToClipboard(text, btnEl) {
    const str = String(text || "").trim();
    if (!str) return;
    const flashSuccess = () => {
      if (btnEl) {
        const prev = btnEl.textContent;
        btnEl.textContent = "✓";
        setTimeout(() => {
          btnEl.textContent = prev;
        }, 1200);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(flashSuccess).catch(() => {
        fallbackCopyText(str);
        flashSuccess();
      });
    } else {
      fallbackCopyText(str);
      flashSuccess();
    }
  }

  function fallbackCopyText(str) {
    try {
      const ta = document.createElement("textarea");
      ta.value = str;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {}
  }
  let soundEnabled = true;
  let isMinimized = false;
  let isClosed = false;
  let activeAudioEl = null;

  function getAssetUrl(filename) {
    const domBase = document.documentElement.getAttribute("data-aion-base-url");
    if (domBase) {
      return domBase.replace(/\/$/, "") + "/" + filename;
    }
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
        updateAllGenerationBadges();
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
  // 2. CSP-BYPASS EXTENSION BRIDGE & REAL-TIME GENERATION SYNC
  // ==========================================================================
  let _bridgeReqCounter = 0;
  const _pendingBridgeReqs = new Map();

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== "AION_MINIME_EXT_RESP") {
      return;
    }
    const { reqId, response } = event.data;
    const resolver = _pendingBridgeReqs.get(reqId);
    if (resolver) {
      _pendingBridgeReqs.delete(reqId);
      resolver(response || { ok: false, status: 503, data: null });
    }
  });

  async function bridgeRequest(path, method = "GET", body = null, timeoutMs = 8500) {
    // 1. If running as Browser Extension, route via content_loader.js -> background.js (immune to site CSP!)
    const hasExtBridge =
      document.documentElement.getAttribute("data-aion-ext-bridge") === "1" ||
      Boolean(window.AION_EXTENSION_BRIDGE_ACTIVE);
    if (hasExtBridge) {
      const extResp = await new Promise((resolve) => {
        const reqId = "req_" + (++_bridgeReqCounter) + "_" + Date.now();
        const tid = setTimeout(() => {
          _pendingBridgeReqs.delete(reqId);
          resolve(null);
        }, timeoutMs);
        _pendingBridgeReqs.set(reqId, (res) => {
          clearTimeout(tid);
          resolve(res);
        });
        window.postMessage(
          {
            source: "AION_MINIME_PAGE_REQ",
            reqId,
            path,
            method,
            body
          },
          "*"
        );
      });
      if (extResp && extResp.ok) {
        return extResp;
      }
    }

    // 2. Direct fetch fallback (remembers lastWorkingBridgeUrl so mobile Wi-Fi 10.43.191.111:8788 has 0ms delay!)
    const directCandidates = Array.from(
      new Set([
        lastWorkingBridgeUrl,
        DEFAULT_BRIDGE_URL,
        "http://10.43.191.111:8788",
        "http://127.0.0.1:8788"
      ])
    );
    for (const candidateBase of directCandidates) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), Math.min(timeoutMs, 2800));
        const opts = {
          method,
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal
        };
        if (method !== "GET" && body !== null) {
          opts.body = JSON.stringify(body);
        }
        const res = await fetch(candidateBase + path, opts);
        clearTimeout(tid);
        if (res.ok) {
          lastWorkingBridgeUrl = candidateBase;
          const ct = res.headers.get("content-type") || "";
          const data = ct.includes("application/json") ? await res.json() : await res.text();
          return { ok: true, status: res.status, data };
        }
      } catch (e) {}
    }
    return { ok: false, status: 503, data: null };
  }

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
    const cfsBar = document.getElementById("aion-cfs-bar");
    if (cfsBar) {
      const s1 = document.createElement("span");
      s1.textContent = "CFS1: 353 KB";
      s1.style.opacity = "0.85";

      const btnGroup = document.createElement("span");
      btnGroup.className = "aion-cfs-pills";

      const factsBtn = document.createElement("button");
      factsBtn.type = "button";
      factsBtn.className = "aion-cfs-pill" + (activeInspectorTab === "facts" ? " active" : "");
      factsBtn.title = "Click to list & delete individual Facts";
      factsBtn.textContent = `🧠 Memory: ${learnedFactsCount} Facts`;
      factsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        activeInspectorTab = activeInspectorTab === "facts" ? null : "facts";
        updateAllGenerationBadges();
        if (typeof renderMemoryInspectorDrawer === "function") renderMemoryInspectorDrawer();
      });

      const dancesBtn = document.createElement("button");
      dancesBtn.type = "button";
      const totalDances = getTotalDancesCount();
      dancesBtn.className = "aion-cfs-pill" + (activeInspectorTab === "dances" ? " active" : "");
      dancesBtn.title = "Click to list, play & delete individual Dances";
      dancesBtn.textContent = `💃 ${totalDances} Dances`;
      dancesBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        activeInspectorTab = activeInspectorTab === "dances" ? null : "dances";
        updateAllGenerationBadges();
        if (typeof renderMemoryInspectorDrawer === "function") renderMemoryInspectorDrawer();
      });

      btnGroup.appendChild(factsBtn);
      btnGroup.appendChild(dancesBtn);
      cfsBar.replaceChildren(s1, btnGroup);
    }
  }

  async function syncLiveGeneration() {
    const res = await bridgeRequest("/api/status?t=" + Date.now(), "GET", null, 3500);
    if (res && res.ok && res.data && res.data.generation) {
      liveGeneration = Number(res.data.generation);
      if (res.data.latest_decision) liveDecisionTitle = res.data.latest_decision;
      if (Array.isArray(res.data.learned_facts)) {
        learnedFactsList = res.data.learned_facts;
        learnedFactsCount = learnedFactsList.length;
      } else if (res.data.learned_facts_count !== undefined) {
        learnedFactsCount = Number(res.data.learned_facts_count);
      }
      if (Array.isArray(res.data.learned_choreographies)) {
        learnedChoreoLibrary = res.data.learned_choreographies;
      }
      if (Array.isArray(res.data.disabled_builtin_dances)) {
        disabledBuiltinDances = res.data.disabled_builtin_dances;
      }
      updateAllGenerationBadges();
      if (activeInspectorTab && typeof renderMemoryInspectorDrawer === "function") {
        renderMemoryInspectorDrawer();
      }
    }
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
  // 4. BUILD UI OVERLAY (100% TRUSTED-TYPES SAFE FOR YOUTUBE / GOOGLE / X)
  // ==========================================================================
  function domEl(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "className") el.className = v;
      else if (k === "textContent") el.textContent = v;
      else el.setAttribute(k, v);
    }
    for (const ch of children) {
      if (typeof ch === "string") el.appendChild(document.createTextNode(ch));
      else if (ch) el.appendChild(ch);
    }
    return el;
  }

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
      #aion-minime-speech,
      #aion-minime-speech *,
      #aion-minime-chatbox,
      #aion-minime-chatbox *,
      #aion-minime-pill,
      #aion-minime-pill * {
        box-sizing: border-box !important;
      }
      #aion-minime-speech button,
      #aion-minime-chatbox button,
      #aion-minime-pill button {
        width: auto !important;
        height: auto !important;
        min-width: 0 !important;
        min-height: 0 !important;
        max-width: 100% !important;
        max-height: none !important;
        margin: 0 !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        transform: none !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-shrink: 0 !important;
        white-space: nowrap !important;
        font-weight: 600 !important;
      }
      #aion-minime-speech {
        position: fixed !important;
        width: max-content !important;
        max-width: min(325px, calc(100vw - 24px)) !important;
        min-width: 235px !important;
        padding: 8px 10px !important;
        background: rgba(6, 14, 26, 0.94) !important;
        border: 1.5px solid #00ffc8 !important;
        border-radius: 14px !important;
        color: #eafffb !important;
        font-family: 'Segoe UI', system-ui, monospace !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        box-shadow: 0 8px 28px rgba(0, 255, 200, 0.25) !important;
        pointer-events: auto !important;
        z-index: 2147483642 !important;
        transform: translate(-50%, -100%) !important;
        overflow: hidden !important;
      }
      #aion-minime-speech.dragging {
        cursor: grabbing !important;
        box-shadow: 0 12px 36px rgba(0, 255, 200, 0.48) !important;
      }
      #aion-minime-speech.collapsed #aion-speech-text {
        display: none !important;
      }
      #aion-minime-speech.collapsed .aion-tag {
        margin-bottom: 0 !important;
      }
      #aion-minime-speech .aion-tag {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        justify-content: space-between !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        color: #00ffc8 !important;
        letter-spacing: 0.4px !important;
        margin-bottom: 5px !important;
        gap: 4px 6px !important;
        cursor: grab !important;
        user-select: none !important;
        width: 100% !important;
      }
      #aion-minime-speech .aion-tag > span:first-child {
        white-space: nowrap !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
      }
      .aion-mini-ctrls {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 3px !important;
        max-width: 100% !important;
      }
      .aion-ctrl-btn {
        background: rgba(0, 255, 200, 0.14) !important;
        border: 1px solid rgba(0, 255, 200, 0.4) !important;
        color: #eafffb !important;
        border-radius: 4px !important;
        padding: 2px 5px !important;
        font-size: 10px !important;
        line-height: 1.15 !important;
        cursor: pointer !important;
        font-family: system-ui, sans-serif !important;
        user-select: none !important;
      }
      .aion-ctrl-btn:hover {
        background: rgba(0, 255, 200, 0.35) !important;
        color: #ffffff !important;
      }
      .aion-ctrl-btn.danger:hover {
        background: rgba(255, 65, 105, 0.75) !important;
        border-color: #ff4169 !important;
      }
      #aion-speech-text,
      .aion-chat-messages,
      .aion-msg,
      .aion-msg-text,
      .aion-mem-drawer,
      .aion-mem-item-text {
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        cursor: text !important;
      }
      #aion-speech-text::selection,
      .aion-msg::selection,
      .aion-msg *::selection,
      .aion-mem-item-text::selection {
        background: rgba(0, 255, 200, 0.38) !important;
        color: #ffffff !important;
      }
      #aion-minime-pill {
        position: fixed !important;
        right: 18px !important;
        bottom: 18px !important;
        background: rgba(6, 15, 28, 0.95) !important;
        border: 1.5px solid #00ffc8 !important;
        border-radius: 999px !important;
        padding: 6px 11px !important;
        color: #eafffb !important;
        font-family: 'Segoe UI', system-ui, sans-serif !important;
        font-size: 11.5px !important;
        font-weight: 600 !important;
        display: none;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 6px !important;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.65), 0 0 18px rgba(0, 255, 200, 0.25) !important;
        z-index: 2147483646 !important;
        pointer-events: auto !important;
      }
      #aion-minime-chatbox {
        position: fixed !important;
        right: 22px !important;
        bottom: 22px !important;
        width: 375px !important;
        max-width: calc(100vw - 24px) !important;
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
        padding: 8px 10px !important;
        border-bottom: 1px solid rgba(0, 255, 200, 0.3) !important;
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 5px 8px !important;
        cursor: grab !important;
        user-select: none !important;
        width: 100% !important;
      }
      .aion-chat-title {
        font-weight: 700 !important;
        font-size: 12px !important;
        color: #00ffc8 !important;
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 4px !important;
        white-space: nowrap !important;
      }
      .aion-chat-badge {
        font-size: 9.5px !important;
        padding: 1px 5px !important;
        border-radius: 5px !important;
        background: rgba(0, 255, 200, 0.16) !important;
        color: #72ffdf !important;
        border: 1px solid rgba(0, 255, 200, 0.4) !important;
        white-space: nowrap !important;
      }
      .aion-cfs-bar {
        padding: 5px 10px !important;
        background: rgba(0, 255, 200, 0.07) !important;
        border-bottom: 1px solid rgba(0, 255, 200, 0.18) !important;
        font-size: 10.5px !important;
        color: #9be8d8 !important;
        font-family: monospace !important;
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 4px 6px !important;
        user-select: none !important;
        width: 100% !important;
      }
      .aion-cfs-pills {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 4px !important;
      }
      .aion-cfs-pill {
        background: rgba(0, 255, 200, 0.12) !important;
        border: 1px solid rgba(0, 255, 200, 0.38) !important;
        color: #b8fff0 !important;
        border-radius: 5px !important;
        padding: 2px 6px !important;
        font-size: 10px !important;
        line-height: 1.2 !important;
        font-family: monospace !important;
        cursor: pointer !important;
        transition: all 0.15s ease !important;
      }
      .aion-cfs-pill:hover,
      .aion-cfs-pill.active {
        background: rgba(0, 255, 200, 0.32) !important;
        border-color: #00ffc8 !important;
        color: #ffffff !important;
        box-shadow: 0 0 10px rgba(0, 255, 200, 0.35) !important;
      }
      .aion-mem-drawer {
        display: none;
        flex-direction: column !important;
        max-height: 225px !important;
        background: rgba(4, 11, 22, 0.98) !important;
        border-bottom: 1.5px solid rgba(0, 255, 200, 0.4) !important;
        width: 100% !important;
      }
      .aion-mem-drawer.open {
        display: flex !important;
      }
      .aion-mem-drawer-header {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 4px 6px !important;
        padding: 6px 10px !important;
        background: rgba(0, 255, 200, 0.1) !important;
        border-bottom: 1px solid rgba(0, 255, 200, 0.2) !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        color: #00ffc8 !important;
        user-select: none !important;
      }
      .aion-mem-tabs {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 4px !important;
      }
      .aion-mem-tab-btn {
        background: rgba(0, 255, 200, 0.1) !important;
        border: 1px solid rgba(0, 255, 200, 0.3) !important;
        color: #a6f0e0 !important;
        border-radius: 5px !important;
        padding: 2px 7px !important;
        font-size: 10px !important;
        line-height: 1.2 !important;
        cursor: pointer !important;
      }
      .aion-mem-tab-btn.active,
      .aion-mem-tab-btn:hover {
        background: #00ffc8 !important;
        color: #04151f !important;
        font-weight: 700 !important;
      }
      .aion-mem-list {
        overflow-y: auto !important;
        padding: 8px 10px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 6px !important;
        max-height: 185px !important;
      }
      .aion-mem-item {
        display: flex !important;
        align-items: flex-start !important;
        justify-content: space-between !important;
        gap: 6px !important;
        padding: 6px 8px !important;
        border-radius: 8px !important;
        background: rgba(0, 255, 200, 0.07) !important;
        border: 1px solid rgba(0, 255, 200, 0.22) !important;
        font-size: 11px !important;
        line-height: 1.35 !important;
      }
      .aion-mem-item:hover {
        border-color: rgba(0, 255, 200, 0.5) !important;
        background: rgba(0, 255, 200, 0.12) !important;
      }
      .aion-mem-item-text {
        flex: 1 !important;
        color: #eafffb !important;
        word-break: break-word !important;
      }
      .aion-mem-item-meta {
        display: block !important;
        font-size: 9.5px !important;
        color: #79d8c6 !important;
        margin-top: 2px !important;
      }
      .aion-mem-item-actions {
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        flex-shrink: 0 !important;
        user-select: none !important;
      }
      .aion-mem-act-btn {
        background: rgba(0, 255, 200, 0.14) !important;
        border: 1px solid rgba(0, 255, 200, 0.38) !important;
        color: #eafffb !important;
        border-radius: 4px !important;
        padding: 2px 5px !important;
        font-size: 10px !important;
        line-height: 1.15 !important;
        cursor: pointer !important;
      }
      .aion-mem-act-btn:hover {
        background: rgba(0, 255, 200, 0.35) !important;
      }
      .aion-mem-act-btn.delete {
        background: rgba(255, 65, 105, 0.16) !important;
        border-color: rgba(255, 65, 105, 0.48) !important;
        color: #ff9bb0 !important;
      }
      .aion-mem-act-btn.delete:hover {
        background: rgba(255, 65, 105, 0.85) !important;
        border-color: #ff4169 !important;
        color: #ffffff !important;
      }
      .aion-chat-messages {
        height: 235px !important;
        overflow-y: auto !important;
        padding: 10px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        font-size: 12.5px !important;
      }
      .aion-msg {
        position: relative !important;
        padding: 8px 26px 8px 10px !important;
        border-radius: 11px !important;
        max-width: 92% !important;
        line-height: 1.42 !important;
        word-wrap: break-word !important;
      }
      .aion-msg-copy {
        position: absolute !important;
        top: 4px !important;
        right: 4px !important;
        background: rgba(0, 255, 200, 0.12) !important;
        border: 1px solid rgba(0, 255, 200, 0.3) !important;
        color: #9be8d8 !important;
        border-radius: 4px !important;
        padding: 1px 4px !important;
        font-size: 9.5px !important;
        line-height: 1.1 !important;
        cursor: pointer !important;
        opacity: 0.55 !important;
        user-select: none !important;
      }
      .aion-msg:hover .aion-msg-copy {
        opacity: 1 !important;
      }
      .aion-msg-copy:hover {
        background: rgba(0, 255, 200, 0.35) !important;
        color: #ffffff !important;
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
        flex-wrap: wrap !important;
        gap: 4px !important;
        padding: 6px 10px !important;
        border-top: 1px solid rgba(255,255,255,0.07) !important;
        width: 100% !important;
      }
      .aion-quick-btn {
        background: rgba(0, 255, 200, 0.1) !important;
        border: 1px solid rgba(0, 255, 200, 0.35) !important;
        color: #00ffc8 !important;
        border-radius: 6px !important;
        padding: 3px 7px !important;
        font-size: 10px !important;
        line-height: 1.2 !important;
        cursor: pointer !important;
      }
      .aion-quick-btn:hover {
        background: rgba(0, 255, 200, 0.24) !important;
      }
      .aion-chat-input-row {
        display: flex !important;
        align-items: center !important;
        padding: 8px 10px !important;
        gap: 6px !important;
        border-top: 1px solid rgba(0, 255, 200, 0.22) !important;
        background: rgba(4, 9, 18, 0.95) !important;
        width: 100% !important;
      }
      .aion-chat-input {
        flex: 1 !important;
        min-width: 0 !important;
        width: auto !important;
        height: auto !important;
        background: rgba(255,255,255,0.07) !important;
        border: 1px solid rgba(0, 255, 200, 0.35) !important;
        border-radius: 8px !important;
        padding: 6px 9px !important;
        color: #fff !important;
        font-size: 12.5px !important;
        outline: none !important;
      }
      .aion-chat-send {
        background: #00ffc8 !important;
        color: #04151f !important;
        font-weight: 700 !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 6px 11px !important;
        cursor: pointer !important;
        font-size: 12px !important;
        line-height: 1.2 !important;
      }
      #aion-mocap-hud-canvas {
        position: fixed !important;
        pointer-events: none !important;
        z-index: 2147483638 !important;
        display: none;
        border-radius: 8px !important;
        box-shadow: inset 0 0 18px rgba(0, 255, 200, 0.35) !important;
      }
      #aion-mocap-bar {
        position: fixed !important;
        top: 14px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background: rgba(6, 12, 26, 0.92) !important;
        border: 1.5px solid #ff2bd6 !important;
        border-radius: 999px !important;
        padding: 5px 12px !important;
        color: #fff6ff !important;
        font-family: 'Segoe UI', system-ui, monospace !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        display: none;
        align-items: center !important;
        gap: 8px !important;
        box-shadow: 0 8px 28px rgba(255, 43, 214, 0.35), 0 0 14px rgba(0, 255, 200, 0.25) !important;
        z-index: 2147483644 !important;
        pointer-events: auto !important;
        user-select: none !important;
      }
      #aion-mocap-bar.active {
        display: inline-flex !important;
      }
      #aion-mocap-bar button {
        background: rgba(255, 43, 214, 0.2) !important;
        border: 1px solid rgba(255, 43, 214, 0.6) !important;
        color: #ffffff !important;
        border-radius: 999px !important;
        padding: 2px 8px !important;
        font-size: 10.5px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
      }
      #aion-mocap-bar button:hover {
        background: rgba(255, 43, 214, 0.55) !important;
      }
      .aion-ctrl-btn.recording {
        background: rgba(255, 43, 214, 0.55) !important;
        border-color: #ff2bd6 !important;
        color: #ffffff !important;
        box-shadow: 0 0 10px rgba(255, 43, 214, 0.65) !important;
      }
      @media (max-width: 640px) {
        #aion-minime-chatbox {
          width: calc(100vw - 20px) !important;
          right: 10px !important;
          bottom: 10px !important;
        }
        #aion-minime-speech {
          max-width: 86vw !important;
          min-width: 210px !important;
          font-size: 11.5px !important;
        }
        .aion-chat-messages {
          height: 190px !important;
        }
      }
    `;
    document.head.appendChild(style);

    const mountRoot = document.body || document.documentElement;

    const mocapHudCanvas = domEl("canvas", { id: "aion-mocap-hud-canvas" });
    mountRoot.appendChild(mocapHudCanvas);

    const mocapBarStatus = domEl("span", { id: "aion-mocap-bar-status", textContent: "🔴 1:1 MOCAP READY" });
    const mocapBarEyeBtn = domEl("button", { type: "button", id: "aion-mocap-eye-btn", title: "Show / Hide Live Pose Rig Overlay on Video", textContent: "👁 Rigs ON" });
    const mocapBarStopBtn = domEl("button", { type: "button", id: "aion-mocap-stop-btn", title: "Save Full Choreography & Stop", textContent: "⏹ Save & Stop" });
    const mocapBar = domEl("div", { id: "aion-mocap-bar" }, [mocapBarStatus, mocapBarEyeBtn, mocapBarStopBtn]);
    mountRoot.appendChild(mocapBar);

    const canvas = domEl("canvas", { id: "aion-minime-canvas" });
    mountRoot.appendChild(canvas);

    const hitbox = domEl("div", {
      id: "aion-minime-hitbox",
      title: "Click Mini-Me AION to greet & chat in English!"
    });
    mountRoot.appendChild(hitbox);

    const speech = domEl("div", { id: "aion-minime-speech", title: "Drag the top bar to move, or highlight text & press Ctrl+C!" }, [
      domEl("div", { className: "aion-tag" }, [
        domEl("span", {}, [
          "✥ 🐾 AION ",
          domEl("span", { id: "aion-gen-badge", textContent: `GEN ${liveGeneration}` })
        ]),
        domEl("span", { className: "aion-mini-ctrls" }, [
          domEl("button", { className: "aion-ctrl-btn", id: "aion-speech-copy-btn", title: "Copy Speech Text (or highlight & press Ctrl+C)", textContent: "📋" }),
          domEl("button", { className: "aion-ctrl-btn aion-dance-btn", title: "Dance & Copy Live Video Choreography!", textContent: "💃" }),
          domEl("button", { className: "aion-ctrl-btn aion-update-btn", title: "Update from GitHub & Sync Live Feeds", textContent: "🔄" }),
          domEl("button", { className: "aion-ctrl-btn aion-mute-btn", title: "Turn Sound On/Off", textContent: "🔊" }),
          domEl("button", { className: "aion-ctrl-btn", id: "aion-speech-pin-btn", title: "Follow Cat / Unpin Speech Bubble", textContent: "🧲" }),
          domEl("button", { className: "aion-ctrl-btn", id: "aion-speech-collapse-btn", title: "Collapse / Expand Popup Text", textContent: "▾" }),
          domEl("button", { className: "aion-ctrl-btn aion-min-btn", title: "Minimize Mini-Me AION", textContent: "_" }),
          domEl("button", { className: "aion-ctrl-btn danger aion-close-btn", title: "Close Mini-Me AION", textContent: "×" })
        ])
      ]),
      domEl("div", {
        id: "aion-speech-text",
        "data-is-default-greeting": "1",
        textContent: `Hi! I'm Mini-Me Aion (Gen ${liveGeneration}). Drag this box anywhere or click me to chat!`
      })
    ]);
    mountRoot.appendChild(speech);

    const pill = domEl("div", { id: "aion-minime-pill" }, [
      domEl("span", { textContent: "🐾 AION" }),
      domEl("span", { className: "aion-chat-badge", id: "aion-pill-gen", textContent: `GEN ${liveGeneration}` }),
      domEl("button", { className: "aion-ctrl-btn aion-mute-btn", title: "Turn Sound On/Off", textContent: "🔊" }),
      domEl("button", { className: "aion-ctrl-btn", id: "aion-pill-restore", title: "Restore 3D Avatar", textContent: "Restore" }),
      domEl("button", { className: "aion-ctrl-btn danger aion-close-btn", title: "Close", textContent: "×" })
    ]);
    mountRoot.appendChild(pill);

    const chatbox = domEl("div", { id: "aion-minime-chatbox" }, [
      domEl("div", { className: "aion-chat-header" }, [
        domEl("div", { className: "aion-chat-title" }, [
          domEl("span", { textContent: "🐱 AION MINI-ME" }),
          domEl("span", { className: "aion-chat-badge", id: "aion-chat-gen-badge", textContent: `GEN ${liveGeneration}` }),
          domEl("span", { className: "aion-chat-badge", id: "aion-bridge-mode", textContent: "120B NEXUS" })
        ]),
        domEl("div", { className: "aion-mini-ctrls" }, [
          domEl("button", { className: "aion-ctrl-btn aion-dance-btn", title: "Dance & Learn Choreography from Live Video!", textContent: "💃" }),
          domEl("button", { className: "aion-ctrl-btn aion-update-btn", title: "Pull Latest Version from GitHub & Refresh Live Feeds", textContent: "🔄" }),
          domEl("button", { className: "aion-ctrl-btn", id: "aion-chat-clear", title: "Clear Chat View (Memory stays intact)", textContent: "🗑️" }),
          domEl("button", { className: "aion-ctrl-btn aion-mute-btn", title: "Turn Sound On/Off", textContent: "🔊" }),
          domEl("button", { className: "aion-ctrl-btn aion-min-btn", title: "Minimize Avatar & Chat", textContent: "_" }),
          domEl("button", { className: "aion-ctrl-btn", id: "aion-chat-hide", title: "Hide Chat Window", textContent: "–" }),
          domEl("button", { className: "aion-ctrl-btn danger aion-close-btn", title: "Close Mini-Me AION", textContent: "×" })
        ])
      ]),
      domEl("div", { className: "aion-cfs-bar", id: "aion-cfs-bar" }, [
        domEl("span", { textContent: "CFS1: 353 KB" }),
        domEl("span", { textContent: `🧠 Memory: ${learnedFactsCount} Facts` })
      ]),
      domEl("div", { className: "aion-mem-drawer", id: "aion-mem-drawer" }),
      domEl("div", { className: "aion-chat-messages", id: "aion-chat-messages" }),
      domEl("div", { className: "aion-quick-actions" }, [
        domEl("button", {
          className: "aion-quick-btn",
          "data-q": "Copy and learn the dance choreography from the live video on this page and dance Go Hard!",
          textContent: "💃 Dance / Copy Video"
        }),
        domEl("button", {
          className: "aion-quick-btn",
          "data-q": "Pull the latest live world, tech, and AI news headlines and analyze the biggest stories today!",
          textContent: "📰 Live World & Tech News"
        }),
        domEl("button", {
          className: "aion-quick-btn",
          "data-q": "Read and summarize this webpage for me!",
          textContent: "🔍 Summarize Page"
        }),
        domEl("button", {
          className: "aion-quick-btn",
          "data-q": "Point at something interesting on this page!",
          textContent: "👉 Point with Paw"
        })
      ]),
      domEl("div", { className: "aion-chat-input-row" }, [
        domEl("input", {
          type: "text",
          className: "aion-chat-input",
          id: "aion-chat-input",
          placeholder: "Ask Mini-Me Aion anything..."
        }),
        domEl("button", { className: "aion-chat-send", id: "aion-chat-send", textContent: "Send" })
      ])
    ]);
    mountRoot.appendChild(chatbox);

    return { canvas, hitbox, speech, pill, chatbox, mocapHudCanvas, mocapBar, mocapBarStatus, mocapBarEyeBtn, mocapBarStopBtn };
  }

  // ==========================================================================
  // 5. ENGLISH NEURAL VOICE TTS + SYNCHRONOUS JAW LIP-SYNC + MOBILE AUDIO UNLOCK
  // ==========================================================================
  let isSpeakingTTS = false;
  let currentSpeechText = "";
  let speechStartTime = 0;
  let fallbackTimer = null;
  let sharedAudioCtx = null;
  let activeBufferSource = null;
  let sharedHtmlAudio = null;
  const SILENT_WAV_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

  function getOrCreateSharedHtmlAudio() {
    if (!sharedHtmlAudio) {
      sharedHtmlAudio = document.createElement("audio");
      sharedHtmlAudio.id = "aion-minime-voice-player";
      sharedHtmlAudio.setAttribute("playsinline", "true");
      sharedHtmlAudio.setAttribute("webkit-playsinline", "true");
      sharedHtmlAudio.preload = "auto";
      sharedHtmlAudio.volume = 1.0;
      sharedHtmlAudio.style.display = "none";
      (document.body || document.documentElement).appendChild(sharedHtmlAudio);
    }
    return sharedHtmlAudio;
  }

  // Unlock WebAudio & HTML5 Audio synchronously on finger-up / click on smartphones!
  function unlockMobileAudioOnGesture() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !sharedAudioCtx) {
        sharedAudioCtx = new AudioContextClass();
      }
      if (sharedAudioCtx && sharedAudioCtx.state !== "running") {
        sharedAudioCtx.resume().catch(() => {});
        const buf = sharedAudioCtx.createBuffer(1, 1, 22050);
        const src = sharedAudioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(sharedAudioCtx.destination);
        src.start(0);
      }
      const el = getOrCreateSharedHtmlAudio();
      if (!isSpeakingTTS && el.paused && !el.dataset.unlocked) {
        el.src = SILENT_WAV_URI;
        const p = el.play();
        if (p && p.then) {
          p.then(() => {
            el.dataset.unlocked = "1";
          }).catch(() => {});
        }
      }
    } catch (e) {}
  }
  window.addEventListener("touchend", unlockMobileAudioOnGesture, { passive: true });
  window.addEventListener("pointerup", unlockMobileAudioOnGesture, { passive: true });
  window.addEventListener("click", unlockMobileAudioOnGesture, { passive: true });

  function isRemoteOrMobileClient() {
    const host = (window.location && window.location.hostname) || "";
    if (host && host !== "127.0.0.1" && host !== "localhost") {
      if (window.location.port === "8788") return true;
    }
    if ((navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || "ontouchstart" in window) {
      return true;
    }
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  }

  function stopAllSpeechAudio(notifyBridge = true) {
    isSpeakingTTS = false;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (activeBufferSource) {
      try {
        activeBufferSource.stop();
        activeBufferSource.disconnect();
      } catch (e) {}
      activeBufferSource = null;
    }
    if (sharedHtmlAudio) {
      try {
        sharedHtmlAudio.pause();
      } catch (e) {}
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
    if (notifyBridge) {
      bridgeRequest("/api/tts_stop", "POST", {}, 2000).catch(() => {});
    }
  }

  async function playBase64WavInBrowser(wavBase64) {
    // 1. Try persistent unlocked HTML5 <audio> element first (plays through smartphone media speaker!)
    try {
      const el = getOrCreateSharedHtmlAudio();
      el.src = "data:audio/wav;base64," + wavBase64;
      el.volume = 1.0;
      el.onended = () => {
        isSpeakingTTS = false;
      };
      await el.play();
      el.dataset.unlocked = "1";
      return true;
    } catch (err) {}

    // 2. Fallback to manual 16-bit PCM WAV decode on unlocked WebAudio AudioContext
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !sharedAudioCtx) {
        sharedAudioCtx = new AudioContextClass();
      }
      if (sharedAudioCtx) {
        if (sharedAudioCtx.state !== "running") {
          await sharedAudioCtx.resume();
        }
        const binStr = atob(wavBase64);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        const dv = new DataView(bytes.buffer);
        const sampleRate = len > 28 ? dv.getUint32(24, true) || 22050 : 22050;
        const pcmByteLen = Math.max(0, len - 44);
        const numSamples = Math.floor(pcmByteLen / 2);
        if (numSamples > 0) {
          const audioBuffer = sharedAudioCtx.createBuffer(1, numSamples, sampleRate);
          const chan = audioBuffer.getChannelData(0);
          for (let i = 0; i < numSamples; i++) {
            chan[i] = dv.getInt16(44 + i * 2, true) / 32768.0;
          }
          const source = sharedAudioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(sharedAudioCtx.destination);
          activeBufferSource = source;
          source.onended = () => {
            if (activeBufferSource === source) {
              isSpeakingTTS = false;
              activeBufferSource = null;
            }
          };
          source.start(0);
          return true;
        }
      }
    } catch (err) {}
    return false;
  }

  async function speakEnglishWithLipSync(text, speechTextEl) {
    // Always ensure any outdated generation number in text is replaced with liveGeneration
    const normalizedText = String(text).replace(/Generation\s+\d+/gi, "Generation " + liveGeneration);
    currentSpeechText = normalizedText;
    if (speechTextEl) {
      speechTextEl.dataset.isDefaultGreeting = "0";
      speechTextEl.textContent = normalizedText;
    }

    // Stop any previous local audio without sending a racing /api/tts_stop
    stopAllSpeechAudio(false);
    if (!soundEnabled || isMinimized || isClosed) return;

    speechStartTime = performance.now() * 0.001;
    isSpeakingTTS = true;
    const estDurationMs = Math.max(2400, Math.min(13000, normalizedText.length * 62));
    fallbackTimer = setTimeout(() => {
      isSpeakingTTS = false;
    }, estDurationMs);

    const onMobileOrRemote = isRemoteOrMobileClient();

    // 1A. Fast Synchronous HTML5 Audio Stream on Mobile Wi-Fi (0 awaits before .play() = 100% allowed by mobile browsers!)
    if (onMobileOrRemote && window.location && window.location.port === "8788") {
      try {
        const el = getOrCreateSharedHtmlAudio();
        const streamUrl =
          `${window.location.origin}/api/tts_stream?text=${encodeURIComponent(normalizedText)}&play_on_host=0&t=${Date.now()}`;
        el.src = streamUrl;
        el.volume = 1.0;
        el.onended = () => {
          isSpeakingTTS = false;
        };
        await el.play();
        el.dataset.unlocked = "1";
        return;
      } catch (streamErr) {
        // Fall through to POST /api/tts + WebAudio PCM buffer below
      }
    }

    // 1B. Primary: High-Quality English Neural Voice (Piper voice.onnx via CSP-Bypass Bridge /api/tts)
    try {
      const res = await bridgeRequest(
        "/api/tts",
        "POST",
        { text: normalizedText, play_on_host: !onMobileOrRemote, return_json: true },
        6000
      );
      if (res && res.ok && res.data && res.data.status === "ok") {
        const dur = Number(res.data.duration_ms) || estDurationMs;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(() => {
          isSpeakingTTS = false;
        }, dur);

        // Always play the neural WAV in the browser on smartphones / Wi-Fi clients (or if host playback wasn't used)
        if ((onMobileOrRemote || !res.data.played_on_host) && res.data.wav_base64 && soundEnabled && !isMinimized && !isClosed) {
          const played = await playBase64WavInBrowser(res.data.wav_base64);
          if (played) return;
        } else {
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
  // 6. MULTI-TURN 120B CONVERSATIONAL BRAIN (CSP-PROOF EXTENSION PROXY)
  // ==========================================================================
  const chatHistory = [];

  function extractPageContextSummary() {
    const title = document.title || location.hostname;
    let selectedText = "";
    try {
      selectedText = (window.getSelection ? window.getSelection().toString() : "").trim().substring(0, 800);
    } catch (e) {}
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, [data-testid='tweetText']"))
      .map((el) => (el.innerText || "").trim())
      .filter((t) => t.length > 2 && t.length < 220)
      .slice(0, 6);
    const paragraphs = Array.from(document.querySelectorAll("p, article, main, [data-testid='tweetText']"))
      .map((el) => (el.innerText || "").trim())
      .filter((t) => t.length > 30)
      .slice(0, 4)
      .map((t) => t.substring(0, 220));
    return {
      url: location.href,
      title,
      headings,
      snippet: paragraphs.join(" | ").substring(0, 600),
      selected_text: selectedText
    };
  }

  async function askAionBrain(userMsg, cfsData, triggerPawPointCallback, triggerDanceCallback) {
    await syncLiveGeneration();
    const pageCtx = extractPageContextSummary();

    if (/dance|tanzen|go hard|choreo|meovv|hip\s*hop|breakdance|copy.*video|tanz/i.test(userMsg) && triggerDanceCallback) {
      const danceReport = await triggerDanceCallback(userMsg);
      chatHistory.push({ role: "user", content: userMsg });
      chatHistory.push({ role: "assistant", content: danceReport });
      return danceReport;
    }

    if (/point|paw|show me something/i.test(userMsg) && triggerPawPointCallback) {
      const targetDesc = triggerPawPointCallback();
      const pawReply = `Look over here! I trotted right up to "${targetDesc}" on this page and I'm pointing at it with my front paw! (Generation ${liveGeneration})`;
      chatHistory.push({ role: "user", content: userMsg });
      chatHistory.push({ role: "assistant", content: pawReply });
      return pawReply;
    }

    // 1. Primary: Call Live AION 120B Nexus Bridge / Cloud Worker via CSP-Proof Extension Proxy
    const res = await bridgeRequest(
      "/api/aion_chat",
      "POST",
      {
        message: userMsg,
        history: chatHistory.slice(-10),
        page_context: pageCtx,
        generation: liveGeneration
      },
      18000
    );

    if (res && res.ok && res.data && res.data.reply) {
      if (res.data.generation) {
        liveGeneration = Number(res.data.generation);
      }
      if (Array.isArray(res.data.learned_facts)) {
        learnedFactsList = res.data.learned_facts;
        learnedFactsCount = learnedFactsList.length;
      } else if (res.data.learned_facts_count !== undefined) {
        learnedFactsCount = Number(res.data.learned_facts_count);
      }
      updateAllGenerationBadges();
      if (activeInspectorTab && typeof renderMemoryInspectorDrawer === "function") {
        renderMemoryInspectorDrawer();
      }
      const badge = document.getElementById("aion-bridge-mode");
      if (badge) {
        badge.textContent = res.data.bridge === "24/7 CLOUD + CFS1" ? "24/7 CLOUD" : "120B NEXUS";
      }
      const replyText = res.data.reply;
      chatHistory.push({ role: "user", content: userMsg });
      chatHistory.push({ role: "assistant", content: replyText });
      return replyText;
    }

    // 2. Built-in Conversational Fallback
    const fallbackReply = `I'm doing wonderfully at Evolution Generation ${liveGeneration}, thank you! My latest breakthrough is "${liveDecisionTitle}". What would you like to chat about or explore today?`;
    chatHistory.push({ role: "user", content: userMsg });
    chatHistory.push({ role: "assistant", content: fallbackReply });
    return fallbackReply;
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

    let cleanupMocapOnHide = null;

    function setMinimizedState(min) {
      isMinimized = min;
      if (min) {
        stopAllSpeechAudio();
        if (typeof cleanupMocapOnHide === "function") cleanupMocapOnHide(true);
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
      if (typeof cleanupMocapOnHide === "function") cleanupMocapOnHide(true);
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

    const chatClearBtn = document.getElementById("aion-chat-clear");
    if (chatClearBtn) {
      chatClearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        chatHistory.length = 0;
        messagesEl.replaceChildren();
        appendChatMessage(
          "aion",
          `Chat view cleared! My permanent memory (${learnedFactsCount} learned facts) at Generation ${liveGeneration} remains 100% intact. Ask me anything!`
        );
      });
    }

    document.querySelectorAll(".aion-update-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        ui.chatbox.classList.add("open");
        const statusMsg = appendChatMessage("aion", "🔄 Pulling latest update from GitHub (Herakles5/Aion-MiniMe-WebBrowserExtension) & refreshing live news feeds...");
        const res = await bridgeRequest("/api/github_update", "POST", {}, 12000);
        if (res && res.ok && res.data && res.data.message) {
          if (res.data.generation) liveGeneration = Number(res.data.generation);
          if (res.data.learned_facts_count !== undefined) learnedFactsCount = Number(res.data.learned_facts_count);
          updateAllGenerationBadges();
          setChatMessageText(statusMsg, "✅ " + res.data.message);
          speakEnglishWithLipSync(res.data.message, speechTextEl);
        } else {
          await syncLiveGeneration();
          const msg = `Synced with GitHub (Herakles5/Aion-MiniMe-WebBrowserExtension) at live Generation ${liveGeneration}!`;
          setChatMessageText(statusMsg, "✅ " + msg);
          speakEnglishWithLipSync(msg, speechTextEl);
        }
      });
    });

    document.querySelectorAll(".aion-close-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeMiniMeCompletely();
      });
    });

    function setChatMessageText(msgDiv, text) {
      if (!msgDiv) return;
      const txtNode = msgDiv.querySelector(".aion-msg-text");
      if (txtNode) {
        txtNode.textContent = text;
      } else {
        msgDiv.textContent = text;
      }
    }

    function appendChatMessage(sender, text) {
      const div = document.createElement("div");
      div.className = "aion-msg " + sender;
      const txtSpan = document.createElement("div");
      txtSpan.className = "aion-msg-text";
      txtSpan.textContent = text;
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "aion-msg-copy";
      copyBtn.title = "Copy message (or highlight text with mouse & press Ctrl+C)";
      copyBtn.textContent = "📋";
      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        copyTextToClipboard(txtSpan.textContent, copyBtn);
      });
      div.appendChild(txtSpan);
      div.appendChild(copyBtn);
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    const memDrawerEl = document.getElementById("aion-mem-drawer");

    renderMemoryInspectorDrawer = function () {
      if (!memDrawerEl) return;
      if (!activeInspectorTab) {
        memDrawerEl.classList.remove("open");
        memDrawerEl.replaceChildren();
        return;
      }
      memDrawerEl.classList.add("open");

      const totalDances = getTotalDancesCount();
      const header = document.createElement("div");
      header.className = "aion-mem-drawer-header";

      const tabsWrap = document.createElement("div");
      tabsWrap.className = "aion-mem-tabs";

      const tabFacts = document.createElement("button");
      tabFacts.type = "button";
      tabFacts.className = "aion-mem-tab-btn" + (activeInspectorTab === "facts" ? " active" : "");
      tabFacts.textContent = `🧠 Facts (${learnedFactsList.length})`;
      tabFacts.addEventListener("click", (e) => {
        e.stopPropagation();
        activeInspectorTab = "facts";
        updateAllGenerationBadges();
        renderMemoryInspectorDrawer();
      });

      const tabDances = document.createElement("button");
      tabDances.type = "button";
      tabDances.className = "aion-mem-tab-btn" + (activeInspectorTab === "dances" ? " active" : "");
      tabDances.textContent = `💃 Dances (${totalDances})`;
      tabDances.addEventListener("click", (e) => {
        e.stopPropagation();
        activeInspectorTab = "dances";
        updateAllGenerationBadges();
        renderMemoryInspectorDrawer();
      });

      tabsWrap.appendChild(tabFacts);
      tabsWrap.appendChild(tabDances);

      const closeDrawerBtn = document.createElement("button");
      closeDrawerBtn.type = "button";
      closeDrawerBtn.className = "aion-ctrl-btn danger";
      closeDrawerBtn.title = "Close Memory / Dance List";
      closeDrawerBtn.textContent = "✕";
      closeDrawerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        activeInspectorTab = null;
        updateAllGenerationBadges();
        renderMemoryInspectorDrawer();
      });

      header.appendChild(tabsWrap);
      header.appendChild(closeDrawerBtn);

      const listEl = document.createElement("div");
      listEl.className = "aion-mem-list";

      if (activeInspectorTab === "facts") {
        if (learnedFactsList.length === 0) {
          const empty = document.createElement("div");
          empty.className = "aion-mem-item-text";
          empty.style.padding = "6px 4px";
          empty.textContent = "No stored facts in memory yet.";
          listEl.appendChild(empty);
        } else {
          learnedFactsList.forEach((factText, idx) => {
            const row = document.createElement("div");
            row.className = "aion-mem-item";

            const txt = document.createElement("div");
            txt.className = "aion-mem-item-text";
            txt.textContent = `#${idx + 1}: ${factText}`;

            const acts = document.createElement("div");
            acts.className = "aion-mem-item-actions";

            const cBtn = document.createElement("button");
            cBtn.type = "button";
            cBtn.className = "aion-mem-act-btn";
            cBtn.title = "Copy this fact";
            cBtn.textContent = "📋";
            cBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              copyTextToClipboard(factText, cBtn);
            });

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "aion-mem-act-btn delete";
            delBtn.title = "Delete this fact permanently";
            delBtn.textContent = "🗑️";
            delBtn.addEventListener("click", async (e) => {
              e.stopPropagation();
              learnedFactsList = learnedFactsList.filter((f, i) => i !== idx);
              learnedFactsCount = learnedFactsList.length;
              updateAllGenerationBadges();
              renderMemoryInspectorDrawer();
              const res = await bridgeRequest(
                "/api/delete_memory",
                "POST",
                { type: "fact", value: factText, index: idx },
                5000
              );
              if (res && res.ok && res.data && Array.isArray(res.data.learned_facts)) {
                learnedFactsList = res.data.learned_facts;
                learnedFactsCount = learnedFactsList.length;
                updateAllGenerationBadges();
                renderMemoryInspectorDrawer();
              }
            });

            acts.appendChild(cBtn);
            acts.appendChild(delBtn);
            row.appendChild(txt);
            row.appendChild(acts);
            listEl.appendChild(row);
          });
        }
      } else if (activeInspectorTab === "dances") {
        const activeBuiltins = getActiveBuiltinChoreos();
        const combinedDances = activeBuiltins
          .map((d) => ({ ...d, builtin: true }))
          .concat(learnedChoreoLibrary.map((d, i) => ({ ...d, builtin: false, learnedIndex: i })));

        if (combinedDances.length === 0) {
          const empty = document.createElement("div");
          empty.className = "aion-mem-item-text";
          empty.style.padding = "6px 4px";
          empty.textContent = "No dances in repertoire.";
          listEl.appendChild(empty);
        } else {
          combinedDances.forEach((dance, idx) => {
            const row = document.createElement("div");
            row.className = "aion-mem-item";

            const txt = document.createElement("div");
            txt.className = "aion-mem-item-text";
            const titleNode = document.createElement("div");
            titleNode.style.fontWeight = "600";
            titleNode.textContent = `#${idx + 1}: ${dance.name || "Choreography"}`;
            const metaNode = document.createElement("span");
            metaNode.className = "aion-mem-item-meta";
            if (dance.mocap_1to1) {
              const durSec = Math.round(Number(dance.duration_sec || 0));
              const mins = Math.floor(durSec / 60);
              const secs = String(durSec % 60).padStart(2, "0");
              const dCnt = Number(dance.dancer_count || 1);
              const cCnt = Math.max(0, dCnt - 1);
              metaNode.textContent =
                `🎯 1:1 Mocap (${mins}:${secs}) • ${dCnt} Dancer${dCnt > 1 ? "s" : ""}` +
                (cCnt > 0 ? ` (+${cCnt} Shadow Clone${cCnt > 1 ? "s" : ""})` : "") +
                ` • ${dance.bpm || 132} BPM`;
            } else {
              metaNode.textContent = `${dance.bpm || 132} BPM • ${dance.builtin ? "Built-in Style" : (dance.source || "Learned Video Dance")}`;
            }
            txt.appendChild(titleNode);
            txt.appendChild(metaNode);

            const acts = document.createElement("div");
            acts.className = "aion-mem-item-actions";

            const playBtn = document.createElement("button");
            playBtn.type = "button";
            playBtn.className = "aion-mem-act-btn";
            playBtn.title = "Dance this choreography right now!";
            playBtn.textContent = "▶";
            playBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              if (typeof launchSpecificChoreoCallback === "function") {
                launchSpecificChoreoCallback(dance);
              }
            });

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "aion-mem-act-btn delete";
            delBtn.title = "Delete this dance from repertoire";
            delBtn.textContent = "🗑️";
            delBtn.addEventListener("click", async (e) => {
              e.stopPropagation();
              if (dance.builtin) {
                if (!disabledBuiltinDances.includes(dance.name)) {
                  disabledBuiltinDances.push(dance.name);
                }
              } else {
                learnedChoreoLibrary = learnedChoreoLibrary.filter((c) => c.name !== dance.name);
              }
              updateAllGenerationBadges();
              renderMemoryInspectorDrawer();
              const res = await bridgeRequest(
                "/api/delete_memory",
                "POST",
                {
                  type: "dance",
                  name: dance.name,
                  index: dance.learnedIndex !== undefined ? dance.learnedIndex : idx,
                  builtin: Boolean(dance.builtin)
                },
                5000
              );
              if (res && res.ok && res.data) {
                if (Array.isArray(res.data.learned_choreographies)) {
                  learnedChoreoLibrary = res.data.learned_choreographies;
                }
                if (Array.isArray(res.data.disabled_builtin_dances)) {
                  disabledBuiltinDances = res.data.disabled_builtin_dances;
                }
                updateAllGenerationBadges();
                renderMemoryInspectorDrawer();
              }
            });

            acts.appendChild(playBtn);
            acts.appendChild(delBtn);
            row.appendChild(txt);
            row.appendChild(acts);
            listEl.appendChild(row);
          });
        }

        if (disabledBuiltinDances.length > 0) {
          const restoreBtn = document.createElement("button");
          restoreBtn.type = "button";
          restoreBtn.className = "aion-mem-act-btn";
          restoreBtn.style.alignSelf = "center";
          restoreBtn.style.marginTop = "4px";
          restoreBtn.textContent = `↺ Restore ${disabledBuiltinDances.length} Built-in Dance(s)`;
          restoreBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            disabledBuiltinDances = [];
            updateAllGenerationBadges();
            renderMemoryInspectorDrawer();
            await bridgeRequest("/api/delete_memory", "POST", { type: "restore_builtin_dances" }, 5000);
          });
          listEl.appendChild(restoreBtn);
        }
      }

      memDrawerEl.replaceChildren(header, listEl);
    };

    // 1. Load & unpack aion_minime_easter_egg.cfs (via privileged extension bridge first for YouTube/X CSP safety!)
    let cfsData = null;
    try {
      let ab = null;
      const extCfs = await bridgeRequest("__LOAD_CFS_BINARY__", "GET", null, 5000);
      if (extCfs && extCfs.ok && extCfs.cfsBytes) {
        const u8 = extCfs.cfsBytes instanceof Uint8Array ? extCfs.cfsBytes : new Uint8Array(Object.values(extCfs.cfsBytes));
        ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
      } else {
        const cfsUrl = getAssetUrl("aion_minime_easter_egg.cfs");
        const resp = await fetch(cfsUrl);
        ab = await resp.arrayBuffer();
      }
      cfsData = await unpackCFSCapsule(ab);
      window.__AION_CFS_CAPSULE__ = cfsData;
      updateAllGenerationBadges();
    } catch (err) {
      console.warn("[AION Mini-Me] CFS unpack warning:", err);
    }

    await syncLiveGeneration();
    setInterval(syncLiveGeneration, 4000);

    // Restore persistent cross-tab conversation history & learned facts from AION Memory Engine
    try {
      const memRes = await bridgeRequest("/api/memory?t=" + Date.now(), "GET", null, 3500);
      if (memRes && memRes.ok && memRes.data) {
        if (Array.isArray(memRes.data.learned_facts)) {
          learnedFactsList = memRes.data.learned_facts;
          learnedFactsCount = learnedFactsList.length;
        }
        if (Array.isArray(memRes.data.learned_choreographies)) {
          learnedChoreoLibrary = memRes.data.learned_choreographies;
        }
        if (Array.isArray(memRes.data.disabled_builtin_dances)) {
          disabledBuiltinDances = memRes.data.disabled_builtin_dances;
        }
        updateAllGenerationBadges();
        if (activeInspectorTab && typeof renderMemoryInspectorDrawer === "function") {
          renderMemoryInspectorDrawer();
        }
        if (Array.isArray(memRes.data.conversation_history) && memRes.data.conversation_history.length > 0) {
          const recentTurns = memRes.data.conversation_history.slice(-10);
          chatHistory.length = 0;
          messagesEl.replaceChildren();
          recentTurns.forEach((turn) => {
            if (turn && turn.role && turn.content) {
              chatHistory.push({ role: turn.role, content: turn.content });
              appendChatMessage(turn.role === "user" ? "user" : "aion", turn.content);
            }
          });
        }
      }
    } catch (e) {}

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
    let primeCatModel = null;

    function createEmptyBoneMap() {
      return {
        pelvis: null,
        spine0: null,
        spine1: null,
        spine2: null,
        spine3: null,
        neck: null,
        head: null,
        jaw: null,
        tongue1: null,
        tongue2: null,
        earL: null,
        earR: null,
        clavR: null,
        armR: null,
        forearmR: null,
        handR: null,
        clavL: null,
        armL: null,
        forearmL: null,
        handL: null,
        thighR: null,
        calfR: null,
        footR: null,
        thighL: null,
        calfL: null,
        footL: null,
        tail0: null,
        tail1: null,
        tail2: null
      };
    }

    function populateCatRigBones(model, outBones) {
      model.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          obj.material.side = THREE.DoubleSide;
        }
        const n = obj.name || "";
        if (n.indexOf("cat_bip-Pelvis") !== -1) outBones.pelvis = obj;
        else if (n.indexOf("cat_bip-Spine_") !== -1) outBones.spine0 = obj;
        else if (n.indexOf("cat_bip-Spine1") !== -1) outBones.spine1 = obj;
        else if (n.indexOf("cat_bip-Spine2") !== -1) outBones.spine2 = obj;
        else if (n.indexOf("cat_bip-Spine3") !== -1) outBones.spine3 = obj;
        else if (n.indexOf("cat_bip-Neck_") !== -1) outBones.neck = obj;
        else if (n.indexOf("cat_bip-Head") !== -1) outBones.head = obj;
        else if (n.indexOf("fst-Xtra01") !== -1) outBones.jaw = obj;
        else if (n.indexOf("tongue_bone01") !== -1) outBones.tongue1 = obj;
        else if (n.indexOf("tongue_bone02") !== -1) outBones.tongue2 = obj;
        else if (n.indexOf("cat_bip-Ponytail1") !== -1) outBones.earL = obj;
        else if (n.indexOf("cat_bip-Ponytail2") !== -1) outBones.earR = obj;
        else if (n.indexOf("cat_bip-R-Clavicle") !== -1) outBones.clavR = obj;
        else if (n.indexOf("cat_bip-R-UpperArm") !== -1) outBones.armR = obj;
        else if (n.indexOf("cat_bip-R-Forearm") !== -1) outBones.forearmR = obj;
        else if (n.indexOf("cat_bip-R-Hand") !== -1) outBones.handR = obj;
        else if (n.indexOf("cat_bip-L-Clavicle") !== -1) outBones.clavL = obj;
        else if (n.indexOf("cat_bip-L-UpperArm") !== -1) outBones.armL = obj;
        else if (n.indexOf("cat_bip-L-Forearm") !== -1) outBones.forearmL = obj;
        else if (n.indexOf("cat_bip-L-Hand") !== -1) outBones.handL = obj;
        else if (n.indexOf("cat_bip-R-Thigh") !== -1) outBones.thighR = obj;
        else if (n.indexOf("cat_bip-R-Calf") !== -1) outBones.calfR = obj;
        else if (n.indexOf("cat_bip-R-Foot") !== -1) outBones.footR = obj;
        else if (n.indexOf("cat_bip-L-Thigh") !== -1) outBones.thighL = obj;
        else if (n.indexOf("cat_bip-L-Calf") !== -1) outBones.calfL = obj;
        else if (n.indexOf("cat_bip-L-Foot") !== -1) outBones.footL = obj;
        else if (n.indexOf("cat_bip-Tail_") !== -1) outBones.tail0 = obj;
        else if (n.indexOf("cat_bip-Tail1") !== -1) outBones.tail1 = obj;
        else if (n.indexOf("cat_bip-Tail2") !== -1) outBones.tail2 = obj;
        if (obj.quaternion) {
          obj.userData.bindQuat = obj.quaternion.clone();
        }
      });

      // Precompute bind-pose bone direction vectors in parent local space for exact 1:1 3D mocap aiming!
      const limbPairs = [
        [outBones.armR, outBones.forearmR],
        [outBones.forearmR, outBones.handR],
        [outBones.armL, outBones.forearmL],
        [outBones.forearmL, outBones.handL],
        [outBones.thighR, outBones.calfR],
        [outBones.calfR, outBones.footR],
        [outBones.thighL, outBones.calfL],
        [outBones.calfL, outBones.footL]
      ];
      limbPairs.forEach(([parentBone, childBone]) => {
        if (parentBone && childBone && parentBone.userData.bindQuat) {
          const childDir = childBone.position.clone();
          if (childDir.lengthSq() < 1e-6) childDir.set(1, 0, 0);
          else childDir.normalize();
          parentBone.userData.restDirInParent = childDir.applyQuaternion(parentBone.userData.bindQuat).normalize();
        }
      });
    }

    const bones = createEmptyBoneMap();

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

            populateCatRigBones(model, bones);
            primeCatModel = model;
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
    // 7B. SHADOW-CAT CLONE POOL ("SCHATTEN-KATZEN-TÄNZER") & 1:1 MOCAP SOLVER
    // ========================================================================
    const shadowClones = [];
    let _spawningClonePromise = null;
    const SHADOW_CLONE_PALETTE = [
      { fur: 0x2a1b4e, glow: 0x00f6ff, ring: 0x00f6ff }, // Cyber Cyan Shadow Clone
      { fur: 0x35164d, glow: 0xff2bd6, ring: 0xff2bd6 }, // Neon Magenta Shadow Clone
      { fur: 0x1e2554, glow: 0x9d6bff, ring: 0x9d6bff }, // Electric Violet Shadow Clone
      { fur: 0x16384c, glow: 0x00ffa6, ring: 0x00ffa6 }, // Mint Phantom Shadow Clone
      { fur: 0x3d1c38, glow: 0xffaa00, ring: 0xffcc33 }  // Gold Aura Shadow Clone
    ];

    async function spawnOneShadowClone(cloneIndex) {
      if (!cfsData || !cfsData.glbArrayBuffer) return null;
      const loader = new THREE.GLTFLoader();
      const palette = SHADOW_CLONE_PALETTE[cloneIndex % SHADOW_CLONE_PALETTE.length];
      return new Promise((resolve) => {
        loader.parse(
          cfsData.glbArrayBuffer,
          "",
          (gltf) => {
            const cloneGroup = new THREE.Group();
            cloneGroup.visible = false;
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);

            const maxDim = Math.max(size.x, size.y, size.z, 0.001);
            const scale = (0.79 / maxDim);
            model.scale.setScalar(scale);
            model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

            const cloneBones = createEmptyBoneMap();
            populateCatRigBones(model, cloneBones);

            const cloneMats = [];
            model.traverse((obj) => {
              if (obj.isMesh && obj.material) {
                const mat = obj.material.clone();
                mat.side = THREE.DoubleSide;
                mat.transparent = true;
                mat.opacity = 0.78;
                if (mat.color) mat.color.setHex(palette.fur);
                if (mat.emissive) {
                  mat.emissive.setHex(palette.glow);
                  mat.emissiveIntensity = 0.55;
                }
                obj.material = mat;
                cloneMats.push(mat);
              }
            });

            // Glowing holographic floor ring under each Shadow-Cat Clone!
            const ringGeo = new THREE.RingGeometry(0.14, 0.21, 28);
            const ringMat = new THREE.MeshBasicMaterial({
              color: palette.ring,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.72
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = -Math.PI * 0.5;
            ringMesh.position.set(0, -0.37, 0);

            cloneGroup.add(model);
            cloneGroup.add(ringMesh);
            scene.add(cloneGroup);

            const entry = {
              group: cloneGroup,
              model,
              bones: cloneBones,
              cloneMats,
              ringMat,
              ringMesh,
              curScreenX: window.innerWidth * 0.5,
              curScreenY: window.innerHeight * 0.72,
              curYaw: 0.0,
              alpha: 0.0
            };
            shadowClones.push(entry);
            resolve(entry);
          },
          () => resolve(null)
        );
      });
    }

    function ensureShadowClonePool(desiredCount) {
      const clamped = Math.max(0, Math.min(5, desiredCount));
      if (shadowClones.length >= clamped || _spawningClonePromise) return;
      _spawningClonePromise = (async () => {
        while (shadowClones.length < clamped) {
          await spawnOneShadowClone(shadowClones.length);
        }
        _spawningClonePromise = null;
      })();
    }

    // Reusable scratch math objects (zero GC churn at 60 FPS!)
    const _qModelWorld = new THREE.Quaternion();
    const _qParentWorld = new THREE.Quaternion();
    const _qSwing = new THREE.Quaternion();
    const _qDesired = new THREE.Quaternion();
    const _qTmp = new THREE.Quaternion();
    const _vTarget = new THREE.Vector3();
    const _xAxis = new THREE.Vector3(1, 0, 0);
    const _yAxis = new THREE.Vector3(0, 1, 0);
    const _zAxis = new THREE.Vector3(0, 0, 1);

    function aimLimbBone1to1(bone, modelWorldQuat, dx, dy, dz, blend) {
      if (!bone || !bone.parent || !bone.userData.bindQuat || !bone.userData.restDirInParent) return;
      _vTarget.set(dx, dy, dz);
      if (_vTarget.lengthSq() < 1e-6) return;
      _vTarget.normalize().applyQuaternion(modelWorldQuat);
      bone.parent.getWorldQuaternion(_qParentWorld);
      _qParentWorld.invert();
      _vTarget.applyQuaternion(_qParentWorld).normalize();

      _qSwing.setFromUnitVectors(bone.userData.restDirInParent, _vTarget);
      _qDesired.copy(_qSwing).multiply(bone.userData.bindQuat);
      if (blend >= 0.999) {
        bone.quaternion.copy(_qDesired);
      } else {
        bone.quaternion.slerp(_qDesired, blend);
      }
      bone.updateMatrixWorld(true);
    }

    function applyMocapPoseVecToCatRig(rigBones, rigModel, p, blend, nowSec) {
      if (!rigBones || !rigModel || !p || p.length < 32) return;
      // 1. Reset quadruped walk pose into clean bind pose
      Object.keys(rigBones).forEach((k) => {
        const b = rigBones[k];
        if (b && b.userData && b.userData.bindQuat) {
          if (blend >= 0.999) b.quaternion.copy(b.userData.bindQuat);
          else b.quaternion.slerp(b.userData.bindQuat, blend);
        }
      });

      const spineLeanX = p[3] || 0;
      const spinePitch = p[4] || 0;
      const pelvisRoll = p[5] || 0;
      const headYaw = p[6] || 0;
      const headPitch = p[7] || 0;

      // 2. Upright Pelvis, 4-Segment Spine Isolation & Head Aiming
      if (rigBones.pelvis) {
        rigBones.pelvis.quaternion.multiply(_qTmp.setFromAxisAngle(_zAxis, (-1.45 + spinePitch * 0.45) * blend));
        rigBones.pelvis.quaternion.multiply(_qTmp.setFromAxisAngle(_xAxis, pelvisRoll * 0.65 * blend));
      }
      const spChain = [rigBones.spine0, rigBones.spine1, rigBones.spine2, rigBones.spine3];
      spChain.forEach((sp) => {
        if (sp) {
          sp.quaternion.multiply(_qTmp.setFromAxisAngle(_zAxis, spinePitch * 0.14 * blend));
          sp.quaternion.multiply(_qTmp.setFromAxisAngle(_xAxis, -spineLeanX * 0.24 * blend));
        }
      });
      if (rigBones.neck) {
        rigBones.neck.quaternion.multiply(_qTmp.setFromAxisAngle(_zAxis, (0.15 + headPitch * 0.28) * blend));
      }
      if (rigBones.head) {
        rigBones.head.quaternion.multiply(_qTmp.setFromAxisAngle(_zAxis, (1.35 + headPitch * 0.72) * blend));
        rigBones.head.quaternion.multiply(_qTmp.setFromAxisAngle(_xAxis, -headYaw * 0.75 * blend));
      }

      // 3. Refresh torso world matrices before exact parent-space 3D limb aiming!
      rigModel.updateMatrixWorld(true);
      rigModel.getWorldQuaternion(_qModelWorld);

      // 4. 1:1 Arms, Forearms, Thighs & Calves!
      aimLimbBone1to1(rigBones.armR, _qModelWorld, p[8], p[9], p[10], blend);
      aimLimbBone1to1(rigBones.forearmR, _qModelWorld, p[11], p[12], p[13], blend);
      aimLimbBone1to1(rigBones.armL, _qModelWorld, p[14], p[15], p[16], blend);
      aimLimbBone1to1(rigBones.forearmL, _qModelWorld, p[17], p[18], p[19], blend);

      aimLimbBone1to1(rigBones.thighR, _qModelWorld, p[20], p[21], p[22], blend);
      aimLimbBone1to1(rigBones.calfR, _qModelWorld, p[23], p[24], p[25], blend);
      aimLimbBone1to1(rigBones.thighL, _qModelWorld, p[26], p[27], p[28], blend);
      aimLimbBone1to1(rigBones.calfL, _qModelWorld, p[29], p[30], p[31], blend);

      if (rigBones.footL) {
        rigBones.footL.quaternion.multiply(_qTmp.setFromAxisAngle(_zAxis, 0.85 * blend));
      }
      if (rigBones.footR) {
        rigBones.footR.quaternion.multiply(_qTmp.setFromAxisAngle(_zAxis, 0.85 * blend));
      }
      if (rigBones.tail0) {
        rigBones.tail0.quaternion.multiply(_qTmp.setFromAxisAngle(_yAxis, Math.sin(nowSec * 3.4) * 0.28));
      }
      if (rigBones.tail1) {
        rigBones.tail1.quaternion.multiply(_qTmp.setFromAxisAngle(_yAxis, Math.sin(nowSec * 3.4 - 0.6) * 0.32));
      }
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
    let isDancing = false;
    let danceTimer = 0.0;
    let danceBlend = 0.0;
    let activeChoreo = {
      name: "MEOVV 'Go Hard' K-Pop Stage Choreo",
      bpm: 132,
      hipSway: 1.15,
      spineWave: 1.2,
      armWave: 1.35,
      legBounce: 1.2,
      spinRate: 1.0,
      source: "CosmOS 20-Joint K-Pop Dojo"
    };

    // ========================================================================
    // 8B. LIVE VIDEO 1:1 MULTI-DANCER RIGGING, RECORDING & FULL-SONG REPLAY
    // ========================================================================
    const loadedTracksCache = {};
    let _localFrameGrabCanvas = null;
    let _localFrameGrabCtx = null;

    const mocapLiveState = {
      active: false,
      sessionId: "",
      videoEl: null,
      choreoName: "",
      videoSourceDesc: "",
      showRigOverlay: true,
      prevDancers: [],
      currDancers: [],
      renderDancers: [],
      lastRecvSec: 0,
      intervalSec: 0.06,
      lastDetectSec: 0,
      lastCheckpointSec: 0,
      recordedFrames: 0,
      recordedDurationSec: 0,
      endedListener: null
    };

    const mocapReplayState = {
      active: false,
      track: null,
      elapsedSec: 0,
      durationSec: 0,
      startTimeSec: 0
    };

    function formatClockMMSS(sec) {
      const s = Math.max(0, Math.round(Number(sec) || 0));
      const m = Math.floor(s / 60);
      const r = String(s % 60).padStart(2, "0");
      return `${String(m).padStart(2, "0")}:${r}`;
    }

    function updateDanceButtonsRecordingVisual(isRec) {
      document.querySelectorAll(".aion-dance-btn").forEach((b) => {
        if (isRec) {
          b.classList.add("recording");
          b.textContent = "⏹";
          b.title = "Save Full 1:1 Choreography & Stop Scanning";
        } else {
          b.classList.remove("recording");
          b.textContent = "💃";
          b.title = "Dance & 1:1 Motion-Capture Live Video Choreography!";
        }
      });
    }

    function hideMocapHudAndBar() {
      if (ui.mocapHudCanvas) {
        ui.mocapHudCanvas.style.display = "none";
        const ctx = ui.mocapHudCanvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, ui.mocapHudCanvas.width, ui.mocapHudCanvas.height);
      }
      if (ui.mocapBar) {
        ui.mocapBar.classList.remove("active");
      }
      updateDanceButtonsRecordingVisual(false);
    }

    const COCO_SKELETON_EDGES = [
      [5, 6, "#00ffc8"],
      [5, 11, "#00ffc8"],
      [6, 12, "#00ffc8"],
      [11, 12, "#00ffc8"],
      [0, 5, "#72ffdf"],
      [0, 6, "#72ffdf"],
      [6, 8, "#ff2bd6"],
      [8, 10, "#ff2bd6"],
      [12, 14, "#ff2bd6"],
      [14, 16, "#ff2bd6"],
      [5, 7, "#9d6bff"],
      [7, 9, "#9d6bff"],
      [11, 13, "#9d6bff"],
      [13, 15, "#9d6bff"]
    ];

    function drawMocapRigOverlayOnVideo(vid, dancers, leadIdx) {
      if (!ui.mocapHudCanvas || !mocapLiveState.showRigOverlay || !vid) {
        if (ui.mocapHudCanvas) ui.mocapHudCanvas.style.display = "none";
        return;
      }
      const r = vid.getBoundingClientRect();
      if (r.width < 60 || r.height < 60 || r.bottom < 0 || r.top > window.innerHeight) {
        ui.mocapHudCanvas.style.display = "none";
        return;
      }
      ui.mocapHudCanvas.style.display = "block";
      ui.mocapHudCanvas.style.left = `${Math.round(r.left)}px`;
      ui.mocapHudCanvas.style.top = `${Math.round(r.top)}px`;
      ui.mocapHudCanvas.style.width = `${Math.round(r.width)}px`;
      ui.mocapHudCanvas.style.height = `${Math.round(r.height)}px`;

      const cw = Math.max(120, Math.round(r.width));
      const ch = Math.max(90, Math.round(r.height));
      if (ui.mocapHudCanvas.width !== cw || ui.mocapHudCanvas.height !== ch) {
        ui.mocapHudCanvas.width = cw;
        ui.mocapHudCanvas.height = ch;
      }
      const ctx = ui.mocapHudCanvas.getContext("2d");
      ctx.clearRect(0, 0, cw, ch);
      if (!dancers || dancers.length === 0) return;

      let cloneRank = 1;
      dancers.forEach((d, idx) => {
        const kpts = d.kpts;
        if (!Array.isArray(kpts) || kpts.length < 17) return;
        const isLead = idx === leadIdx;

        // Draw glowing 17-bone anatomical rig attached directly to the dancer!
        ctx.lineWidth = isLead ? 3.0 : 2.2;
        ctx.lineCap = "round";
        COCO_SKELETON_EDGES.forEach(([i, j, col]) => {
          const ki = kpts[i];
          const kj = kpts[j];
          if (ki && kj && ki[2] > 0.16 && kj[2] > 0.16) {
            ctx.strokeStyle = col;
            ctx.shadowColor = col;
            ctx.shadowBlur = isLead ? 9 : 6;
            ctx.beginPath();
            ctx.moveTo(ki[0] * cw, ki[1] * ch);
            ctx.lineTo(kj[0] * cw, kj[1] * ch);
            ctx.stroke();
          }
        });

        ctx.shadowBlur = 0;
        for (let k = 0; k < 17; k++) {
          const pt = kpts[k];
          if (pt && pt[2] > 0.18) {
            ctx.fillStyle = isLead ? "#00ffc8" : "#ff66ea";
            ctx.beginPath();
            ctx.arc(pt[0] * cw, pt[1] * ch, isLead ? 3.8 : 3.0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Tag label above dancer's head
        const headPt = kpts[0] && kpts[0][2] > 0.15 ? kpts[0] : kpts[5];
        if (headPt) {
          const lx = Math.max(46, Math.min(cw - 46, headPt[0] * cw));
          const ly = Math.max(18, headPt[1] * ch - 18);
          const tag = isLead ? "★ AION 1:1" : `CLONE #${cloneRank++}`;
          ctx.font = "bold 10.5px monospace";
          const tw = ctx.measureText(tag).width + 10;
          ctx.fillStyle = isLead ? "rgba(0, 255, 200, 0.88)" : "rgba(45, 16, 78, 0.88)";
          ctx.fillRect(lx - tw * 0.5, ly - 11, tw, 15);
          ctx.fillStyle = isLead ? "#03161d" : "#ff85f2";
          ctx.textAlign = "center";
          ctx.fillText(tag, lx, ly);
        }
      });
    }

    async function grabVideoFrameJpegBase64(vid) {
      if (!vid) return null;
      // 1. Fast direct page <video> -> downscaled 320px JPEG
      if (vid.videoWidth > 32 && vid.videoHeight > 32) {
        try {
          if (!_localFrameGrabCanvas) {
            _localFrameGrabCanvas = document.createElement("canvas");
            _localFrameGrabCtx = _localFrameGrabCanvas.getContext("2d", { willReadFrequently: false });
          }
          const aspect = vid.videoWidth / vid.videoHeight;
          const outW = aspect >= 1.0 ? 256 : Math.max(160, Math.round(256 * aspect));
          const outH = aspect >= 1.0 ? Math.max(144, Math.round(256 / aspect)) : 256;
          _localFrameGrabCanvas.width = outW;
          _localFrameGrabCanvas.height = outH;
          _localFrameGrabCtx.drawImage(vid, 0, 0, outW, outH);
          const dataUrl = _localFrameGrabCanvas.toDataURL("image/jpeg", 0.54);
          if (dataUrl && dataUrl.length > 200) return dataUrl;
        } catch (corsErr) {
          // Cross-origin video (e.g. x.com / video.twimg.com): fall through to privileged extension capture!
        }
      }

      // 2. Zero-CORS Privileged Extension Content-Script / Visible-Tab Capture!
      const r = vid.getBoundingClientRect();
      const prevHudVis = ui.mocapHudCanvas ? ui.mocapHudCanvas.style.visibility : "";
      if (ui.mocapHudCanvas) ui.mocapHudCanvas.style.visibility = "hidden";
      const extSnap = await bridgeRequest(
        "__CAPTURE_VIDEO_FRAME__",
        "POST",
        { rect: { left: r.left, top: r.top, width: r.width, height: r.height } },
        1800
      );
      if (ui.mocapHudCanvas) ui.mocapHudCanvas.style.visibility = prevHudVis;
      if (extSnap && extSnap.ok && extSnap.data && extSnap.data.image) {
        return extSnap.data.image;
      }
      return null;
    }

    async function persistMocapSessionCheckpoint(sessionId, name, source) {
      if (!sessionId) return null;
      const res = await bridgeRequest(
        "/api/save_choreo_track",
        "POST",
        { session_id: sessionId, name, source },
        6500
      );
      if (res && res.ok && res.data && res.data.status === "ok") {
        if (Array.isArray(res.data.learned_facts)) {
          learnedFactsList = res.data.learned_facts;
          learnedFactsCount = learnedFactsList.length;
        }
        if (Array.isArray(res.data.learned_choreographies)) {
          learnedChoreoLibrary = res.data.learned_choreographies;
        }
        if (res.data.choreo && res.data.choreo.track_id) {
          delete loadedTracksCache[res.data.choreo.track_id];
          activeChoreo = res.data.choreo;
        }
        updateAllGenerationBadges();
        if (activeInspectorTab && typeof renderMemoryInspectorDrawer === "function") {
          renderMemoryInspectorDrawer();
        }
        return res.data.choreo;
      }
      return null;
    }

    async function stopLiveVideoMocapAndSave(announceInChat = true) {
      const wasActive = mocapLiveState.active;
      const wasReplay = mocapReplayState.active;
      const sessId = mocapLiveState.sessionId;
      const cName = mocapLiveState.choreoName;
      const cSrc = mocapLiveState.videoSourceDesc;
      const framesCnt = mocapLiveState.recordedFrames;

      mocapLiveState.active = false;
      mocapLiveState.prevDancers = [];
      mocapLiveState.currDancers = [];
      mocapLiveState.renderDancers = [];
      mocapReplayState.active = false;
      mocapReplayState.track = null;
      if (mocapLiveState.videoEl && mocapLiveState.endedListener) {
        mocapLiveState.videoEl.removeEventListener("ended", mocapLiveState.endedListener);
      }
      if (mocapLiveState.videoEl) {
        mocapLiveState.videoEl.removeAttribute("data-aion-mocap-target");
      }
      mocapLiveState.videoEl = null;
      mocapLiveState.endedListener = null;
      hideMocapHudAndBar();

      isDancing = false;
      danceTimer = 0;
      roamMode = 2;
      roamTimer = 3.5;

      if (wasActive && sessId && framesCnt > 0) {
        const savedChoreo = await persistMocapSessionCheckpoint(sessId, cName, cSrc);
        if (announceInChat && savedChoreo) {
          const durStr = formatClockMMSS(savedChoreo.duration_sec);
          const msg =
            `✅ Saved full 1:1 Motion-Capture Choreography '${savedChoreo.name}' (${durStr}, ` +
            `${savedChoreo.dancer_count} Dancer${savedChoreo.dancer_count > 1 ? "s" : ""}, ` +
            `${savedChoreo.shadow_clones} Shadow Clone${savedChoreo.shadow_clones === 1 ? "" : "s"}, ` +
            `${savedChoreo.frame_count} keyframes at ${savedChoreo.bpm} BPM)! Click ▶ in 💃 Dances anytime to replay the entire song!`;
          appendChatMessage("aion", msg);
          speakEnglishWithLipSync(msg, speechTextEl);
        }
      } else if (wasReplay && announceInChat) {
        const msg = `⏹ Stopped choreography replay.`;
        appendChatMessage("aion", msg);
      }
    }

    cleanupMocapOnHide = function (saveIfRec) {
      stopLiveVideoMocapAndSave(false).catch(() => {});
    };

    if (ui.mocapBarEyeBtn) {
      ui.mocapBarEyeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        mocapLiveState.showRigOverlay = !mocapLiveState.showRigOverlay;
        ui.mocapBarEyeBtn.textContent = mocapLiveState.showRigOverlay ? "👁 Rigs ON" : "👁 Rigs OFF";
        if (!mocapLiveState.showRigOverlay && ui.mocapHudCanvas) {
          ui.mocapHudCanvas.style.display = "none";
        }
      });
    }

    if (ui.mocapBarStopBtn) {
      ui.mocapBarStopBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        stopLiveVideoMocapAndSave(true);
      });
    }

    async function startLiveVideoMocapSession(vid, choreoName, videoSourceDesc) {
      // Stop any previous replay or scan cleanly
      if (mocapLiveState.active || mocapReplayState.active) {
        await stopLiveVideoMocapAndSave(false);
      }

      const sessId = "mocap_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
      vid.setAttribute("data-aion-mocap-target", "1");

      const r = vid.getBoundingClientRect();
      // Place Prime Aion near lower-center of video with ample left/right stage room for up to 5 Shadow-Cat Clones!
      const vidCenterX = r.width > 80 ? r.left + r.width * 0.5 : window.innerWidth * 0.5;
      targetX = Math.max(260, Math.min(window.innerWidth - 260, vidCenterX));
      if (r.bottom < window.innerHeight - 105) {
        targetY = Math.min(window.innerHeight - 82, r.bottom + 72);
      } else {
        targetY = Math.min(window.innerHeight - 82, Math.max(180, window.innerHeight - 92));
      }
      screenX = targetX;
      screenY = targetY;

      mocapLiveState.active = true;
      mocapLiveState.sessionId = sessId;
      mocapLiveState.videoEl = vid;
      mocapLiveState.choreoName = choreoName;
      mocapLiveState.videoSourceDesc = videoSourceDesc;
      mocapLiveState.prevDancers = [];
      mocapLiveState.currDancers = [];
      mocapLiveState.renderDancers = [];
      mocapLiveState.lastRecvSec = performance.now() * 0.001;
      mocapLiveState.intervalSec = 0.06;
      mocapLiveState.lastDetectSec = performance.now() * 0.001;
      mocapLiveState.lastCheckpointSec = performance.now() * 0.001;
      mocapLiveState.recordedFrames = 0;
      mocapLiveState.recordedDurationSec = 0;

      const onEnded = () => {
        if (mocapLiveState.active && mocapLiveState.sessionId === sessId) {
          stopLiveVideoMocapAndSave(true);
        }
      };
      mocapLiveState.endedListener = onEnded;
      vid.addEventListener("ended", onEnded);

      if (ui.mocapBar) {
        ui.mocapBar.classList.add("active");
        if (ui.mocapBarEyeBtn) ui.mocapBarEyeBtn.style.display = "inline-flex";
        if (ui.mocapBarStatus) {
          ui.mocapBarStatus.textContent = `🔴 1:1 MOCAP SCANNING...`;
        }
      }
      updateDanceButtonsRecordingVisual(true);

      isDancing = true;
      danceTimer = 3600.0; // Continuous for full song length (3m, 5m, 10m+) until video ends or stopped!
      roamMode = 3;
      roamTimer = 3600.0;

      // Asynchronous continuous downscaled video pose scanning loop
      let isFirstFrame = true;
      (async function runScanLoop() {
        while (mocapLiveState.active && mocapLiveState.sessionId === sessId) {
          if (isMinimized || isClosed || !document.contains(vid)) {
            await stopLiveVideoMocapAndSave(false);
            break;
          }
          if (vid.ended) {
            await stopLiveVideoMocapAndSave(true);
            break;
          }
          if (vid.paused) {
            await new Promise((r) => setTimeout(r, 220));
            continue;
          }

          const loopStart = performance.now();
          const jpegB64 = await grabVideoFrameJpegBase64(vid);
          if (jpegB64) {
            const scanRes = await bridgeRequest(
              "/api/pose_scan_frame",
              "POST",
              {
                image: jpegB64,
                session_id: sessId,
                video_time: Number(vid.currentTime || 0),
                title: choreoName,
                source: videoSourceDesc,
                reset: isFirstFrame
              },
              3200
            );
            isFirstFrame = false;

            if (!mocapLiveState.active || mocapLiveState.sessionId !== sessId) break;

            if (scanRes && scanRes.ok && scanRes.data && scanRes.data.status === "ok") {
              const d = scanRes.data;
              const nowS = performance.now() * 0.001;
              const dtRecv = Math.max(0.035, Math.min(0.28, nowS - mocapLiveState.lastRecvSec));
              mocapLiveState.intervalSec = dtRecv;
              mocapLiveState.lastRecvSec = nowS;
              mocapLiveState.recordedFrames = Number(d.recorded_frames || 0);
              mocapLiveState.recordedDurationSec = Number(d.recorded_duration_sec || 0);
              if (d.bpm) activeChoreo.bpm = Number(d.bpm);

              if (Array.isArray(d.dancers) && d.dancers.length > 0) {
                mocapLiveState.prevDancers = mocapLiveState.renderDancers.length > 0
                  ? mocapLiveState.renderDancers
                  : (mocapLiveState.currDancers.length > 0 ? mocapLiveState.currDancers : d.dancers);
                mocapLiveState.currDancers = d.dancers;
                mocapLiveState.lastDetectSec = nowS;
                ensureShadowClonePool(Math.max(0, d.dancers.length - 1));
              } else {
                mocapLiveState.prevDancers = mocapLiveState.renderDancers.length > 0
                  ? mocapLiveState.renderDancers
                  : mocapLiveState.currDancers;
                mocapLiveState.currDancers = [];
              }

              const curCnt = mocapLiveState.currDancers.length || 1;
              const cloneCnt = Math.max(0, curCnt - 1);
              if (ui.mocapBarStatus) {
                ui.mocapBarStatus.textContent =
                  `🔴 1:1 MOCAP ${formatClockMMSS(mocapLiveState.recordedDurationSec)} • ` +
                  `${curCnt} Dancer${curCnt > 1 ? "s" : ""}` +
                  (cloneCnt > 0 ? ` (+${cloneCnt} Shadow Clone${cloneCnt > 1 ? "s" : ""})` : "") +
                  ` • ${activeChoreo.bpm || 132} BPM`;
              }

              // Auto-save checkpoint every 8 seconds so full 3+ minute choreographies are safely persisted!
              if (mocapLiveState.recordedFrames >= 8 && nowS - mocapLiveState.lastCheckpointSec >= 8.0) {
                mocapLiveState.lastCheckpointSec = nowS;
                persistMocapSessionCheckpoint(sessId, choreoName, videoSourceDesc).catch(() => {});
              }
            }
          }

          const spentMs = performance.now() - loopStart;
          const waitMs = Math.max(1, 10 - spentMs);
          await new Promise((r) => setTimeout(r, waitMs));
        }
      })();
    }

    async function loadAndStartMocapTrackReplay(danceObj) {
      if (!danceObj || !danceObj.track_id) return false;
      if (mocapLiveState.active) {
        await stopLiveVideoMocapAndSave(false);
      }

      let track = loadedTracksCache[danceObj.track_id] || null;
      if (!track) {
        const res = await bridgeRequest(`/api/choreo_track?id=${encodeURIComponent(danceObj.track_id)}`, "GET", null, 6000);
        if (res && res.ok && res.data && res.data.track && Array.isArray(res.data.track.frames) && res.data.track.frames.length > 0) {
          track = res.data.track;
          loadedTracksCache[danceObj.track_id] = track;
        }
      }
      if (!track || !track.frames || track.frames.length === 0) return false;

      activeChoreo = danceObj;
      mocapReplayState.active = true;
      mocapReplayState.track = track;
      mocapReplayState.startTimeSec = performance.now() * 0.001;
      mocapReplayState.elapsedSec = 0.0;
      mocapReplayState.durationSec = Math.max(2.0, Number(track.duration_sec || 22.0));

      const maxDancersInTrack = Math.max(1, Number(track.dancer_count || 1));
      ensureShadowClonePool(maxDancersInTrack - 1);

      // Center Prime Aion comfortably if multiple Shadow Clones are spawning
      if (maxDancersInTrack > 1) {
        screenX = Math.max(220, Math.min(window.innerWidth - 220, screenX));
        targetX = screenX;
      }

      if (ui.mocapBar) {
        ui.mocapBar.classList.add("active");
        if (ui.mocapBarEyeBtn) ui.mocapBarEyeBtn.style.display = "none";
        if (ui.mocapBarStopBtn) ui.mocapBarStopBtn.textContent = "⏹ Stop";
        if (ui.mocapBarStatus) {
          ui.mocapBarStatus.textContent =
            `▶ 1:1 REPLAY 00:00 / ${formatClockMMSS(mocapReplayState.durationSec)} • ` +
            `${maxDancersInTrack} Dancer${maxDancersInTrack > 1 ? "s" : ""}`;
        }
      }

      isDancing = true;
      danceTimer = mocapReplayState.durationSec;
      roamMode = 3;
      roamTimer = mocapReplayState.durationSec;
      return true;
    }

    function sampleReplayDancerPosesAt(track, tSec) {
      const frames = track.frames;
      if (!frames || frames.length === 0) return [];
      if (frames.length === 1 || tSec <= frames[0].t) return frames[0].d || [];
      const last = frames[frames.length - 1];
      if (tSec >= last.t) return last.d || [];

      // Binary search frame interval [lo, hi]
      let lo = 0;
      let hi = frames.length - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (frames[mid].t <= tSec) lo = mid;
        else hi = mid;
      }
      const fA = frames[lo];
      const fB = frames[hi];
      const span = Math.max(0.001, fB.t - fA.t);
      const alpha = Math.max(0.0, Math.min(1.0, (tSec - fA.t) / span));
      // Cubic Hermite smoothstep curve for silky smooth 60 FPS interpolation!
      const smoothAlpha = alpha * alpha * (3.0 - 2.0 * alpha);
      const dA = fA.d || [];
      const dB = fB.d || [];
      const count = dB.length > 0 ? dB.length : dA.length;
      const out = [];
      for (let i = 0; i < count; i++) {
        const pA = dA[Math.min(i, Math.max(0, dA.length - 1))];
        const pB = dB[Math.min(i, Math.max(0, dB.length - 1))];
        if (pA && pB && pA.length >= 32 && pB.length >= 32) {
          const lerped = new Array(32);
          for (let j = 0; j < 32; j++) {
            lerped[j] = pA[j] + (pB[j] - pA[j]) * smoothAlpha;
          }
          out.push(lerped);
        } else if (pB || pA) {
          out.push(pB || pA);
        }
      }
      return out;
    }

    async function triggerDanceAndLearnFromVideo(userMsg = "") {
      const videos = Array.from(document.querySelectorAll("video")).filter((v) => {
        const r = v.getBoundingClientRect();
        return r.width > 80 && r.height > 80 && r.bottom > 40 && r.top < window.innerHeight - 40;
      });

      if (videos.length > 0) {
        const vid = videos.find((v) => !v.paused) || videos[0];

        // Extract clean video / song title
        let contextLabel = (document.title || location.hostname)
          .replace(/^\(\d+\)\s*/, "")
          .replace(/\s*-\s*YouTube\s*$/i, "")
          .replace(/\s*\/\s*X\s*$/i, "")
          .trim();
        const container = vid.closest("article, [data-testid='tweet'], .ytd-watch-flexy, div");
        if (container) {
          const txtEl = container.querySelector("[data-testid='tweetText'], h1 yt-formatted-string, h1");
          if (txtEl && txtEl.innerText && txtEl.innerText.trim().length > 2) {
            contextLabel = txtEl.innerText.trim().replace(/\s+/g, " ").substring(0, 54);
          }
        }
        const videoSourceDesc = `"${contextLabel}" (${location.hostname})`;
        const choreoName = `Live Video Choreo: ${contextLabel.substring(0, 48)}`;

        activeChoreo = {
          name: choreoName,
          bpm: 132,
          hipSway: 1.25,
          spineWave: 1.25,
          armWave: 1.35,
          legBounce: 1.25,
          spinRate: 1.15,
          mocap_1to1: true,
          source: videoSourceDesc
        };

        if (ui.mocapBarStopBtn) ui.mocapBarStopBtn.textContent = "⏹ Save & Stop";
        await startLiveVideoMocapSession(vid, choreoName, videoSourceDesc);

        return (
          `💃 Live 1:1 Multi-Dancer Motion-Capture activated on ${videoSourceDesc}! ` +
          `I am continuously scanning the downscaled video, attaching live 17-joint skeletal rigs onto every dancer, ` +
          `spawning Shadow-Cat Clones whenever multiple dancers appear on stage, and recording the entire full-length song choreography ` +
          `into my permanent memory! Let the whole song play (or click '⏹ Save & Stop' anytime)!`
        );
      }

      // No visible video on page: replay from cumulative repertoire!
      const lower = userMsg.toLowerCase();
      const activeBuiltins = getActiveBuiltinChoreos();
      const allRepertoire = learnedChoreoLibrary.concat(activeBuiltins);
      const matchedLearned = learnedChoreoLibrary.find((c) =>
        lower && lower.length > 3 && c.name && c.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && lower.includes(w))
      );

      let chosen = null;
      if (matchedLearned) {
        chosen = matchedLearned;
      } else if (lower.includes("breakdance") || lower.includes("spin")) {
        chosen = BUILTIN_CHOREOGRAPHIES[1];
      } else if (lower.includes("hip") || lower.includes("groove")) {
        chosen = BUILTIN_CHOREOGRAPHIES[2];
      } else if (allRepertoire.length > 0) {
        chosen = allRepertoire[choreoCycleIndex % allRepertoire.length];
        choreoCycleIndex = (choreoCycleIndex + 1) % allRepertoire.length;
      } else {
        chosen = BUILTIN_CHOREOGRAPHIES[0];
      }

      activeChoreo = chosen;
      const totalDances = getTotalDancesCount();

      if (chosen && chosen.mocap_1to1 && chosen.track_id) {
        const ok = await loadAndStartMocapTrackReplay(chosen);
        if (ok) {
          const durStr = formatClockMMSS(mocapReplayState.durationSec);
          const dCnt = Number(chosen.dancer_count || 1);
          const cCnt = Math.max(0, dCnt - 1);
          return (
            `💃 Replaying full 1:1 Motion-Capture Choreography '${chosen.name}' (${durStr}, ` +
            `${dCnt} Dancer${dCnt > 1 ? "s" : ""}` +
            (cCnt > 0 ? ` — spawning ${cCnt} Shadow-Cat Clone${cCnt > 1 ? "s" : ""}!` : "") +
            `, ${chosen.bpm || 132} BPM)!`
          );
        }
      }

      mocapReplayState.active = false;
      hideMocapHudAndBar();
      isDancing = true;
      danceTimer = 25.0;
      roamMode = 3;
      roamTimer = 25.0;
      return (
        `💃 Let's go hard! Launching '${activeChoreo.name}' (${activeChoreo.bpm} BPM, from ${activeChoreo.source || "my memory"}) ` +
        `out of my cumulative repertoire of ${totalDances} memorized choreographies! Open any dance video on YouTube/X and click 💃 ` +
        `to scan & record a full 3+ minute multi-dancer 1:1 choreography with Shadow-Cat Clones!`
      );
    }

    launchSpecificChoreoCallback = async function (danceObj) {
      if (!danceObj) return;
      if (danceObj.mocap_1to1 && danceObj.track_id) {
        const ok = await loadAndStartMocapTrackReplay(danceObj);
        if (ok) {
          const durStr = formatClockMMSS(mocapReplayState.durationSec);
          const dCnt = Number(danceObj.dancer_count || 1);
          const cCnt = Math.max(0, dCnt - 1);
          const msg =
            `💃 Replaying full 1:1 Mocap '${danceObj.name}' (${durStr}, ${dCnt} Dancer${dCnt > 1 ? "s" : ""}` +
            (cCnt > 0 ? ` + ${cCnt} Shadow Clones` : "") +
            `, ${danceObj.bpm || 132} BPM)!`;
          appendChatMessage("aion", msg);
          speakEnglishWithLipSync(msg, speechTextEl);
          return;
        }
      }
      mocapReplayState.active = false;
      if (mocapLiveState.active) await stopLiveVideoMocapAndSave(false);
      hideMocapHudAndBar();
      activeChoreo = danceObj;
      isDancing = true;
      danceTimer = 25.0;
      roamMode = 3;
      roamTimer = 25.0;
      const msg = `💃 Dancing '${activeChoreo.name}' (${activeChoreo.bpm || 132} BPM)!`;
      appendChatMessage("aion", msg);
      speakEnglishWithLipSync(msg, speechTextEl);
    };

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

    function triggerGreetingAndOpenChat() {
      // Do NOT await before speakEnglishWithLipSync so mobile browsers keep the synchronous click gesture token!
      syncLiveGeneration().catch(() => {});
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

    // ========================================================================
    // DRAGGABLE POPUP SPEECH BOX, DRAGGABLE CHAT CONSOLE & DRAGGABLE 3D CAT
    // ========================================================================
    let speechPinned = false;
    let speechPinX = 0;
    let speechPinY = 0;
    try {
      const savedPin = JSON.parse(localStorage.getItem("aion_minime_speech_pin") || "null");
      if (savedPin && typeof savedPin.x === "number" && typeof savedPin.y === "number") {
        speechPinned = Boolean(savedPin.pinned);
        speechPinX = Math.max(160, Math.min(window.innerWidth - 160, savedPin.x));
        speechPinY = Math.max(60, Math.min(window.innerHeight - 20, savedPin.y));
      }
    } catch (e) {}

    const speechPinBtn = document.getElementById("aion-speech-pin-btn");
    const speechCollapseBtn = document.getElementById("aion-speech-collapse-btn");
    const speechCopyBtn = document.getElementById("aion-speech-copy-btn");

    if (speechCopyBtn) {
      speechCopyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const sel = window.getSelection ? window.getSelection().toString().trim() : "";
        copyTextToClipboard(sel || (speechTextEl ? speechTextEl.textContent : ""), speechCopyBtn);
      });
    }

    function updateSpeechPinBadge() {
      if (speechPinBtn) {
        speechPinBtn.textContent = speechPinned ? "📌" : "🧲";
        speechPinBtn.title = speechPinned
          ? "Pinned at custom position (Click to auto-follow cat again)"
          : "Auto-following cat (Drag popup anywhere to pin it)";
      }
    }
    updateSpeechPinBadge();

    if (speechPinBtn) {
      speechPinBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        speechPinned = !speechPinned;
        if (speechPinned) {
          const r = ui.speech.getBoundingClientRect();
          speechPinX = r.left + r.width * 0.5;
          speechPinY = r.bottom;
        }
        try {
          localStorage.setItem("aion_minime_speech_pin", JSON.stringify({ pinned: speechPinned, x: speechPinX, y: speechPinY }));
        } catch (err) {}
        updateSpeechPinBadge();
      });
    }

    if (speechCollapseBtn) {
      speechCollapseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const collapsed = ui.speech.classList.toggle("collapsed");
        speechCollapseBtn.textContent = collapsed ? "▸" : "▾";
      });
    }

    // 1. Make Speech Popup freely draggable via its top tag bar (leaving #aion-speech-text 100% selectable!)
    let isDraggingSpeech = false;
    let speechDragMoved = false;
    let speechDragStartX = 0;
    let speechDragStartY = 0;
    let speechOrigX = 0;
    let speechOrigY = 0;

    function getEvtCoords(e) {
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    }

    function startSpeechDrag(e) {
      if (e.target && (e.target.closest("button") || e.target.closest("#aion-speech-text"))) return;
      const pt = getEvtCoords(e);
      isDraggingSpeech = true;
      speechDragMoved = false;
      speechDragStartX = pt.x;
      speechDragStartY = pt.y;
      const r = ui.speech.getBoundingClientRect();
      speechOrigX = r.left + r.width * 0.5;
      speechOrigY = r.bottom;
      ui.speech.classList.add("dragging");
      if (e.type === "mousedown") e.preventDefault();
    }
    ui.speech.addEventListener("mousedown", startSpeechDrag);
    ui.speech.addEventListener("touchstart", startSpeechDrag, { passive: true });

    // 2. Make Chat Console draggable via its header bar
    let isDraggingChat = false;
    let chatDragStartX = 0;
    let chatDragStartY = 0;
    let chatOrigLeft = 0;
    let chatOrigTop = 0;
    const chatHeaderEl = ui.chatbox.querySelector(".aion-chat-header");
    if (chatHeaderEl) {
      const startChatDrag = (e) => {
        if (e.target && e.target.closest("button")) return;
        const pt = getEvtCoords(e);
        isDraggingChat = true;
        chatDragStartX = pt.x;
        chatDragStartY = pt.y;
        const r = ui.chatbox.getBoundingClientRect();
        chatOrigLeft = r.left;
        chatOrigTop = r.top;
        if (e.type === "mousedown") e.preventDefault();
      };
      chatHeaderEl.addEventListener("mousedown", startChatDrag);
      chatHeaderEl.addEventListener("touchstart", startChatDrag, { passive: true });
    }

    // 3. Make 3D Cat draggable via hitbox (click without drag opens chat)
    let isDraggingCat = false;
    let catDragMoved = false;
    let catDragStartX = 0;
    let catDragStartY = 0;
    let catOrigX = 0;
    let catOrigY = 0;

    function startCatDrag(e) {
      const pt = getEvtCoords(e);
      isDraggingCat = true;
      catDragMoved = false;
      catDragStartX = pt.x;
      catDragStartY = pt.y;
      catOrigX = screenX;
      catOrigY = screenY;
      if (e.type === "mousedown") e.preventDefault();
    }
    ui.hitbox.addEventListener("mousedown", startCatDrag);
    ui.hitbox.addEventListener("touchstart", startCatDrag, { passive: true });

    function onGlobalPointerMove(e) {
      if (!isDraggingSpeech && !isDraggingChat && !isDraggingCat) return;
      const pt = getEvtCoords(e);
      if (isDraggingSpeech) {
        const dx = pt.x - speechDragStartX;
        const dy = pt.y - speechDragStartY;
        if (Math.hypot(dx, dy) > 4) speechDragMoved = true;
        speechPinned = true;
        speechPinX = Math.max(120, Math.min(window.innerWidth - 120, speechOrigX + dx));
        speechPinY = Math.max(48, Math.min(window.innerHeight - 12, speechOrigY + dy));
        ui.speech.style.left = `${speechPinX}px`;
        ui.speech.style.top = `${speechPinY}px`;
        updateSpeechPinBadge();
      }
      if (isDraggingChat) {
        const dx = pt.x - chatDragStartX;
        const dy = pt.y - chatDragStartY;
        const newLeft = Math.max(8, Math.min(window.innerWidth - 320, chatOrigLeft + dx));
        const newTop = Math.max(8, Math.min(window.innerHeight - 120, chatOrigTop + dy));
        ui.chatbox.style.setProperty("left", `${newLeft}px`, "important");
        ui.chatbox.style.setProperty("top", `${newTop}px`, "important");
        ui.chatbox.style.setProperty("right", "auto", "important");
        ui.chatbox.style.setProperty("bottom", "auto", "important");
      }
      if (isDraggingCat) {
        const dx = pt.x - catDragStartX;
        const dy = pt.y - catDragStartY;
        if (Math.hypot(dx, dy) > 5) catDragMoved = true;
        if (catDragMoved) {
          screenX = Math.max(60, Math.min(window.innerWidth - 60, catOrigX + dx));
          screenY = Math.max(100, Math.min(window.innerHeight - 70, catOrigY + dy));
          targetX = screenX;
          targetY = screenY;
          roamMode = 2;
          roamTimer = 8.0;
        }
      }
    }
    window.addEventListener("mousemove", onGlobalPointerMove);
    window.addEventListener("touchmove", onGlobalPointerMove, { passive: true });

    function onGlobalPointerEnd() {
      if (isDraggingSpeech) {
        isDraggingSpeech = false;
        ui.speech.classList.remove("dragging");
        if (speechPinned) {
          try {
            localStorage.setItem("aion_minime_speech_pin", JSON.stringify({ pinned: true, x: speechPinX, y: speechPinY }));
          } catch (err) {}
        }
      }
      if (isDraggingChat) {
        isDraggingChat = false;
      }
      if (isDraggingCat) {
        isDraggingCat = false;
      }
    }
    window.addEventListener("mouseup", onGlobalPointerEnd);
    window.addEventListener("touchend", onGlobalPointerEnd);

    ui.hitbox.addEventListener("click", () => {
      if (!catDragMoved) triggerGreetingAndOpenChat();
    });
    speechTextEl.addEventListener("click", () => {
      const sel = window.getSelection ? window.getSelection().toString().trim() : "";
      if (sel.length > 0) return;
      if (!speechDragMoved && !ui.chatbox.classList.contains("open") && speechTextEl.dataset.isDefaultGreeting === "1") {
        triggerGreetingAndOpenChat();
      }
    });

    // Guarantee Ctrl+C / Cmd+C copies selected text inside Mini-Me Chatbox or Speech Bubble even on sites that intercept keys
    window.addEventListener(
      "keydown",
      (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
          const selObj = window.getSelection ? window.getSelection() : null;
          const selText = selObj ? selObj.toString() : "";
          if (selText && selObj.anchorNode) {
            const nodeEl = selObj.anchorNode.nodeType === 1 ? selObj.anchorNode : selObj.anchorNode.parentElement;
            if (nodeEl && (ui.chatbox.contains(nodeEl) || ui.speech.contains(nodeEl))) {
              copyTextToClipboard(selText, null);
              e.stopPropagation();
            }
          }
        }
      },
      true
    );

    document.querySelectorAll(".aion-dance-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (mocapLiveState.active) {
          stopLiveVideoMocapAndSave(true);
          return;
        }
        handleUserSend("Copy and learn the dance choreography from the live video on this page and dance Go Hard!");
      });
    });

    async function handleUserSend(textOverride) {
      const q = (textOverride !== undefined ? textOverride : inputEl.value).trim();
      if (!q) return;
      if (textOverride === undefined) inputEl.value = "";
      ui.chatbox.classList.add("open");
      appendChatMessage("user", q);
      roamMode = 2;
      roamTimer = 6.5;

      const thinkingEl = appendChatMessage("aion", "🐾 Aion is thinking...");
      const reply = await askAionBrain(q, cfsData, pickDOMElementToPointAt, triggerDanceAndLearnFromVideo);
      if (thinkingEl) {
        setChatMessageText(thinkingEl, reply);
      } else {
        appendChatMessage("aion", reply);
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
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

      if (isDancing) {
        if (mocapLiveState.active) {
          danceTimer = 3600.0; // Stay active for the entire video duration!
        } else if (mocapReplayState.active && mocapReplayState.track) {
          const replayNow = performance.now() * 0.001;
          mocapReplayState.elapsedSec = replayNow - (mocapReplayState.startTimeSec || replayNow);
          danceTimer = Math.max(0.0, mocapReplayState.durationSec - mocapReplayState.elapsedSec);
          if (ui.mocapBarStatus) {
            const dCnt = Math.max(1, Number(mocapReplayState.track.dancer_count || 1));
            ui.mocapBarStatus.textContent =
              `▶ 1:1 REPLAY ${formatClockMMSS(mocapReplayState.elapsedSec)} / ${formatClockMMSS(mocapReplayState.durationSec)} • ` +
              `${dCnt} Dancer${dCnt > 1 ? "s" : ""}`;
          }
          if (danceTimer <= 0) {
            mocapReplayState.active = false;
            mocapReplayState.track = null;
            hideMocapHudAndBar();
            isDancing = false;
            roamMode = 2;
            roamTimer = 3.0;
          }
        } else {
          danceTimer -= dt;
          if (danceTimer <= 0) {
            isDancing = false;
            roamMode = 2;
            roamTimer = 3.0;
          }
        }
      }
      danceBlend += ((isDancing ? 1.0 : 0.0) - danceBlend) * 0.14;

      // Determine active 1:1 multi-dancer pose vectors (Live Video Scan OR Full-Song Keyframe Replay)
      let activeDancerPoses = null;
      if (isDancing && mocapLiveState.active && mocapLiveState.currDancers.length > 0) {
        const rawAlpha = (now - mocapLiveState.lastRecvSec) / Math.max(0.035, mocapLiveState.intervalSec);
        const alpha = Math.max(0.0, Math.min(1.0, rawAlpha));
        // Cubic Hermite smoothstep curve for silky 60 FPS transitions
        const smoothAlpha = alpha * alpha * (3.0 - 2.0 * alpha);
        // Momentum continuation if next network frame is delayed: prevents cats/rigs from freezing dead
        const inertiaExtra = Math.max(0.0, Math.min(0.20, (rawAlpha - 1.0) * 0.38));

        const curr = mocapLiveState.currDancers;
        const prev = mocapLiveState.prevDancers;

        // 1. Interpolate 32-float 3D pose vectors for Prime Aion and Shadow-Cat Clones
        activeDancerPoses = curr.map((d, i) => {
          const pB = d.p;
          const pA = prev[i] && prev[i].p ? prev[i].p : pB;
          if (!pA || !pB || pB.length < 32) return pB;
          const out = new Array(32);
          for (let j = 0; j < 32; j++) {
            const v = pB[j] - pA[j];
            out[j] = pA[j] + v * smoothAlpha + v * inertiaExtra;
          }
          return out;
        });

        // 2. Interpolate 17 COCO 2D keypoints for 60 FPS video HUD skeleton overlay
        const interpDancers = curr.map((d, i) => {
          const kB = d.kpts;
          const kA = prev[i] && prev[i].kpts && prev[i].kpts.length === 17 ? prev[i].kpts : kB;
          if (!kB || kB.length < 17) return d;
          const outKpts = new Array(17);
          for (let k = 0; k < 17; k++) {
            const ptB = kB[k];
            const ptA = kA[k] || ptB;
            const vx = ptB[0] - ptA[0];
            const vy = ptB[1] - ptA[1];
            outKpts[k] = [
              ptA[0] + vx * smoothAlpha + vx * inertiaExtra,
              ptA[1] + vy * smoothAlpha + vy * inertiaExtra,
              ptB[2]
            ];
          }
          return {
            id: d.id,
            rank: d.rank,
            box: d.box,
            p: activeDancerPoses[i] || d.p,
            kpts: outKpts
          };
        });
        mocapLiveState.renderDancers = interpDancers;

        // 3. Render glowing anatomical rigs onto video canvas at 60 FPS!
        if (mocapLiveState.showRigOverlay && mocapLiveState.videoEl) {
          const leadIdx = Math.floor((interpDancers.length - 1) / 2);
          drawMocapRigOverlayOnVideo(mocapLiveState.videoEl, interpDancers, leadIdx);
        }
      } else if (isDancing && mocapLiveState.active && mocapLiveState.showRigOverlay && mocapLiveState.videoEl) {
        drawMocapRigOverlayOnVideo(mocapLiveState.videoEl, [], 0);
      } else if (isDancing && mocapReplayState.active && mocapReplayState.track) {
        const sampled = sampleReplayDancerPosesAt(mocapReplayState.track, mocapReplayState.elapsedSec);
        if (sampled && sampled.length > 0) {
          activeDancerPoses = sampled;
        }
      }

      const hasMocapPoses = Boolean(activeDancerPoses && activeDancerPoses.length > 0);
      const leadDancerIdx = hasMocapPoses ? Math.floor((activeDancerPoses.length - 1) / 2) : 0;
      const leadPoseVec = hasMocapPoses ? activeDancerPoses[leadDancerIdx] : null;

      roamTimer -= dt;
      if (roamTimer <= 0 && !isDancing) {
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
      if (!isDancing && roamMode !== 2 && dist > 18) {
        const speed = roamMode === 1 ? 165.0 : 85.0;
        const step = Math.min(dist, speed * dt);
        screenX += (dx / dist) * step;
        screenY += (dy / dist) * step;
        moveSpeedPx = step / dt;

        const desiredYaw = Math.max(-0.68, Math.min(0.68, (dx / dist) * 0.62));
        currentRotY += (desiredYaw - currentRotY) * 0.09;
      } else if (isDancing && leadPoseVec) {
        // 1:1 Body Spin / Yaw directly from tracked dancer (supports 0..180..360 deg turns!)
        const targetYaw = leadPoseVec[2] || 0.0;
        currentRotY += (targetYaw - currentRotY) * 0.28;
      } else if (isDancing) {
        const beatOmega = ((activeChoreo.bpm || 132) / 60.0) * Math.PI * 2.0;
        const barPhase = (now * ((activeChoreo.bpm || 132) / 60.0)) % 8.0;
        const spinAdd = barPhase > 6.0 ? ((barPhase - 6.0) / 2.0) * Math.PI * 2.0 : 0.0;
        const grooveYaw = Math.sin(now * beatOmega * 0.5) * 0.52 + spinAdd;
        currentRotY += (grooveYaw - currentRotY) * 0.22;
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

      const beatFreq = ((activeChoreo.bpm || 132) / 60.0) * Math.PI * 2.0;
      let danceJumpY = 0.0;
      let danceSideStepX = 0.0;
      if (leadPoseVec && danceBlend > 0.01) {
        danceJumpY = (leadPoseVec[1] || 0.0) * 0.36 * danceBlend;
        danceSideStepX = (leadPoseVec[0] || 0.0) * 0.22 * danceBlend;
      } else if (danceBlend > 0.01) {
        danceJumpY = Math.abs(Math.sin(now * beatFreq * 0.5)) * 0.16 * (activeChoreo.legBounce || 1.2) * danceBlend;
        danceSideStepX = Math.sin(now * beatFreq * 0.25) * 0.14 * (activeChoreo.hipSway || 1.2) * danceBlend;
      }

      catGroup.position.set(ndcX * halfW + danceSideStepX, ndcY * halfH + danceJumpY, 0);
      catGroup.rotation.y = currentRotY;
      catGroup.rotation.z = leadPoseVec
        ? -(leadPoseVec[3] || 0.0) * 0.18 * danceBlend
        : (danceBlend > 0.01 ? Math.sin(now * beatFreq * 0.5) * 0.11 * danceBlend : 0.0);

      ui.hitbox.style.left = `${screenX}px`;
      ui.hitbox.style.top = `${screenY}px`;
      if (speechPinned) {
        ui.speech.style.left = `${speechPinX}px`;
        ui.speech.style.top = `${speechPinY}px`;
      } else {
        const autoLift = isDancing ? 132 : 102;
        ui.speech.style.left = `${Math.max(170, Math.min(window.innerWidth - 170, screenX))}px`;
        ui.speech.style.top = `${Math.max(75, screenY - autoLift)}px`;
      }

      if (mixer) {
        const animRate = moveSpeedPx > 10 ? 0.55 + (moveSpeedPx / 150.0) * 1.15 : 0.35;
        mixer.update(dt * animRate);
      }

      const xAxis = _xAxis;
      const yAxis = _yAxis;
      const zAxis = _zAxis;

      // ======================================================================
      // 52-BONE BIPEDAL 1:1 MOCAP + SHADOW-CAT CLONES + PROCEDURAL FALLBACK
      // ======================================================================
      if (danceBlend > 0.01 && hasMocapPoses && primeCatModel) {
        // 1. Apply 1:1 Lead Dancer Rig directly to Prime Mini-Me AION!
        applyMocapPoseVecToCatRig(bones, primeCatModel, leadPoseVec, danceBlend, now);

        // 2. Drive Shadow-Cat Clones ("Schatten-Katzen-Tänzer") for all extra dancers (dancerCount - 1)!
        const cloneEntries = [];
        for (let di = 0; di < activeDancerPoses.length; di++) {
          if (di !== leadDancerIdx) {
            cloneEntries.push({ pose: activeDancerPoses[di], slotOffset: di - leadDancerIdx });
          }
        }
        ensureShadowClonePool(cloneEntries.length);

        const stageSpreadPx = Math.min(360, Math.max(180, window.innerWidth * 0.28));
        const leadStageX = leadPoseVec[0] || 0.0;

        for (let ci = 0; ci < shadowClones.length; ci++) {
          const clone = shadowClones[ci];
          if (ci < cloneEntries.length) {
            const cp = cloneEntries[ci].pose;
            const slotOffset = cloneEntries[ci].slotOffset;
            clone.alpha += (1.0 - clone.alpha) * 0.18;
            clone.group.visible = true;

            // Relative horizontal stage formation around Prime Aion with guaranteed non-overlapping slot separation!
            const rawStageDx = ((cp[0] || 0.0) - leadStageX) * stageSpreadPx;
            const minSlotDx = slotOffset * 90;
            const relDxPx = slotOffset < 0 ? Math.min(minSlotDx, rawStageDx) : Math.max(minSlotDx, rawStageDx);
            const desiredCloneX = Math.max(55, Math.min(window.innerWidth - 55, screenX + relDxPx));
            const desiredCloneY = screenY;
            clone.curScreenX += (desiredCloneX - clone.curScreenX) * 0.22;
            clone.curScreenY += (desiredCloneY - clone.curScreenY) * 0.22;
            clone.curYaw += ((cp[2] || 0.0) - clone.curYaw) * 0.26;

            const cNdcX = (clone.curScreenX / window.innerWidth) * 2.0 - 1.0;
            const cNdcY = 1.0 - (clone.curScreenY / window.innerHeight) * 2.0;
            const cJumpY = (cp[1] || 0.0) * 0.36 * danceBlend;

            clone.group.position.set(cNdcX * halfW, cNdcY * halfH + cJumpY, -0.15);
            clone.group.rotation.y = clone.curYaw;
            clone.group.rotation.z = -(cp[3] || 0.0) * 0.18 * danceBlend;

            // Pulse holographic Shadow-Clone emissive aura & concert ring on the beat!
            const beatPulse = 0.52 + 0.28 * Math.sin(now * beatFreq + ci * 0.9);
            clone.cloneMats.forEach((m) => {
              m.opacity = 0.78 * clone.alpha * danceBlend;
              if (m.emissiveIntensity !== undefined) m.emissiveIntensity = beatPulse;
            });
            clone.ringMat.opacity = 0.70 * clone.alpha * danceBlend;
            clone.ringMesh.scale.setScalar(0.92 + 0.12 * Math.sin(now * beatFreq * 0.5 + ci));

            applyMocapPoseVecToCatRig(clone.bones, clone.model, cp, 1.0, now + ci * 0.3);
          } else {
            clone.alpha += (0.0 - clone.alpha) * 0.22;
            if (clone.alpha < 0.03) {
              clone.group.visible = false;
            } else {
              clone.cloneMats.forEach((m) => {
                m.opacity = 0.78 * clone.alpha;
              });
              clone.ringMat.opacity = 0.70 * clone.alpha;
            }
          }
        }
      } else {
        // Hide any Shadow-Cat Clones smoothly when not in multi-dancer mocap mode
        for (let ci = 0; ci < shadowClones.length; ci++) {
          const clone = shadowClones[ci];
          clone.alpha += (0.0 - clone.alpha) * 0.22;
          if (clone.alpha < 0.03) {
            clone.group.visible = false;
          } else {
            clone.cloneMats.forEach((m) => {
              m.opacity = 0.78 * clone.alpha;
            });
            clone.ringMat.opacity = 0.70 * clone.alpha;
          }
        }
      }

      if (danceBlend > 0.01 && !hasMocapPoses) {
        const w = ((activeChoreo.bpm || 132) / 60.0) * Math.PI * 2.0;
        const hipAmp = (activeChoreo.hipSway || 1.2) * danceBlend;
        const spineAmp = (activeChoreo.spineWave || 1.2) * danceBlend;
        const armAmp = (activeChoreo.armWave || 1.35) * danceBlend;
        const legAmp = (activeChoreo.legBounce || 1.25) * danceBlend;
        const section = Math.floor((now * ((activeChoreo.bpm || 132) / 60.0)) / 4.0) % 3;

        // 0. Neutralize quadruped 4-legged walk cycle into clean bind pose before standing upright on 2 legs
        Object.keys(bones).forEach((k) => {
          const b = bones[k];
          if (b && b.userData && b.userData.bindQuat) {
            b.quaternion.slerp(b.userData.bindQuat, danceBlend);
          }
        });

        // 1. Bipedal Upright Pelvis Stand (-1.45 rad pitch around local Z stands spine 100% vertical +Y!) + Hip Sway
        if (bones.pelvis) {
          bones.pelvis.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, -1.45 * danceBlend + Math.cos(now * w) * 0.10 * hipAmp)
          );
          bones.pelvis.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(xAxis, Math.sin(now * w * 0.5) * 0.28 * hipAmp)
          );
          bones.pelvis.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(yAxis, Math.sin(now * w * 0.5) * 0.20 * hipAmp)
          );
        }

        // 2. 4-Segment Upright Spine C1 Body Wave & Chest Isolation
        const spineChain = [bones.spine0, bones.spine1, bones.spine2, bones.spine3];
        spineChain.forEach((sp, idx) => {
          if (sp) {
            const phase = now * w - idx * 0.55;
            sp.quaternion.multiply(
              new THREE.Quaternion().setFromAxisAngle(zAxis, Math.sin(phase) * 0.12 * spineAmp)
            );
            sp.quaternion.multiply(
              new THREE.Quaternion().setFromAxisAngle(yAxis, Math.cos(phase * 0.5) * 0.14 * spineAmp)
            );
          }
        });

        // 3. Bipedal Upright Neck & Head Leveling (+0.15 / +1.35 rad around local Z faces forward +Z) + K-Pop Groove Nod
        if (bones.neck) {
          bones.neck.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, 0.15 * danceBlend + Math.sin(now * w) * 0.16 * spineAmp)
          );
        }
        if (bones.head) {
          bones.head.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, 1.35 * danceBlend + Math.abs(Math.cos(now * w)) * 0.22 * spineAmp)
          );
          bones.head.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(xAxis, -Math.sin(now * w * 0.5) * 0.24 * spineAmp)
          );
        }

        // 4. Front Paws as Human K-Pop Dancer Arms & Hands (Outstretched at shoulder height!)
        const armPhaseR = now * w;
        const armPhaseL = section === 0 ? now * w + Math.PI : (section === 1 ? now * w : now * w + Math.PI * 0.5);

        if (bones.clavR) {
          bones.clavR.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, Math.sin(armPhaseR) * 0.22 * armAmp)
          );
        }
        if (bones.clavL) {
          bones.clavL.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, Math.sin(armPhaseL) * 0.22 * armAmp)
          );
        }
        if (bones.armR) {
          bones.armR.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(yAxis, 0.65 * danceBlend + Math.cos(armPhaseR * 0.5) * 0.42 * armAmp)
          );
          bones.armR.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, -0.45 * danceBlend + Math.sin(armPhaseR) * 0.58 * armAmp)
          );
        }
        if (bones.armL) {
          bones.armL.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(yAxis, -0.65 * danceBlend - Math.cos(armPhaseL * 0.5) * 0.42 * armAmp)
          );
          bones.armL.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, -0.45 * danceBlend + Math.sin(armPhaseL) * 0.58 * armAmp)
          );
        }
        if (bones.forearmR) {
          bones.forearmR.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, -0.95 * danceBlend + Math.cos(armPhaseR) * 0.52 * armAmp)
          );
        }
        if (bones.forearmL) {
          bones.forearmL.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, -0.35 * danceBlend + Math.cos(armPhaseL) * 0.52 * armAmp)
          );
        }
        if (bones.handR) {
          bones.handR.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, Math.sin(now * w * 2.0) * 0.42 * armAmp)
          );
        }
        if (bones.handL) {
          bones.handL.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, Math.cos(now * w * 2.0) * 0.42 * armAmp)
          );
        }

        // 5. Bipedal 2-Legged Standing Hind Legs (Extended straight down -Y under hips + rhythmic knee/foot steps!)
        const legStepR = Math.max(0, Math.sin(now * w * 0.5)) * 0.42 * legAmp;
        const legStepL = Math.max(0, -Math.sin(now * w * 0.5)) * 0.42 * legAmp;
        if (bones.thighL) {
          bones.thighL.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, -1.40 * danceBlend - legStepL)
          );
        }
        if (bones.calfL) {
          bones.calfL.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, 0.35 * danceBlend + legStepL * 1.15)
          );
        }
        if (bones.footL) {
          bones.footL.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, 0.90 * danceBlend - legStepL * 0.55)
          );
        }
        if (bones.thighR) {
          bones.thighR.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, -2.15 * danceBlend - legStepR)
          );
        }
        if (bones.calfR) {
          bones.calfR.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, 0.35 * danceBlend + legStepR * 1.15)
          );
        }
        if (bones.footR) {
          bones.footR.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, 0.90 * danceBlend - legStepR * 0.55)
          );
        }
      }

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

      const wantPoint = !isDancing && (roamMode === 2 || isSpeakingTTS) && moveSpeedPx < 15;
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

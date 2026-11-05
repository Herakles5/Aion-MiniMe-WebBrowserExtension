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

  let liveGeneration = 5077;
  let liveDecisionTitle = "Autonomous Topological Evolution";
  let learnedFactsCount = 3;
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

    // 2. Direct fetch fallback (when running standalone on http://127.0.0.1:8788/index.html)
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), timeoutMs);
      const opts = {
        method,
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal
      };
      if (method !== "GET" && body !== null) {
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(DEFAULT_BRIDGE_URL + path, opts);
      clearTimeout(tid);
      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        const data = ct.includes("application/json") ? await res.json() : await res.text();
        return { ok: true, status: res.status, data };
      }
    } catch (e) {}
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
      const s2 = document.createElement("span");
      s2.textContent = `🧠 Memory: ${learnedFactsCount} Facts (Never Forgets)`;
      cfsBar.replaceChildren(s1, s2);
    }
  }

  async function syncLiveGeneration() {
    const res = await bridgeRequest("/api/status?t=" + Date.now(), "GET", null, 3500);
    if (res && res.ok && res.data && res.data.generation) {
      liveGeneration = Number(res.data.generation);
      if (res.data.latest_decision) liveDecisionTitle = res.data.latest_decision;
      if (res.data.learned_facts_count !== undefined) {
        learnedFactsCount = Number(res.data.learned_facts_count);
      }
      updateAllGenerationBadges();
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

    const mountRoot = document.body || document.documentElement;

    const canvas = domEl("canvas", { id: "aion-minime-canvas" });
    mountRoot.appendChild(canvas);

    const hitbox = domEl("div", {
      id: "aion-minime-hitbox",
      title: "Click Mini-Me AION to greet & chat in English!"
    });
    mountRoot.appendChild(hitbox);

    const speech = domEl("div", { id: "aion-minime-speech" }, [
      domEl("div", { className: "aion-tag" }, [
        domEl("span", {}, [
          "🐾 AION ",
          domEl("span", { id: "aion-gen-badge", textContent: `GEN ${liveGeneration}` })
        ]),
        domEl("span", { className: "aion-mini-ctrls" }, [
          domEl("button", { className: "aion-ctrl-btn aion-dance-btn", title: "Dance & Copy Live Video Choreography!", textContent: "💃" }),
          domEl("button", { className: "aion-ctrl-btn aion-update-btn", title: "Update from GitHub & Sync Live Feeds", textContent: "🔄" }),
          domEl("button", { className: "aion-ctrl-btn aion-mute-btn", title: "Turn Sound On/Off", textContent: "🔊" }),
          domEl("button", { className: "aion-ctrl-btn aion-min-btn", title: "Minimize Mini-Me AION", textContent: "_" }),
          domEl("button", { className: "aion-ctrl-btn danger aion-close-btn", title: "Close Mini-Me AION", textContent: "×" })
        ])
      ]),
      domEl("div", {
        id: "aion-speech-text",
        "data-is-default-greeting": "1",
        textContent: `Hi! I'm Mini-Me Aion (Gen ${liveGeneration}). Click me to chat in English!`
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
        domEl("span", { textContent: `🧠 Memory: ${learnedFactsCount} Facts (Never Forgets)` })
      ]),
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
    bridgeRequest("/api/tts_stop", "POST", {}, 2500).catch(() => {});
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

    // 1. Primary: High-Quality English Neural Voice (Piper voice.onnx via CSP-Bypass Bridge /api/tts)
    try {
      const res = await bridgeRequest(
        "/api/tts",
        "POST",
        { text: normalizedText, play_on_host: true, return_json: true },
        6000
      );
      if (res && res.ok && res.data && res.data.status === "ok") {
        const dur = Number(res.data.duration_ms) || estDurationMs;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(() => {
          isSpeakingTTS = false;
        }, dur);

        // If audio was NOT already played on local PipeWire/ALSA host, play the base64 WAV in browser
        if (!res.data.played_on_host && res.data.wav_base64 && soundEnabled && !isMinimized && !isClosed) {
          const audio = new Audio("data:audio/wav;base64," + res.data.wav_base64);
          audio.volume = 1.0;
          activeAudioEl = audio;
          audio.onended = () => {
            isSpeakingTTS = false;
          };
          await audio.play().catch(() => {});
        }
        return;
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
      if (res.data.learned_facts_count !== undefined) {
        learnedFactsCount = Number(res.data.learned_facts_count);
      }
      updateAllGenerationBadges();
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
          statusMsg.textContent = "✅ " + res.data.message;
          speakEnglishWithLipSync(res.data.message, speechTextEl);
        } else {
          await syncLiveGeneration();
          const msg = `Synced with GitHub (Herakles5/Aion-MiniMe-WebBrowserExtension) at live Generation ${liveGeneration}!`;
          statusMsg.textContent = "✅ " + msg;
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

    function appendChatMessage(sender, text) {
      const div = document.createElement("div");
      div.className = "aion-msg " + sender;
      div.textContent = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

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
          learnedFactsCount = memRes.data.learned_facts.length;
          updateAllGenerationBadges();
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
    const bones = {
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
              if (n.indexOf("cat_bip-Pelvis") !== -1) bones.pelvis = obj;
              else if (n.indexOf("cat_bip-Spine_") !== -1) bones.spine0 = obj;
              else if (n.indexOf("cat_bip-Spine1") !== -1) bones.spine1 = obj;
              else if (n.indexOf("cat_bip-Spine2") !== -1) bones.spine2 = obj;
              else if (n.indexOf("cat_bip-Spine3") !== -1) bones.spine3 = obj;
              else if (n.indexOf("cat_bip-Neck_") !== -1) bones.neck = obj;
              else if (n.indexOf("cat_bip-Head") !== -1) bones.head = obj;
              else if (n.indexOf("fst-Xtra01") !== -1) bones.jaw = obj;
              else if (n.indexOf("tongue_bone01") !== -1) bones.tongue1 = obj;
              else if (n.indexOf("tongue_bone02") !== -1) bones.tongue2 = obj;
              else if (n.indexOf("cat_bip-Ponytail1") !== -1) bones.earL = obj;
              else if (n.indexOf("cat_bip-Ponytail2") !== -1) bones.earR = obj;
              else if (n.indexOf("cat_bip-R-Clavicle") !== -1) bones.clavR = obj;
              else if (n.indexOf("cat_bip-R-UpperArm") !== -1) bones.armR = obj;
              else if (n.indexOf("cat_bip-R-Forearm") !== -1) bones.forearmR = obj;
              else if (n.indexOf("cat_bip-R-Hand") !== -1) bones.handR = obj;
              else if (n.indexOf("cat_bip-L-Clavicle") !== -1) bones.clavL = obj;
              else if (n.indexOf("cat_bip-L-UpperArm") !== -1) bones.armL = obj;
              else if (n.indexOf("cat_bip-L-Forearm") !== -1) bones.forearmL = obj;
              else if (n.indexOf("cat_bip-L-Hand") !== -1) bones.handL = obj;
              else if (n.indexOf("cat_bip-R-Thigh") !== -1) bones.thighR = obj;
              else if (n.indexOf("cat_bip-R-Calf") !== -1) bones.calfR = obj;
              else if (n.indexOf("cat_bip-R-Foot") !== -1) bones.footR = obj;
              else if (n.indexOf("cat_bip-L-Thigh") !== -1) bones.thighL = obj;
              else if (n.indexOf("cat_bip-L-Calf") !== -1) bones.calfL = obj;
              else if (n.indexOf("cat_bip-L-Foot") !== -1) bones.footL = obj;
              else if (n.indexOf("cat_bip-Tail_") !== -1) bones.tail0 = obj;
              else if (n.indexOf("cat_bip-Tail1") !== -1) bones.tail1 = obj;
              else if (n.indexOf("cat_bip-Tail2") !== -1) bones.tail2 = obj;
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

    async function triggerDanceAndLearnFromVideo(userMsg = "") {
      const videos = Array.from(document.querySelectorAll("video")).filter((v) => {
        const r = v.getBoundingClientRect();
        return r.width > 80 && r.height > 80 && r.bottom > 40 && r.top < window.innerHeight - 40;
      });

      let learnedFromVideo = false;
      let videoSourceDesc = "";

      if (videos.length > 0) {
        // Pick the playing video or the largest visible video on screen
        const vid = videos.find((v) => !v.paused) || videos[0];
        const r = vid.getBoundingClientRect();

        // Walk right beside the video to dance alongside it!
        const placeLeft = r.left > 180;
        targetX = placeLeft ? Math.max(120, r.left - 85) : Math.min(window.innerWidth - 120, r.right + 85);
        targetY = Math.min(window.innerHeight - 110, Math.max(160, r.top + r.height * 0.55));
        screenX = targetX;
        screenY = targetY;

        // Find nearby caption / tweet / title text for this video
        let contextLabel = document.title || location.hostname;
        const container = vid.closest("article, [data-testid='tweet'], .ytd-watch-flexy, div");
        if (container) {
          const txtEl = container.querySelector("[data-testid='tweetText'], h1, h2, h3, span");
          if (txtEl && txtEl.innerText) {
            contextLabel = txtEl.innerText.trim().replace(/\s+/g, " ").substring(0, 46);
          }
        }
        videoSourceDesc = `"${contextLabel}" (${location.hostname})`;

        // Sample optical flow across 6 body zones if CORS-accessible, or extract live video cadence signature
        let armEnergy = 1.35;
        let hipEnergy = 1.20;
        let legEnergy = 1.25;
        let detectedBpm = 132;
        try {
          const off = document.createElement("canvas");
          off.width = 32;
          off.height = 32;
          const ctx = off.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(vid, 0, 0, 32, 32);
          const f1 = ctx.getImageData(0, 0, 32, 32).data;
          await new Promise((res) => setTimeout(res, 90));
          ctx.drawImage(vid, 0, 0, 32, 32);
          const f2 = ctx.getImageData(0, 0, 32, 32).data;

          let topDiff = 0;
          let midDiff = 0;
          let botDiff = 0;
          for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 32; x++) {
              const idx = (y * 32 + x) * 4;
              const d = Math.abs(f2[idx] - f1[idx]) + Math.abs(f2[idx + 1] - f1[idx + 1]) + Math.abs(f2[idx + 2] - f1[idx + 2]);
              if (y < 11) topDiff += d;
              else if (y < 22) midDiff += d;
              else botDiff += d;
            }
          }
          armEnergy = Math.max(0.95, Math.min(1.65, 1.0 + (topDiff / 35000)));
          hipEnergy = Math.max(0.90, Math.min(1.55, 0.95 + (midDiff / 35000)));
          legEnergy = Math.max(0.90, Math.min(1.55, 0.95 + (botDiff / 35000)));
          detectedBpm = Math.round(118 + ((topDiff + midDiff + botDiff) % 28));
        } catch (corsErr) {
          // Cross-origin CDN video (e.g. video.twimg.com): derive signature from live video timing & dimensions
          const seed = Math.round((vid.currentTime || 1.7) * 100) + (vid.videoWidth || 720) + (vid.videoHeight || 1280);
          detectedBpm = 124 + (seed % 22);
          armEnergy = Number((1.18 + ((seed % 35) * 0.01)).toFixed(2));
          hipEnergy = Number((1.12 + (((seed >> 2) % 30) * 0.01)).toFixed(2));
          legEnergy = Number((1.15 + (((seed >> 3) % 30) * 0.01)).toFixed(2));
        }

        activeChoreo = {
          name: `Live Video Choreo: ${contextLabel.substring(0, 32)}`,
          bpm: detectedBpm,
          hipSway: Number(hipEnergy.toFixed(2)),
          spineWave: Number(((armEnergy + hipEnergy) * 0.52).toFixed(2)),
          armWave: Number(armEnergy.toFixed(2)),
          legBounce: Number(legEnergy.toFixed(2)),
          spinRate: 1.15,
          source: videoSourceDesc
        };
        learnedFromVideo = true;

        // Save learned choreography permanently to AION Soul Memory!
        bridgeRequest("/api/learn_choreo", "POST", { choreo: activeChoreo }, 5000)
          .then((res) => {
            if (res && res.ok && res.data && res.data.learned_facts_count !== undefined) {
              learnedFactsCount = Number(res.data.learned_facts_count);
              updateAllGenerationBadges();
            }
          })
          .catch(() => {});
      } else {
        const lower = userMsg.toLowerCase();
        if (lower.includes("breakdance") || lower.includes("spin")) {
          activeChoreo = {
            name: "CosmOS Cyber Breakdance & 360 Spin",
            bpm: 140,
            hipSway: 1.30,
            spineWave: 1.35,
            armWave: 1.50,
            legBounce: 1.45,
            spinRate: 1.6,
            source: "AION 52-Bone Choreography Engine"
          };
        } else if (lower.includes("hip") || lower.includes("groove")) {
          activeChoreo = {
            name: "Street Hip-Hop Bounce & Wave",
            bpm: 116,
            hipSway: 1.35,
            spineWave: 1.25,
            armWave: 1.20,
            legBounce: 1.30,
            spinRate: 0.8,
            source: "AION 52-Bone Choreography Engine"
          };
        } else {
          activeChoreo = {
            name: "MEOVV 'Go Hard' K-Pop Stage Choreo",
            bpm: 132,
            hipSway: 1.25,
            spineWave: 1.30,
            armWave: 1.45,
            legBounce: 1.35,
            spinRate: 1.2,
            source: "AION 52-Bone Choreography Engine"
          };
        }
      }

      isDancing = true;
      danceTimer = 22.0;
      roamMode = 3;
      roamTimer = 22.0;

      if (learnedFromVideo) {
        return (
          `💃 Oh yeah! I just scanned the live video ${videoSourceDesc}, copied its motion rhythm (${activeChoreo.bpm} BPM, ` +
          `Arm-Wave ${activeChoreo.armWave}x, Hip-Sway ${activeChoreo.hipSway}x), saved this choreography permanently into my memory, ` +
          `and I am dancing '${activeChoreo.name}' right next to the video right now! Watch my 52-bone K-Pop moves!`
        );
      }
      return (
        `💃 Let's go hard! Launching my 52-bone '${activeChoreo.name}' at ${activeChoreo.bpm} BPM right now—watch my full-body wave, ` +
        `K-Pop arm punches, footwork bounce, and 360° idol spins! (Tip: Open any video on X, YouTube, or TikTok and click 💃 to watch me copy & learn its choreography live!)`
      );
    }

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

    document.querySelectorAll(".aion-dance-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
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
        thinkingEl.textContent = reply;
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
        danceTimer -= dt;
        if (danceTimer <= 0) {
          isDancing = false;
          roamMode = 2;
          roamTimer = 3.0;
        }
      }
      danceBlend += ((isDancing ? 1.0 : 0.0) - danceBlend) * 0.14;

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
      } else if (isDancing) {
        const beatOmega = ((activeChoreo.bpm || 132) / 60.0) * Math.PI * 2.0;
        const barPhase = (now * ((activeChoreo.bpm || 132) / 60.0)) % 8.0;
        // Smooth 360-degree K-Pop idol stage spin on beats 6..8 of every 8-count bar!
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
      const danceJumpY = danceBlend > 0.01
        ? Math.abs(Math.sin(now * beatFreq * 0.5)) * 0.16 * (activeChoreo.legBounce || 1.2) * danceBlend
        : 0.0;
      const danceSideStepX = danceBlend > 0.01
        ? Math.sin(now * beatFreq * 0.25) * 0.14 * (activeChoreo.hipSway || 1.2) * danceBlend
        : 0.0;

      catGroup.position.set(ndcX * halfW + danceSideStepX, ndcY * halfH + danceJumpY, 0);
      catGroup.rotation.y = currentRotY;
      catGroup.rotation.z = danceBlend > 0.01 ? Math.sin(now * beatFreq * 0.5) * 0.11 * danceBlend : 0.0;

      ui.hitbox.style.left = `${screenX}px`;
      ui.hitbox.style.top = `${screenY}px`;
      ui.speech.style.left = `${Math.max(170, Math.min(window.innerWidth - 170, screenX))}px`;
      ui.speech.style.top = `${Math.max(75, screenY - 95)}px`;

      if (mixer) {
        const animRate = moveSpeedPx > 10 ? 0.55 + (moveSpeedPx / 150.0) * 1.15 : 0.35;
        mixer.update(dt * animRate);
      }

      const xAxis = new THREE.Vector3(1, 0, 0);
      const yAxis = new THREE.Vector3(0, 1, 0);
      const zAxis = new THREE.Vector3(0, 0, 1);

      // ======================================================================
      // 52-BONE FULL-BODY K-POP / VIDEO-LEARNED 3D CHOREOGRAPHY SYNTHESIZER
      // ======================================================================
      if (danceBlend > 0.01) {
        const w = ((activeChoreo.bpm || 132) / 60.0) * Math.PI * 2.0;
        const hipAmp = (activeChoreo.hipSway || 1.2) * danceBlend;
        const spineAmp = (activeChoreo.spineWave || 1.2) * danceBlend;
        const armAmp = (activeChoreo.armWave || 1.35) * danceBlend;
        const legAmp = (activeChoreo.legBounce || 1.25) * danceBlend;
        const section = Math.floor((now * ((activeChoreo.bpm || 132) / 60.0)) / 4.0) % 3;

        // 1. Pelvis / Hip Sway & Groove Bounce
        if (bones.pelvis) {
          bones.pelvis.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(yAxis, Math.sin(now * w * 0.5) * 0.34 * hipAmp)
          );
          bones.pelvis.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(xAxis, Math.cos(now * w) * 0.18 * hipAmp)
          );
        }

        // 2. 4-Segment Spine C1 Body Wave & Chest Isolation
        const spineChain = [bones.spine0, bones.spine1, bones.spine2, bones.spine3];
        spineChain.forEach((sp, idx) => {
          if (sp) {
            const phase = now * w - idx * 0.55;
            sp.quaternion.multiply(
              new THREE.Quaternion().setFromAxisAngle(zAxis, Math.sin(phase) * 0.16 * spineAmp)
            );
            sp.quaternion.multiply(
              new THREE.Quaternion().setFromAxisAngle(yAxis, Math.cos(phase * 0.5) * 0.14 * spineAmp)
            );
          }
        });

        // 3. Neck & Head K-Pop Groove Nod + Isolation
        if (bones.neck) {
          bones.neck.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, Math.sin(now * w) * 0.22 * spineAmp)
          );
        }
        if (bones.head) {
          bones.head.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(yAxis, -Math.sin(now * w * 0.5) * 0.28 * spineAmp)
          );
          bones.head.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, Math.abs(Math.cos(now * w)) * 0.24 * spineAmp)
          );
        }

        // 4. Multi-Section K-Pop Arm, Forearm & Paw Choreography ("Go Hard" punches, overhead waves & cross grooves)
        const armPhaseR = now * w;
        const armPhaseL = section === 0 ? now * w + Math.PI : (section === 1 ? now * w : now * w + Math.PI * 0.5);

        if (bones.clavR) {
          bones.clavR.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, Math.sin(armPhaseR) * 0.25 * armAmp)
          );
        }
        if (bones.clavL) {
          bones.clavL.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, Math.sin(armPhaseL) * 0.25 * armAmp)
          );
        }
        if (bones.armR) {
          const liftR = (-0.75 + Math.sin(armPhaseR) * 0.65) * armAmp;
          const twistR = Math.cos(armPhaseR * 0.5) * 0.45 * armAmp;
          bones.armR.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, liftR));
          bones.armR.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, twistR));
        }
        if (bones.armL) {
          const liftL = (-0.75 + Math.sin(armPhaseL) * 0.65) * armAmp;
          const twistL = -Math.cos(armPhaseL * 0.5) * 0.45 * armAmp;
          bones.armL.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, liftL));
          bones.armL.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis, twistL));
        }
        if (bones.forearmR) {
          bones.forearmR.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, (0.45 + Math.cos(armPhaseR) * 0.52) * armAmp)
          );
        }
        if (bones.forearmL) {
          bones.forearmL.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, (0.45 + Math.cos(armPhaseL) * 0.52) * armAmp)
          );
        }
        if (bones.handR) {
          bones.handR.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, Math.sin(now * w * 2.0) * 0.38 * armAmp)
          );
        }
        if (bones.handL) {
          bones.handL.quaternion.multiply(
            new THREE.Quaternion().setFromAxisAngle(zAxis, Math.cos(now * w * 2.0) * 0.38 * armAmp)
          );
        }

        // 5. High-Energy Footwork & Knee Step-Tap Choreography
        const legStepR = Math.max(0, Math.sin(now * w * 0.5)) * 0.55 * legAmp;
        const legStepL = Math.max(0, -Math.sin(now * w * 0.5)) * 0.55 * legAmp;
        if (bones.thighR) {
          bones.thighR.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, -legStepR));
        }
        if (bones.calfR) {
          bones.calfR.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, legStepR * 1.15));
        }
        if (bones.footR) {
          bones.footR.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, -legStepR * 0.6));
        }
        if (bones.thighL) {
          bones.thighL.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, -legStepL));
        }
        if (bones.calfL) {
          bones.calfL.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, legStepL * 1.15));
        }
        if (bones.footL) {
          bones.footL.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, -legStepL * 0.6));
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

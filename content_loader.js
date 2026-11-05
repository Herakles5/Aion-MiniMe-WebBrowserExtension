/**
 * AION Everywhere (Manifest V3 Content Loader & CSP-Bypass Bridge)
 * =================================================================
 * 1. Injects the CFS1 Mini-Me Easter Egg Roamer (`aion_minime_easter_egg.js`) into the webpage.
 * 2. Bridges `window.postMessage` requests from the page script to the privileged
 *    extension `background.js` worker so strict website CSPs (like x.com, github.com, etc.)
 *    never block live AION Nexus Chat, Generation Sync, or Piper Neural TTS!
 */
(function () {
  if (document.getElementById("aion-everywhere-injected")) return;

  const runtimeAPI = typeof browser !== "undefined" ? browser.runtime : chrome.runtime;

  // Listen for bridge requests from the page-context script and forward to background.js
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== "AION_MINIME_PAGE_REQ") {
      return;
    }
    const { reqId, path, method, body } = event.data;

    try {
      runtimeAPI.sendMessage(
        {
          type: "AION_BRIDGE_FETCH",
          path,
          method,
          body
        },
        (response) => {
          window.postMessage(
            {
              source: "AION_MINIME_EXT_RESP",
              reqId,
              response: response || { ok: false, status: 503, data: null }
            },
            "*"
          );
        }
      );
    } catch (err) {
      window.postMessage(
        {
          source: "AION_MINIME_EXT_RESP",
          reqId,
          response: { ok: false, status: 500, data: null }
        },
        "*"
      );
    }
  });

  const meta = document.createElement("script");
  meta.id = "aion-everywhere-injected";
  const baseUrl = runtimeAPI.getURL("");
  meta.textContent = `window.AION_MINIME_BASE_URL = ${JSON.stringify(baseUrl)}; window.AION_EXTENSION_BRIDGE_ACTIVE = true;`;
  (document.head || document.documentElement).appendChild(meta);

  const s = document.createElement("script");
  s.src = runtimeAPI.getURL("aion_minime_easter_egg.js");
  s.async = true;
  (document.head || document.documentElement).appendChild(s);
})();

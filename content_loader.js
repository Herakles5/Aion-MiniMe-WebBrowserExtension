/**
 * AION Everywhere (Manifest V3 Content Loader & YouTube/X Zero-CSP/TrustedTypes Bridge)
 * =====================================================================================
 * 1. Passes the extension base URL and bridge status via DOM dataset attributes
 *    on `document.documentElement` (NEVER blocked by strict `script-src` or `TrustedTypes` on YouTube/X!).
 * 2. Loads `aion_minime_easter_egg.cfs` binary capsule directly in the privileged Content Script
 *    context (`__LOAD_CFS_BINARY__`) so strict `connect-src` CSPs on YouTube/X can never block
 *    unpacking the 3D Tuxedo Cat GLB!
 * 3. Sequentially injects `three.min.js` -> `GLTFLoader.js` -> `aion_minime_easter_egg.js`
 *    from the privileged Content Script context so page-world `TrustedScriptURL` on YouTube
 *    never blocks script loading!
 */
(function () {
  if (document.documentElement.getAttribute("data-aion-ext-bridge") === "1") return;

  const isFirefox = typeof browser !== "undefined" && browser.runtime && browser.runtime.sendMessage;
  const runtimeAPI = isFirefox ? browser.runtime : chrome.runtime;
  const baseUrl = runtimeAPI.getURL("");

  document.documentElement.setAttribute("data-aion-ext-bridge", "1");
  document.documentElement.setAttribute("data-aion-base-url", baseUrl);

  async function forwardToBackgroundOrLocal(path, method, body) {
    // Special handler: Load the 353 KB CFS1 binary capsule from the privileged extension context
    if (path === "__LOAD_CFS_BINARY__") {
      try {
        const cfsUrl = runtimeAPI.getURL("aion_minime_easter_egg.cfs");
        const res = await fetch(cfsUrl);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          return { ok: true, status: 200, cfsBytes: new Uint8Array(ab) };
        }
      } catch (e) {}
      try {
        const res2 = await fetch("http://127.0.0.1:8788/aion_minime_easter_egg.cfs");
        if (res2.ok) {
          const ab2 = await res2.arrayBuffer();
          return { ok: true, status: 200, cfsBytes: new Uint8Array(ab2) };
        }
      } catch (e2) {}
      return { ok: false, status: 500, data: null };
    }

    // 1. Route API requests via privileged background.js worker
    try {
      let bgResp = null;
      if (isFirefox) {
        bgResp = await browser.runtime.sendMessage({
          type: "AION_BRIDGE_FETCH",
          path,
          method,
          body
        });
      } else {
        bgResp = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "AION_BRIDGE_FETCH",
              path,
              method,
              body
            },
            (res) => resolve(res)
          );
        });
      }
      if (bgResp && bgResp.ok) {
        return bgResp;
      }
    } catch (e) {}

    // 2. Fallback: Direct Content-Script Fetch to http://127.0.0.1:8788
    try {
      const opts = {
        method: method || "GET",
        headers: { "Content-Type": "application/json" }
      };
      if (opts.method !== "GET" && body !== null) {
        opts.body = JSON.stringify(body);
      }
      const res = await fetch("http://127.0.0.1:8788" + path, opts);
      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        const data = ct.includes("application/json") ? await res.json() : await res.text();
        return { ok: true, status: res.status, data };
      }
    } catch (e) {}

    return { ok: false, status: 503, data: null };
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || !event.data || event.data.source !== "AION_MINIME_PAGE_REQ") {
      return;
    }
    const { reqId, path, method, body } = event.data;
    const response = await forwardToBackgroundOrLocal(path, method, body);
    window.postMessage(
      {
        source: "AION_MINIME_EXT_RESP",
        reqId,
        response
      },
      "*"
    );
  });

  function injectExtensionScript(fileName) {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = runtimeAPI.getURL(fileName);
      s.async = false;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      (document.head || document.documentElement).appendChild(s);
    });
  }

  (async function bootSequence() {
    await injectExtensionScript("three.min.js");
    await injectExtensionScript("GLTFLoader.js");
    await injectExtensionScript("aion_minime_easter_egg.js");
  })();
})();

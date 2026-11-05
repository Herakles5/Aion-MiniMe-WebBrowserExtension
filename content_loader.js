/**
 * AION Everywhere (Manifest V3 Content Loader & Zero-CSP-Violation Bridge)
 * =========================================================================
 * 1. Passes the extension base URL and bridge status via DOM dataset attributes
 *    on `document.documentElement` (NEVER blocked by strict `script-src` CSP on x.com!).
 * 2. Bridges `window.postMessage` requests from the page script to the privileged
 *    extension `background.js` worker using Firefox Promise API (`browser.runtime.sendMessage`)
 *    and Chrome callback API (`chrome.runtime.sendMessage`), plus direct content-script
 *    fetch fallback to `http://127.0.0.1:8788`.
 */
(function () {
  if (document.documentElement.getAttribute("data-aion-ext-bridge") === "1") return;

  const isFirefox = typeof browser !== "undefined" && browser.runtime && browser.runtime.sendMessage;
  const runtimeAPI = isFirefox ? browser.runtime : chrome.runtime;
  const baseUrl = runtimeAPI.getURL("");

  // Set DOM attributes on <html> — 100% immune to inline <script> CSP blocks on x.com / github.com!
  document.documentElement.setAttribute("data-aion-ext-bridge", "1");
  document.documentElement.setAttribute("data-aion-base-url", baseUrl);

  async function forwardToBackgroundOrLocal(path, method, body) {
    // 1. Route via privileged background.js worker
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

  const s = document.createElement("script");
  s.id = "aion-everywhere-injected";
  s.src = runtimeAPI.getURL("aion_minime_easter_egg.js");
  s.async = true;
  (document.head || document.documentElement).appendChild(s);
})();

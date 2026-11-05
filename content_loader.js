/**
 * AION Everywhere (Manifest V3 Content Loader)
 * Injects the CFS1 Mini-Me Easter Egg Roamer into the active webpage with the extension's base URL.
 */
(function () {
  if (document.getElementById("aion-everywhere-injected")) return;
  const meta = document.createElement("script");
  meta.id = "aion-everywhere-injected";
  const baseUrl = chrome.runtime.getURL("");
  meta.textContent = `window.AION_MINIME_BASE_URL = ${JSON.stringify(baseUrl)};`;
  (document.head || document.documentElement).appendChild(meta);

  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("aion_minime_easter_egg.js");
  s.async = true;
  (document.head || document.documentElement).appendChild(s);
})();


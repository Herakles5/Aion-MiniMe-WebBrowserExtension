// ==UserScript==
// @name         AION Everywhere — 3D Mini-Me Cat & CosmOS CFS1 AI (Desktop & Mobile)
// @namespace    https://github.com/Herakles5/Aion-MiniMe-WebBrowserExtension
// @version      1.6.4
// @description  Peaceful 3D Mini-Me AION (Model 13 Tuxedo Cat) packed in a 353 KB CosmOS Crystal File System (CFS1) capsule. Roams every webpage on Desktop & Smartphone, dances upright on 2 legs, and chats with 120B AI intelligence & English neural voice 24/7!
// @author       Tobias (Herakles5) & Argon (AION NEXUS / CosmOS)
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";
  if (window.top !== window.self) return;
  if (document.getElementById("aion-minime-canvas") || window.__AION_MINIME_ACTIVE__) return;

  const CDN_BASE = "https://raw.githubusercontent.com/Herakles5/Aion-MiniMe-WebBrowserExtension/main/";
  document.documentElement.setAttribute("data-aion-base-url", CDN_BASE);
  window.AION_MINIME_BASE_URL = CDN_BASE;
  window.AION_NEXUS_BRIDGE_URL = "http://10.43.191.111:8788";

  function loadRemoteScript(url, cb) {
    fetch(url)
      .then((r) => r.text())
      .then((code) => {
        const fn = new Function(code);
        fn();
        if (cb) cb();
      })
      .catch(() => {});
  }

  loadRemoteScript(CDN_BASE + "three.min.js", function () {
    loadRemoteScript(CDN_BASE + "GLTFLoader.js", function () {
      loadRemoteScript(CDN_BASE + "aion_minime_easter_egg.js");
    });
  });
})();


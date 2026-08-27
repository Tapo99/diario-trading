// ============================================================
// Orquestador principal: activacion -> tabs -> wizard / diario.
// ============================================================
(function () {
  function $(sel) {
    return document.querySelector(sel);
  }

  function showApp() {
    $("#screen-activation").hidden = true;
    $("#screen-app").hidden = false;
    setupTabs();
    setupInfoTab();
    window.DiarioWizard.init();
    window.DiarioTab.init();
  }

  function setupInfoTab() {
    const link = $("#info-whatsapp");
    if (link) {
      const numero = window.APP_CONFIG.WHATSAPP_NUMERO;
      link.textContent = "+" + numero;
      link.href = "https://wa.me/" + numero;
    }
  }

  function setupTabs() {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.toggle("tab-btn-active", b.dataset.tab === tabName);
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.hidden = p.dataset.tabPanel !== tabName;
    });
    if (tabName === "diario") {
      window.DiarioTab.render();
    }
    if (tabName === "estadistica") {
      window.DiarioStats.render();
    }
  }

  window.addEventListener("app:activated", showApp);
  window.addEventListener("app:navigate", (e) => switchTab(e.detail.tab));

  document.addEventListener("DOMContentLoaded", () => {
    window.DiarioActivation.init();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }
})();

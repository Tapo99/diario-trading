// ============================================================
// Orquestador principal: activacion -> tabs -> wizard / diario.
// ============================================================
(function () {
  function $(sel) {
    return document.querySelector(sel);
  }

  let deferredInstallPrompt = null;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallButtonIfReady();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    const btn = $("#install-app-btn");
    if (btn) btn.hidden = true;
  });

  function showInstallButtonIfReady() {
    const btn = $("#install-app-btn");
    if (!btn || isStandalone) return;
    if (deferredInstallPrompt || isIos) {
      btn.hidden = false;
    }
  }

  function setupInstallButton() {
    const btn = $("#install-app-btn");
    if (!btn) return;

    showInstallButtonIfReady();

    btn.addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        btn.hidden = true;
        return;
      }
      if (isIos) {
        showIosInstallInstructions();
      }
    });
  }

  function showIosInstallInstructions() {
    const overlay = document.createElement("div");
    overlay.className = "detail-overlay";

    const panel = document.createElement("div");
    panel.className = "detail-panel";
    panel.innerHTML = `
      <button class="detail-close">Cerrar</button>
      <h2>Instalar en iPhone/iPad</h2>
      <div class="detail-block">
        <p>Safari no deja instalar con un solo boton, pero es rapido:</p>
        <p>1. Toca el boton <strong>Compartir</strong> (el cuadro con la flecha hacia arriba), abajo en la barra del navegador.</p>
        <p>2. Busca la opcion <strong>"Agregar a inicio"</strong> (Add to Home Screen) y toca Agregar.</p>
        <p>3. Listo — el icono de Diario de Trading queda en tu pantalla de inicio como una app normal.</p>
      </div>
    `;
    panel.querySelector(".detail-close").addEventListener("click", () => overlay.remove());

    overlay.appendChild(panel);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function showApp() {
    $("#screen-activation").hidden = true;
    $("#screen-app").hidden = false;
    setupTabs();
    setupMobileMenu();
    setupInfoTab();
    setupInstallButton();
    window.DiarioWizard.init();
    window.DiarioTab.init();
  }

  function setupMobileMenu() {
    const toggle = $("#menu-toggle");
    const tabs = $("#app-tabs");
    if (!toggle || !tabs) return;

    toggle.addEventListener("click", () => {
      const isOpen = tabs.classList.toggle("app-tabs-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("click", (e) => {
      if (!tabs.classList.contains("app-tabs-open")) return;
      if (tabs.contains(e.target) || toggle.contains(e.target)) return;
      tabs.classList.remove("app-tabs-open");
      toggle.setAttribute("aria-expanded", "false");
    });
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
      btn.addEventListener("click", () => {
        switchTab(btn.dataset.tab);
        const mobileNav = $("#app-tabs");
        const toggle = $("#menu-toggle");
        if (mobileNav) mobileNav.classList.remove("app-tabs-open");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      });
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
    let reloadedForUpdate = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadedForUpdate) return;
      reloadedForUpdate = true;
      window.location.reload();
    });

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").then((reg) => {
        reg.update();
      }).catch(() => {});
    });
  }
})();

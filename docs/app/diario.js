// ============================================================
// Pestana "Diario": listado agrupado por fecha, vista de detalle,
// exportar PDF por trade, y respaldo por rango de fechas (JSON).
// ============================================================
(function () {
  const QUESTION_LABELS = [
    ["configuracion", "Configuracion del Trade"],
    ["justificacion", "Justificacion"],
    ["emociones", "Emociones y Psicologia"],
    ["riesgo", "Gestion de Riesgo"],
    ["resultado", "Resultado y Reflexion"],
    ["lecciones", "Lecciones Aprendidas"],
    ["condiciones", "Condiciones del Mercado"],
    ["planes", "Planes Futuros"],
  ];

  const RESULTADO_LABELS = {
    ganancia: "Ganancia",
    perdida: "Perdida",
    equilibrio: "Equilibrio",
  };

  let selectionMode = false;
  let selectedIds = new Set();

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function formatDateHeader(isoDate) {
    const [y, m, d] = isoDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function loadTrades() {
    const trades = await window.DiarioDB.getAllTrades();
    // agrupar por fecha, mas reciente arriba; dentro del dia, por insercion ascendente
    const byDate = new Map();
    for (const t of trades) {
      if (!byDate.has(t.fecha)) byDate.set(t.fecha, []);
      byDate.get(t.fecha).push(t);
    }
    for (const list of byDate.values()) {
      list.sort((a, b) => a.createdAt - b.createdAt);
    }
    const dates = Array.from(byDate.keys()).sort((a, b) => (a < b ? 1 : -1));
    return { dates, byDate };
  }

  async function render() {
    const root = $("#diario-root");
    root.innerHTML = "";

    const allTrades = await window.DiarioDB.getAllTrades();
    const allIds = allTrades.map((t) => t.id);

    const toolbar = document.createElement("div");
    toolbar.className = "diario-toolbar";

    const selectBtn = document.createElement("button");
    selectBtn.className = "btn btn-secondary";
    selectBtn.textContent = selectionMode ? "Cancelar seleccion" : "Eliminar varios";
    selectBtn.addEventListener("click", () => {
      selectionMode = !selectionMode;
      if (!selectionMode) selectedIds.clear();
      render();
    });
    toolbar.appendChild(selectBtn);

    if (selectionMode) {
      const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
      const selectAllBtn = document.createElement("button");
      selectAllBtn.className = "btn btn-secondary";
      selectAllBtn.textContent = allSelected ? "Deseleccionar todos" : "Seleccionar todos";
      selectAllBtn.addEventListener("click", () => {
        if (allSelected) {
          selectedIds.clear();
        } else {
          selectedIds = new Set(allIds);
        }
        render();
      });
      toolbar.appendChild(selectAllBtn);
    }

    const backupBtn = document.createElement("button");
    backupBtn.className = "btn btn-secondary";
    backupBtn.textContent = "Respaldo por fechas";
    backupBtn.addEventListener("click", openBackupDialog);
    toolbar.appendChild(backupBtn);

    root.appendChild(toolbar);

    if (selectionMode) {
      root.appendChild(renderSelectionBar());
    }

    const { dates, byDate } = await loadTrades();

    if (dates.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Todavia no has guardado ningun trade.";
      root.appendChild(empty);
      return;
    }

    for (const fecha of dates) {
      const group = document.createElement("section");
      group.className = "diario-group";

      const header = document.createElement("h3");
      header.className = "diario-group-header";
      header.textContent = formatDateHeader(fecha);
      group.appendChild(header);

      for (const trade of byDate.get(fecha)) {
        group.appendChild(renderCard(trade));
      }

      root.appendChild(group);
    }
  }

  function renderSelectionBar() {
    const bar = document.createElement("div");
    bar.className = "selection-bar";

    const count = document.createElement("span");
    count.textContent = `${selectedIds.size} seleccionado(s)`;
    bar.appendChild(count);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger-solid";
    deleteBtn.textContent = "Eliminar seleccionados";
    deleteBtn.disabled = selectedIds.size === 0;
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`Vas a eliminar ${selectedIds.size} trade(s). Esta accion no se puede deshacer. Continuar?`)) {
        return;
      }
      await window.DiarioDB.deleteTrades(Array.from(selectedIds));
      selectionMode = false;
      selectedIds.clear();
      render();
    });
    bar.appendChild(deleteBtn);

    return bar;
  }

  function renderCard(trade) {
    const card = document.createElement("article");
    card.className = "trade-card resultado-" + (trade.resultado || "neutro");
    if (selectionMode && selectedIds.has(trade.id)) {
      card.classList.add("trade-card-selected");
    }

    if (selectionMode) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "trade-select-checkbox";
      checkbox.checked = selectedIds.has(trade.id);
      checkbox.addEventListener("click", (e) => e.stopPropagation());
      checkbox.addEventListener("change", () => toggleSelection(trade.id));
      card.appendChild(checkbox);
    } else {
      const actions = document.createElement("div");
      actions.className = "trade-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "trade-action-btn";
      editBtn.title = "Editar este trade";
      editBtn.innerHTML = "&#9998;";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.DiarioWizard.startEdit(trade);
      });
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "trade-action-btn trade-action-btn-danger";
      deleteBtn.title = "Eliminar este trade";
      deleteBtn.innerHTML = "&#128465;";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("Vas a eliminar este trade. Esta accion no se puede deshacer. Continuar?")) return;
        await window.DiarioDB.deleteTrade(trade.id);
        render();
      });
      actions.appendChild(deleteBtn);

      const exportBtn = document.createElement("button");
      exportBtn.type = "button";
      exportBtn.className = "trade-action-btn";
      exportBtn.title = "Exportar PDF de este trade";
      exportBtn.innerHTML = "&#128196;";
      exportBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        exportTradePdf(trade);
      });
      actions.appendChild(exportBtn);

      card.appendChild(actions);
    }

    if (trade.imagenBlob) {
      const thumb = document.createElement("img");
      thumb.className = "trade-thumb";
      thumb.src = URL.createObjectURL(trade.imagenBlob);
      card.appendChild(thumb);
    }

    const body = document.createElement("div");
    body.className = "trade-card-body";

    const meta = document.createElement("div");
    meta.className = "trade-card-meta";
    meta.textContent = formatTime(trade.createdAt);
    body.appendChild(meta);

    const excerpt = document.createElement("p");
    excerpt.className = "trade-card-excerpt";
    const configText = (trade.respuestas && trade.respuestas.configuracion) || "";
    excerpt.textContent = configText.length > 120 ? configText.slice(0, 120) + "..." : configText;
    body.appendChild(excerpt);

    const badge = document.createElement("span");
    badge.className = "resultado-badge resultado-badge-" + (trade.resultado || "neutro");
    badge.textContent = RESULTADO_LABELS[trade.resultado] || "Sin resultado";
    body.appendChild(badge);

    card.appendChild(body);

    card.addEventListener("click", () => {
      if (selectionMode) {
        toggleSelection(trade.id);
      } else {
        openDetail(trade);
      }
    });

    return card;
  }

  function toggleSelection(id) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    render();
  }

  function openDetail(trade) {
    const overlay = document.createElement("div");
    overlay.className = "detail-overlay";

    const panel = document.createElement("div");
    panel.className = "detail-panel";

    const closeBtn = document.createElement("button");
    closeBtn.className = "detail-close";
    closeBtn.textContent = "Cerrar";
    closeBtn.addEventListener("click", () => overlay.remove());
    panel.appendChild(closeBtn);

    const h = document.createElement("h2");
    h.textContent = formatDateHeader(trade.fecha);
    panel.appendChild(h);

    const badge = document.createElement("span");
    badge.className = "resultado-badge resultado-badge-" + (trade.resultado || "neutro");
    badge.textContent = RESULTADO_LABELS[trade.resultado] || "Sin resultado";
    panel.appendChild(badge);

    if (trade.imagenBlob) {
      const img = document.createElement("img");
      img.className = "detail-image";
      img.src = URL.createObjectURL(trade.imagenBlob);
      panel.appendChild(img);
    }

    for (const [key, label] of QUESTION_LABELS) {
      const block = document.createElement("div");
      block.className = "detail-block";
      const h3 = document.createElement("h4");
      h3.textContent = label;
      const p = document.createElement("p");
      p.textContent = (trade.respuestas && trade.respuestas[key]) || "-";
      block.appendChild(h3);
      block.appendChild(p);
      panel.appendChild(block);
    }

    overlay.appendChild(panel);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  async function exportTradePdf(trade) {
    let imgHtml = "";
    if (trade.imagenBlob) {
      const dataUrl = await blobToDataUrl(trade.imagenBlob);
      imgHtml = `<img src="${dataUrl}" style="max-width:100%;margin:16px 0;border-radius:8px;" />`;
    }

    const questionsHtml = QUESTION_LABELS.map(([key, label]) => {
      const value = (trade.respuestas && trade.respuestas[key]) || "-";
      return `<div style="margin-bottom:14px;"><h3 style="margin:0 0 4px;font-size:14px;color:#0f766e;">${label}</h3><p style="margin:0;white-space:pre-wrap;">${escapeHtml(value)}</p></div>`;
    }).join("");

    const resultadoLabel = RESULTADO_LABELS[trade.resultado] || "Sin resultado";

    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Trade ${trade.fecha}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 32px; max-width: 700px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #555; margin-bottom: 24px; }
  .resultado { display:inline-block; padding:4px 12px; border-radius:999px; font-weight:bold; font-size:12px; margin-bottom:16px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>Diario de Trading</h1>
  <div class="meta">${formatDateHeader(trade.fecha)}</div>
  <div class="resultado" style="background:${resultadoColor(trade.resultado)};color:#fff;">${resultadoLabel}</div>
  ${imgHtml}
  ${questionsHtml}
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) {
      alert("Tu navegador bloqueo la ventana de impresion. Permite ventanas emergentes para exportar el PDF.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  function resultadoColor(resultado) {
    if (resultado === "ganancia") return "#16a34a";
    if (resultado === "perdida") return "#dc2626";
    return "#64748b";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function openBackupDialog() {
    const overlay = document.createElement("div");
    overlay.className = "detail-overlay";

    const panel = document.createElement("div");
    panel.className = "detail-panel backup-panel";

    const h = document.createElement("h2");
    h.textContent = "Respaldo por fechas";
    panel.appendChild(h);

    const fromLabel = document.createElement("label");
    fromLabel.className = "field-label";
    fromLabel.textContent = "Desde";
    const fromInput = document.createElement("input");
    fromInput.type = "date";
    fromInput.className = "field-input";

    const toLabel = document.createElement("label");
    toLabel.className = "field-label";
    toLabel.textContent = "Hasta";
    const toInput = document.createElement("input");
    toInput.type = "date";
    toInput.className = "field-input";

    panel.appendChild(fromLabel);
    panel.appendChild(fromInput);
    panel.appendChild(toLabel);
    panel.appendChild(toInput);

    const msg = document.createElement("p");
    msg.className = "backup-msg";
    panel.appendChild(msg);

    const actions = document.createElement("div");
    actions.className = "wizard-nav";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-secondary";
    cancelBtn.textContent = "Cancelar";
    cancelBtn.addEventListener("click", () => overlay.remove());

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "btn btn-primary";
    confirmBtn.textContent = "Descargar";
    confirmBtn.addEventListener("click", async () => {
      msg.textContent = "";
      if (!fromInput.value || !toInput.value) {
        msg.textContent = "Elige ambas fechas.";
        return;
      }
      if (fromInput.value > toInput.value) {
        msg.textContent = "La fecha 'Desde' no puede ser posterior a 'Hasta'.";
        return;
      }
      await downloadBackup(fromInput.value, toInput.value, msg);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    panel.appendChild(actions);

    overlay.appendChild(panel);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  async function downloadBackup(from, to, msgEl) {
    const trades = await window.DiarioDB.getAllTrades();
    const filtered = trades.filter((t) => t.fecha >= from && t.fecha <= to);

    if (filtered.length === 0) {
      msgEl.textContent = "No hay trades guardados en ese rango de fechas.";
      return;
    }

    filtered.sort((a, b) => (a.fecha === b.fecha ? a.createdAt - b.createdAt : a.fecha < b.fecha ? -1 : 1));

    const exportable = [];
    for (const t of filtered) {
      let imagenDataUrl = null;
      if (t.imagenBlob) {
        imagenDataUrl = await blobToDataUrl(t.imagenBlob);
      }
      exportable.push({
        id: t.id,
        fecha: t.fecha,
        createdAt: t.createdAt,
        resultado: t.resultado,
        respuestas: t.respuestas,
        imagen: imagenDataUrl,
      });
    }

    const payload = {
      generadoEl: new Date().toISOString(),
      rango: { desde: from, hasta: to },
      trades: exportable,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diario-trading-respaldo-${from}_a_${to}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    msgEl.textContent = `Listo: ${filtered.length} trade(s) exportado(s).`;
  }

  function init() {
    render();
  }

  window.DiarioTab = { init, render };
})();

// ============================================================
// Pestana "Diario": listado agrupado por fecha, vista de detalle,
// exportar PDF por trade individual, y reporte PDF por rango de fechas
// (grafica de barras por dia + resumen + detalle agrupado por dia).
// ============================================================
(function () {
  const QUESTION_LABELS = [
    ["configuracion", "Configuracion del Trade", "Describe la estrategia y la configuracion que utilizaste para este trade."],
    ["justificacion", "Justificacion", "Cual fue la razon principal por la que entraste en este trade?"],
    ["emociones", "Emociones y Psicologia", "Como te sentiste antes, durante y despues del trade?"],
    ["riesgo", "Gestion de Riesgo", "Como determinaste el tamano de tu posicion y los niveles de riesgo?"],
    ["resultado", "Resultado y Reflexion", "El trade fue una ganancia, una perdida o un punto de equilibrio? Que aprendiste de este trade?"],
    ["lecciones", "Lecciones Aprendidas", "Que aprendizajes puedes obtener de este trade?"],
    ["condiciones", "Condiciones del Mercado", "Hubo condiciones del mercado o noticias que afectaran el trade?"],
    ["planes", "Planes Futuros", "Como influira este trade en tus decisiones futuras?"],
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
    backupBtn.textContent = "Exportar PDF por fechas";
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
        exportTradePdf(trade).catch((err) => {
          alert("No se pudo generar el PDF: " + err.message);
        });
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

    if (trade.monto) {
      const monto = document.createElement("p");
      monto.className = "detail-monto";
      monto.textContent = "$" + Number(trade.monto).toFixed(2);
      panel.appendChild(monto);
    }

    if (trade.imagenBlob) {
      const img = document.createElement("img");
      img.className = "detail-image";
      img.src = URL.createObjectURL(trade.imagenBlob);
      panel.appendChild(img);
    }

    for (const [key, label, pregunta] of QUESTION_LABELS) {
      const block = document.createElement("div");
      block.className = "detail-block";
      const h3 = document.createElement("h4");
      h3.textContent = label;
      const q = document.createElement("p");
      q.className = "detail-block-question";
      q.textContent = pregunta;
      const p = document.createElement("p");
      p.textContent = (trade.respuestas && trade.respuestas[key]) || "-";
      block.appendChild(h3);
      block.appendChild(q);
      block.appendChild(p);
      panel.appendChild(block);
    }

    overlay.appendChild(panel);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  async function buildTradeDetailHtml(trade, { showDateAsHeading } = {}) {
    let imgHtml = "";
    if (trade.imagenBlob) {
      const dataUrl = await blobToDataUrl(trade.imagenBlob);
      imgHtml = `<img src="${dataUrl}" style="max-width:100%;margin:16px 0;border-radius:8px;" />`;
    }

    const resultadoLabel = RESULTADO_LABELS[trade.resultado] || "Sin resultado";
    const color = resultadoColor(trade.resultado);
    const montoText = trade.monto ? "$" + Number(trade.monto).toFixed(2) : "";
    const badgeHtml = `<span style="display:inline-block;background:${color};color:#fff;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:bold;">${resultadoLabel}</span>`;
    const montoHtml = montoText
      ? `<div style="margin:8px 0 16px;font-size:16px;font-weight:bold;color:#111;">${montoText}</div>`
      : "";

    const questionsHtml = QUESTION_LABELS.map(([key, label, pregunta]) => {
      const value = (trade.respuestas && trade.respuestas[key]) || "-";
      const inlineDetail =
        key === "resultado"
          ? `<div style="margin:4px 0 6px;">${badgeHtml}${montoText ? ` <span style="font-weight:bold;color:#111;">${montoText}</span>` : ""}</div>`
          : "";
      return `<div style="margin-bottom:14px;"><h3 style="margin:0 0 4px;font-size:14px;color:#0f766e;">${label}</h3><p style="margin:0 0 6px;font-size:12px;color:#666;">${escapeHtml(pregunta)}</p>${inlineDetail}<p style="margin:0;white-space:pre-wrap;color:#111;">${escapeHtml(value)}</p></div>`;
    }).join("");

    const heading = showDateAsHeading
      ? `<div class="meta" style="color:#555;">${formatDateHeader(trade.fecha)} — ${formatTime(trade.createdAt)}</div>`
      : "";

    return `
      <div class="trade-block" style="background:#fff;color:#111;">
        ${heading}
        <div style="margin-bottom:16px;">${badgeHtml}</div>
        ${montoHtml}
        ${imgHtml}
        ${questionsHtml}
      </div>
    `;
  }

  async function exportTradePdf(trade) {
    const tradeHtml = await buildTradeDetailHtml(trade, { showDateAsHeading: true });

    const html = `
<style>
  .print-doc { font-family: Arial, Helvetica, sans-serif; color: #111; }
  .print-doc h1 { font-size: 20px; margin-bottom: 4px; }
  .print-doc .meta { color: #555; margin-bottom: 8px; }
  .print-doc .trade-block { break-inside: avoid; }
</style>
<div class="print-doc" style="background:#fff;color:#111;">
  <h1>Diario de Trading</h1>
  ${tradeHtml}
</div>`;

    showPrintPreview(html);
  }

  function showPrintPreview(contentHtml) {
    const existing = document.getElementById("print-preview-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "print-preview-overlay";
    overlay.style.cssText =
      "background:#ffffff;color:#111111;-webkit-print-color-adjust:exact;print-color-adjust:exact;";
    overlay.innerHTML = `
      <div class="print-preview-toolbar">
        <span>Vista previa de impresion</span>
        <button type="button" class="btn btn-secondary" id="print-preview-close">Cerrar</button>
      </div>
      <div class="print-preview-content" style="background:#ffffff;color:#111111;">${contentHtml}</div>
    `;
    document.body.appendChild(overlay);

    const cleanup = () => {
      overlay.remove();
      window.removeEventListener("afterprint", cleanup);
    };

    overlay.querySelector("#print-preview-close").addEventListener("click", cleanup);
    window.addEventListener("afterprint", cleanup);

    setTimeout(() => window.print(), 200);
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
    h.textContent = "Exportar PDF por fechas";
    panel.appendChild(h);

    const monthLabel = document.createElement("label");
    monthLabel.className = "field-label";
    monthLabel.textContent = "O elige un mes completo";
    const monthInput = document.createElement("input");
    monthInput.type = "month";
    monthInput.className = "field-input";

    panel.appendChild(monthLabel);
    panel.appendChild(monthInput);

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

    monthInput.addEventListener("input", () => {
      if (!monthInput.value) return;
      const [year, month] = monthInput.value.split("-").map(Number);
      const pad = (n) => String(n).padStart(2, "0");
      const lastDayNum = new Date(year, month, 0).getDate();
      fromInput.value = `${year}-${pad(month)}-01`;
      toInput.value = `${year}-${pad(month)}-${pad(lastDayNum)}`;
    });

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
    confirmBtn.textContent = "Generar PDF";
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
      const success = await exportRangePdf(fromInput.value, toInput.value, msg);
      if (success) overlay.remove();
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

  function formatDayShort(isoDate) {
    const [y, m, d] = isoDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }

  function formatMoney(value) {
    const sign = value < 0 ? "-" : "";
    return sign + "$" + Math.abs(value).toFixed(2);
  }

  function buildDailyBarChartSvg(dailyTotals) {
    const days = Array.from(dailyTotals.keys()).sort();
    const width = 700;
    const height = 300;
    const zeroY = 150;
    const maxHalf = 110;
    const topMargin = 20;
    const labelAreaY = zeroY + maxHalf + 20;

    const maxAbs = Math.max(1, ...days.map((d) => Math.abs(dailyTotals.get(d).neto)));
    const slot = width / days.length;
    const barWidth = Math.min(slot * 0.55, 46);

    const bars = days
      .map((day, i) => {
        const neto = dailyTotals.get(day).neto;
        const x = i * slot + (slot - barWidth) / 2;
        const barHeight = (Math.abs(neto) / maxAbs) * maxHalf;
        const y = neto >= 0 ? zeroY - barHeight : zeroY;
        const color = neto > 0 ? "#16a34a" : neto < 0 ? "#dc2626" : "#94a3b8";
        const amountY = neto >= 0 ? y - 6 : y + barHeight + 14;
        return `
          <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barHeight, 1)}" fill="${color}" rx="3" />
          <text x="${x + barWidth / 2}" y="${amountY}" font-size="11" text-anchor="middle" fill="#111">${formatMoney(neto)}</text>
          <text x="${x + barWidth / 2}" y="${labelAreaY}" font-size="11" text-anchor="middle" fill="#555" transform="rotate(-40 ${x + barWidth / 2} ${labelAreaY})">${formatDayShort(day)}</text>
        `;
      })
      .join("");

    return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;max-width:700px;display:block;margin:0 auto;">
      <line x1="0" y1="${topMargin}" x2="0" y2="${zeroY + maxHalf}" stroke="#ddd" />
      <line x1="0" y1="${zeroY}" x2="${width}" y2="${zeroY}" stroke="#999" stroke-width="1" />
      ${bars}
    </svg>`;
  }

  async function exportRangePdf(from, to, msgEl) {
    const trades = await window.DiarioDB.getAllTrades();
    const filtered = trades.filter((t) => t.fecha >= from && t.fecha <= to);

    if (filtered.length === 0) {
      msgEl.textContent = "No hay trades guardados en ese rango de fechas.";
      return false;
    }

    const byDate = new Map();
    for (const t of filtered) {
      if (!byDate.has(t.fecha)) byDate.set(t.fecha, []);
      byDate.get(t.fecha).push(t);
    }
    for (const list of byDate.values()) {
      list.sort((a, b) => a.createdAt - b.createdAt);
    }
    const sortedDays = Array.from(byDate.keys()).sort();

    let totalGanancias = 0;
    let totalPerdidas = 0;
    let winCount = 0;
    const dailyTotals = new Map();

    for (const day of sortedDays) {
      let dayGanancias = 0;
      let dayPerdidas = 0;
      for (const t of byDate.get(day)) {
        const monto = Number(t.monto) || 0;
        if (t.resultado === "ganancia") {
          dayGanancias += monto;
          totalGanancias += monto;
          winCount += 1;
        } else if (t.resultado === "perdida") {
          dayPerdidas += monto;
          totalPerdidas += monto;
        }
      }
      dailyTotals.set(day, { ganancias: dayGanancias, perdidas: dayPerdidas, neto: dayGanancias - dayPerdidas });
    }

    const totalTrades = filtered.length;
    const winRate = Math.round((winCount / totalTrades) * 100);
    const netoGeneral = totalGanancias - totalPerdidas;

    const chartSvg = buildDailyBarChartSvg(dailyTotals);

    const dayBlocks = [];
    const daysDescending = [...sortedDays].reverse();
    for (const day of daysDescending) {
      const dayData = dailyTotals.get(day);
      const tradeBlocks = [];
      for (const t of byDate.get(day)) {
        tradeBlocks.push(await buildTradeDetailHtml(t, { showDateAsHeading: false }));
      }
      dayBlocks.push(`
        <div style="margin-top:28px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #0f766e;padding-bottom:4px;margin-bottom:14px;">
            <h2 style="margin:0;font-size:16px;color:#111;">${formatDateHeader(day)}</h2>
            <span style="font-size:13px;color:${dayData.neto >= 0 ? "#16a34a" : "#dc2626"};font-weight:bold;">Neto del dia: ${formatMoney(dayData.neto)}</span>
          </div>
          ${tradeBlocks.join('<hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />')}
        </div>
      `);
    }
    const daysHtml = dayBlocks.join("");

    const html = `
<style>
  .print-doc { font-family: Arial, Helvetica, sans-serif; color: #111; max-width: 760px; margin: 0 auto; }
  .print-doc h1 { font-size: 20px; margin-bottom: 4px; }
  .print-doc .meta { color: #555; margin-bottom: 20px; }
  .print-doc .summary-row { display: flex; gap: 12px; flex-wrap: wrap; margin: 20px 0; }
  .print-doc .summary-card { flex: 1; min-width: 120px; border: 1px solid #ddd; border-radius: 8px; padding: 10px 14px; }
  .print-doc .summary-card span { display: block; }
  .print-doc .summary-label { font-size: 11px; color: #777; }
  .print-doc .summary-value { font-size: 18px; font-weight: bold; margin-top: 2px; }
  .print-doc .trade-block { break-inside: avoid; margin-bottom: 12px; }
</style>
<div class="print-doc" style="background:#fff;color:#111;">
  <h1>Diario de Trading — Reporte por fechas</h1>
  <div class="meta">${formatDateHeader(from)} al ${formatDateHeader(to)}</div>

  <div class="summary-row">
    <div class="summary-card"><span class="summary-label">Ganancias</span><span class="summary-value" style="color:#16a34a;">${formatMoney(totalGanancias)}</span></div>
    <div class="summary-card"><span class="summary-label">Perdidas</span><span class="summary-value" style="color:#dc2626;">${formatMoney(totalPerdidas)}</span></div>
    <div class="summary-card"><span class="summary-label">Neto</span><span class="summary-value" style="color:${netoGeneral >= 0 ? "#16a34a" : "#dc2626"};">${formatMoney(netoGeneral)}</span></div>
    <div class="summary-card"><span class="summary-label">% Aciertos</span><span class="summary-value" style="color:#111;">${winRate}%</span></div>
    <div class="summary-card"><span class="summary-label">Trades</span><span class="summary-value" style="color:#111;">${totalTrades}</span></div>
  </div>

  ${chartSvg}

  ${daysHtml}
</div>`;

    showPrintPreview(html);
    msgEl.textContent = `Listo: ${totalTrades} trade(s) en ${sortedDays.length} dia(s).`;
    return true;
  }

  function init() {
    render();
  }

  window.DiarioTab = { init, render };
})();

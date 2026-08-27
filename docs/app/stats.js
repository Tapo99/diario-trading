// ============================================================
// Pestana "Estadistica": filtro dinamico por fechas + grafica de
// dona (ganancia/perdida/equilibrio) y porcentaje de aciertos.
// ============================================================
(function () {
  const RESULTADO_COLORS = {
    ganancia: "#16a34a",
    perdida: "#dc2626",
    equilibrio: "#64748b",
  };

  const RESULTADO_LABELS = {
    ganancia: "Ganancia",
    perdida: "Perdida",
    equilibrio: "Equilibrio",
  };

  let fromDate = null;
  let toDate = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function todayStr() {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
  }

  async function computeDefaultRange() {
    const trades = await window.DiarioDB.getAllTrades();
    if (trades.length === 0) {
      const today = todayStr();
      return { from: today, to: today };
    }
    const dates = trades.map((t) => t.fecha).sort();
    return { from: dates[0], to: dates[dates.length - 1] };
  }

  async function render() {
    const root = $("#stats-root");
    root.innerHTML = "";

    if (fromDate === null || toDate === null) {
      const range = await computeDefaultRange();
      fromDate = range.from;
      toDate = range.to;
    }

    root.appendChild(renderFilterBar());

    const trades = await window.DiarioDB.getAllTrades();
    const filtered = trades.filter((t) => t.fecha >= fromDate && t.fecha <= toDate);

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No hay trades guardados en ese rango de fechas.";
      root.appendChild(empty);
      return;
    }

    const counts = { ganancia: 0, perdida: 0, equilibrio: 0 };
    let totalGanancias = 0;
    let totalPerdidas = 0;
    filtered.forEach((t) => {
      const key = t.resultado in counts ? t.resultado : "equilibrio";
      counts[key] += 1;
      const monto = Number(t.monto) || 0;
      if (t.resultado === "ganancia") totalGanancias += monto;
      if (t.resultado === "perdida") totalPerdidas += monto;
    });
    const total = filtered.length;
    const winRate = Math.round((counts.ganancia / total) * 100);

    root.appendChild(renderDonut(counts, total, winRate));
    root.appendChild(renderLegend(counts, total));
    root.appendChild(renderMoneyPanel(totalGanancias, totalPerdidas));
    root.appendChild(renderBestWorst(filtered));
  }

  function renderFilterBar() {
    const bar = document.createElement("div");
    bar.className = "stats-filter";

    const fromLabel = document.createElement("label");
    fromLabel.className = "field-label";
    fromLabel.textContent = "Desde";
    const fromInput = document.createElement("input");
    fromInput.type = "date";
    fromInput.className = "field-input";
    fromInput.value = fromDate;
    fromInput.addEventListener("change", () => {
      if (fromInput.value) fromDate = fromInput.value;
      render();
    });

    const toLabel = document.createElement("label");
    toLabel.className = "field-label";
    toLabel.textContent = "Hasta";
    const toInput = document.createElement("input");
    toInput.type = "date";
    toInput.className = "field-input";
    toInput.value = toDate;
    toInput.addEventListener("change", () => {
      if (toInput.value) toDate = toInput.value;
      render();
    });

    const fromWrap = document.createElement("div");
    fromWrap.className = "stats-filter-field";
    fromWrap.appendChild(fromLabel);
    fromWrap.appendChild(fromInput);

    const toWrap = document.createElement("div");
    toWrap.className = "stats-filter-field";
    toWrap.appendChild(toLabel);
    toWrap.appendChild(toInput);

    bar.appendChild(fromWrap);
    bar.appendChild(toWrap);

    return bar;
  }

  function renderDonut(counts, total, winRate) {
    const r = 80;
    const strokeWidth = 28;
    const circumference = 2 * Math.PI * r;

    const segments = ["ganancia", "perdida", "equilibrio"]
      .map((key) => ({ key, value: counts[key] }))
      .filter((seg) => seg.value > 0);

    let offsetAcc = 0;
    const arcs = segments
      .map((seg) => {
        const fraction = seg.value / total;
        const dash = fraction * circumference;
        const gap = circumference - dash;
        const strokeDashoffset = -offsetAcc;
        offsetAcc += dash;
        return `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${RESULTADO_COLORS[seg.key]}" stroke-width="${strokeWidth}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${strokeDashoffset}" transform="rotate(-90 100 100)" />`;
      })
      .join("");

    const wrap = document.createElement("div");
    wrap.className = "stats-donut-wrap";
    wrap.innerHTML = `
      <svg viewBox="0 0 200 200" class="stats-donut-svg">
        <circle cx="100" cy="100" r="${r}" fill="none" stroke="#1c2740" stroke-width="${strokeWidth}" />
        ${arcs}
      </svg>
      <div class="stats-donut-center">
        <span class="stats-donut-percent">${winRate}%</span>
        <span class="stats-donut-label">de aciertos</span>
      </div>
    `;
    return wrap;
  }

  function renderLegend(counts, total) {
    const wrap = document.createElement("div");
    wrap.className = "stats-legend";

    ["ganancia", "perdida", "equilibrio"].forEach((key) => {
      const count = counts[key] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const row = document.createElement("div");
      row.className = "stats-legend-row";

      const dot = document.createElement("span");
      dot.className = "stats-legend-dot";
      dot.style.background = RESULTADO_COLORS[key];

      const label = document.createElement("span");
      label.className = "stats-legend-label";
      label.textContent = RESULTADO_LABELS[key];

      const value = document.createElement("span");
      value.className = "stats-legend-value";
      value.textContent = `${count} (${pct}%)`;

      row.appendChild(dot);
      row.appendChild(label);
      row.appendChild(value);
      wrap.appendChild(row);
    });

    const totalRow = document.createElement("div");
    totalRow.className = "stats-legend-total";
    totalRow.textContent = `Total de trades en el rango: ${total}`;
    wrap.appendChild(totalRow);

    return wrap;
  }

  function formatMoney(value) {
    const sign = value < 0 ? "-" : "";
    return sign + "$" + Math.abs(value).toFixed(2);
  }

  function renderMoneyPanel(totalGanancias, totalPerdidas) {
    const neto = totalGanancias - totalPerdidas;
    const wrap = document.createElement("div");
    wrap.className = "stats-money-panel";

    const items = [
      ["Ganancias", totalGanancias, "positivo"],
      ["Perdidas", totalPerdidas, "negativo"],
      ["Neto (ganancias - perdidas)", neto, neto >= 0 ? "positivo" : "negativo"],
    ];

    items.forEach(([label, value, cls]) => {
      const card = document.createElement("div");
      card.className = "stats-money-card";
      const l = document.createElement("span");
      l.className = "stats-money-label";
      l.textContent = label;
      const v = document.createElement("span");
      v.className = "stats-money-value stats-money-" + cls;
      v.textContent = formatMoney(value);
      card.appendChild(l);
      card.appendChild(v);
      wrap.appendChild(card);
    });

    return wrap;
  }

  function renderBestWorst(filtered) {
    const wrap = document.createElement("div");
    wrap.className = "stats-bestworst";

    const mejores = filtered
      .filter((t) => t.resultado === "ganancia" && Number(t.monto) > 0)
      .sort((a, b) => Number(b.monto) - Number(a.monto))
      .slice(0, 3);

    const peores = filtered
      .filter((t) => t.resultado === "perdida" && Number(t.monto) > 0)
      .sort((a, b) => Number(b.monto) - Number(a.monto))
      .slice(0, 3);

    wrap.appendChild(renderRankingBlock("Los 3 mejores trades", mejores, "positivo"));
    wrap.appendChild(renderRankingBlock("Los 3 peores trades", peores, "negativo"));

    return wrap;
  }

  function renderRankingBlock(title, trades, cls) {
    const block = document.createElement("div");
    block.className = "stats-ranking-block";

    const h = document.createElement("h3");
    h.textContent = title;
    block.appendChild(h);

    if (trades.length === 0) {
      const empty = document.createElement("p");
      empty.className = "stats-ranking-empty";
      empty.textContent = "Sin datos suficientes en este rango.";
      block.appendChild(empty);
      return block;
    }

    const list = document.createElement("ol");
    list.className = "stats-ranking-list";

    trades.forEach((t) => {
      const li = document.createElement("li");
      const excerpt = (t.respuestas && t.respuestas.configuracion) || "";
      const excerptShort = excerpt.length > 60 ? excerpt.slice(0, 60) + "..." : excerpt;
      li.innerHTML = `
        <div class="stats-ranking-info">
          <span class="stats-ranking-date">${formatDateHeader(t.fecha)}</span>
          <span class="stats-ranking-excerpt">${escapeHtml(excerptShort)}</span>
        </div>
        <span class="stats-ranking-amount stats-money-${cls}">${formatMoney(cls === "negativo" ? -Number(t.monto) : Number(t.monto))}</span>
      `;
      list.appendChild(li);
    });

    block.appendChild(list);
    return block;
  }

  function formatDateHeader(isoDate) {
    const [y, m, d] = isoDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function init() {
    render();
  }

  window.DiarioStats = { init, render };
})();

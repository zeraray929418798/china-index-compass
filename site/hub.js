/* Hub for the seven China indices. */
(() => {
  "use strict";
  const H = window.HUB_DATA;
  if (!H) return;
  const $ = (id) => document.getElementById(id);
  const num = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(d));
  const signed = (v, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(d)}`);
  const pp = (v, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(d)}pp`);
  const color = { value: "#e3b46a", fcf: "#54b78b", dividend: "#d99a6c", soe: "#e06767", tech: "#6aa7ef", chinext: "#a897e8", star: "#55c7b2" };
  const regimeClass = (r) => r === "高估" ? "expensive" : r === "偏高" ? "rich" : r === "适中" ? "fair" : "cheap";

  function spark(vals, c) {
    if (!vals || vals.length < 2) return "";
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const w = 220, h = 48;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - (v - min) / span * h).toFixed(1)}`);
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polygon points="0,${h} ${pts.join(" ")} ${w},${h}" fill="${c}" opacity=".08"/><polyline points="${pts.join(" ")}" fill="none" stroke="${c}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
  }

  $("hubAsOf").textContent = H.as_of.replaceAll("-", ".");
  $("hubDataDate").textContent = H.as_of;
  $("hubGenerated").textContent = H.generated_at;
  $("hubBenchPe").textContent = num(H.benchmark.pe);
  $("hubBenchPb").textContent = num(H.benchmark.pb);
  $("hubBenchDy").textContent = num(H.benchmark.dy);
  $("hubBenchComp").textContent = `${Math.round(H.benchmark.composite)} / 100`;
  $("hubBenchErp").textContent = num(H.benchmark.erp);
  $("hubBenchRegime").textContent = H.benchmark.regime;
  $("hubBenchRegime").className = `regime ${regimeClass(H.benchmark.regime)}`;

  $("hubGrid").innerHTML = H.funds.map((f) => {
    const c = color[f.theme] || "#e3b46a";
    const peWord = f.pe_discount >= 0 ? "折价" : "溢价";
    return `<a class="hub-card" href="${f.href}" style="--accent:${c}">
      <div class="hub-top">
        <div><span class="hub-ticker">${f.ticker}</span><h3>${f.short}</h3><p>${f.name}</p></div>
        <span class="hub-regime ${regimeClass(f.regime)}">${f.regime}</span>
      </div>
      <div class="hub-price"><b>${num(f.close)}</b><em class="${f.change_1d >= 0 ? "up" : "down"}">${signed(f.change_1d, 2)}%</em></div>
      <div class="hub-spark">${spark(f.spark, c)}</div>
      <div class="hub-stats">
        <div class="hub-stat"><span>PE-TTM</span><b>${num(f.pe)}x</b></div>
        <div class="hub-stat"><span>PB</span><b>${num(f.pb)}x</b></div>
        <div class="hub-stat"><span>股息率</span><b>${num(f.dy)}%</b></div>
        <div class="hub-stat"><span>ERP</span><b>${num(f.erp)}%</b></div>
        <div class="hub-stat"><span>VS 300</span><b>PE ${peWord} ${Math.abs(f.pe_discount).toFixed(0)}%</b></div>
        <div class="hub-stat"><span>综合分位</span><b>${Math.round(f.composite)} / 100</b></div>
        <div class="hub-stat"><span>1Y 相对</span><b>${pp(f.relative_1y)}</b></div>
      </div>
    </a>`;
  }).join("");

  $("hubTableBody").innerHTML = H.funds.map((f) => `
    <tr>
      <td><a href="${f.href}">${f.short}</a></td>
      <td>${num(f.close)}</td><td>${num(f.pe)}x</td><td>${num(f.pb)}x</td>
      <td>${num(f.dy)}%</td><td>${num(f.erp)}%</td>
      <td>${Math.round(f.composite)} · ${f.regime}</td>
      <td>${f.pe_discount >= 0 ? "-" : "+"}${Math.abs(f.pe_discount).toFixed(0)}%</td>
      <td>${pp(f.relative_1y)}</td>
    </tr>`).join("");
})();

/* ---------------- ratio YoY + percentile zones ---------------- */
(() => {
  const H = window.HUB_DATA;
  const R = H && H.ratio;
  if (!R || !window.Chart) return;
  const $ = (id) => document.getElementById(id);
  const COLORS = { teal: "#55c7b2", gold: "#e3b46a", dim: "#6f7d8d", grid: "rgba(255,255,255,.055)" };
  const topPoints = R.series.map((r) => ({ x: Date.parse(r.d), y: r.y }));
  const fullMin = topPoints[0].x, fullMax = topPoints[topPoints.length - 1].x;
  const MIN_SPAN = 180 * 86400000;
  const state = { min: fullMin, max: fullMax, drag: null };

  Chart.defaults.font.family = "'Inter','Noto Sans SC','Segoe UI',sans-serif";
  Chart.defaults.color = COLORS.dim;
  Chart.defaults.borderColor = COLORS.grid;

  const zonePlugin = {
    id: "ratioZones",
    beforeDatasetsDraw(chart, args, opts) {
      if (opts?.p20 == null || opts?.p80 == null || !chart.chartArea) return;
      const y = chart.scales.y;
      const area = chart.chartArea;
      const p20 = y.getPixelForValue(opts.p20);
      const p80 = y.getPixelForValue(opts.p80);
      if (!Number.isFinite(p20) || !Number.isFinite(p80)) return;
      const ctx = chart.ctx;
      // opportunity below p20, fair between, danger above p80
      ctx.fillStyle = "rgba(84,183,139,.10)";
      ctx.fillRect(area.left, Math.max(area.top, p20), area.right - area.left, area.bottom - Math.max(area.top, p20));
      ctx.fillStyle = "rgba(216,193,107,.045)";
      ctx.fillRect(area.left, p80, area.right - area.left, p20 - p80);
      ctx.fillStyle = "rgba(224,103,103,.10)";
      ctx.fillRect(area.left, area.top, area.right - area.left, Math.max(0, p80 - area.top));
    },
    afterDatasetsDraw(chart, args, opts) {
      if (!chart.chartArea) return;
      const y = chart.scales.y;
      const area = chart.chartArea;
      const ctx = chart.ctx;
      const p20 = y.getPixelForValue(opts.p20);
      const p80 = y.getPixelForValue(opts.p80);
      const mean = y.getPixelForValue(opts.mean);
      // zone labels
      ctx.save();
      ctx.font = "9px 'Inter','Noto Sans SC','Segoe UI',sans-serif";
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(142,215,180,.55)";
      ctx.fillText("机会区", area.right - 7, Math.min(area.bottom - 6, p20 - 5));
      ctx.fillStyle = "rgba(216,193,107,.55)";
      ctx.fillText("适中区", area.right - 7, (p20 + p80) / 2);
      ctx.fillStyle = "rgba(243,165,165,.55)";
      ctx.fillText("危险区", area.right - 7, Math.max(area.top + 12, p80 + 13));
      if (Number.isFinite(mean) && mean >= area.top && mean <= area.bottom) {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = "rgba(227,180,106,.8)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(area.left, mean); ctx.lineTo(area.right, mean); ctx.stroke();
        ctx.setLineDash([]);
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(227,180,106,.8)";
        ctx.fillText(`均值 ${opts.mean.toFixed(1)}%`, area.left + 7, Math.max(area.top + 10, mean - 5));
      }
      ctx.restore();
    },
  };
  Chart.register(zonePlugin);

  const xTicks = {
    color: COLORS.dim, maxTicksLimit: 8, maxRotation: 0, autoSkip: true,
    font: { family: "'Bahnschrift','DIN Alternate','Segoe UI',sans-serif", size: 9 },
    callback: (v) => {
      const span = state.max - state.min;
      const d = new Date(v);
      return span < 2.2 * 365 * 86400000 ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : String(d.getFullYear());
    },
  };
  const xScale = () => ({
    type: "linear", min: state.min, max: state.max,
    grid: { color: COLORS.grid, drawTicks: false }, border: { display: false },
    ticks: xTicks,
  });

  const ratioChart = new Chart($("ratioChart"), {
    type: "line",
    data: { datasets: [{
      label: "比值同比", data: topPoints, borderColor: COLORS.teal,
      backgroundColor: "rgba(85,199,178,.06)", borderWidth: 1.8, pointRadius: 0,
      pointHitRadius: 8, tension: .16, fill: false,
    }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "nearest", intersect: false },
      layout: { padding: { top: 8, right: 10, left: 0, bottom: 0 } },
      plugins: {
        legend: { display: false },
        ratioZones: { p20: R.p20, p80: R.p80, mean: R.mean },
        tooltip: {
          backgroundColor: "rgba(8,13,19,.96)", borderColor: "rgba(255,255,255,.12)", borderWidth: 1,
          padding: 10, displayColors: false, titleColor: "#e9eef5", bodyColor: "#a7b5c5",
          titleFont: { size: 10, weight: "600" }, bodyFont: { size: 10 },
          callbacks: {
            title: (items) => (items.length ? new Date(items[0].parsed.x).toISOString().slice(0, 10) : ""),
            label: (ctx) => `  同比  ${ctx.parsed.y >= 0 ? "+" : ""}${ctx.parsed.y.toFixed(2)}%`,
          },
        },
      },
      scales: {
        x: xScale(),
        y: { position: "right", grace: "8%", grid: { color: COLORS.grid, drawTicks: false }, border: { display: false },
          ticks: { color: COLORS.dim, padding: 8, maxTicksLimit: 6, font: { size: 9 }, callback: (v) => `${Number(v).toFixed(0)}%` } },
      },
    },
  });

  function applyRange() {
    ratioChart.options.scales.x.min = state.min;
    ratioChart.options.scales.x.max = state.max;
    ratioChart.update("none");
  }

  function clampRange(min, max) {
    let span = Math.max(MIN_SPAN, Math.min(fullMax - fullMin, max - min));
    if (min < fullMin) { min = fullMin; max = min + span; }
    if (max > fullMax) { max = fullMax; min = max - span; }
    return { min, max };
  }

  function zoomAt(evt, factor) {
    const rect = ratioChart.canvas.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width));
    const span = state.max - state.min;
    const anchor = state.min + span * frac;
    const next = clampRange(anchor - span * factor * frac, anchor + span * factor * (1 - frac));
    state.min = next.min; state.max = next.max;
    applyRange();
  }

  ratioChart.canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(e, e.deltaY > 0 ? 1.22 : .82);
  }, { passive: false });
  ratioChart.canvas.addEventListener("pointerdown", (e) => {
    state.drag = { x: e.clientX, min: state.min, max: state.max };
    ratioChart.canvas.setPointerCapture(e.pointerId);
  });
  ratioChart.canvas.addEventListener("pointermove", (e) => {
    if (!state.drag) return;
    const rect = ratioChart.canvas.getBoundingClientRect();
    const dx = (e.clientX - state.drag.x) / rect.width * (state.drag.max - state.drag.min);
    const next = clampRange(state.drag.min - dx, state.drag.max - dx);
    state.min = next.min; state.max = next.max;
    applyRange();
  });
  ratioChart.canvas.addEventListener("pointerup", () => { state.drag = null; });
  ratioChart.canvas.addEventListener("pointercancel", () => { state.drag = null; });
  ratioChart.canvas.addEventListener("dblclick", () => {
    state.min = fullMin; state.max = fullMax; applyRange();
  });

  const zone = R.pct <= 20 ? "机会区" : R.pct >= 80 ? "危险区" : "适中区";
  $("ratioRead").textContent = `${R.current_yoy >= 0 ? "+" : ""}${R.current_yoy.toFixed(1)}%`;
  $("ratioPill").textContent = `${R.pct.toFixed(0)}% 分位 · ${zone}`;
  $("ratioRangeText").textContent = `机会 ≤ ${R.p20.toFixed(1)}% · 危险 ≥ ${R.p80.toFixed(1)}% · 均值 ${R.mean.toFixed(1)}%`;
  $("ratioFoot").textContent = `创业板指 / 中证红利 · 当前比值 ${R.current_ratio.toFixed(3)} · 同比 ${R.current_yoy >= 0 ? "+" : ""}${R.current_yoy.toFixed(2)}% · ${R.pct.toFixed(1)}% 分位 · 数据截至 ${R.as_of}`;
})();

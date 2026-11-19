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

/* ---------------- ratio YoY + weekly MACD ---------------- */
(() => {
  const H = window.HUB_DATA;
  const R = H && H.ratio;
  if (!R || !window.Chart) return;
  const $ = (id) => document.getElementById(id);
  const COLORS = { teal: "#55c7b2", blue: "#6aa7ef", gold: "#e3b46a", red: "#e06767", green: "#54b78b", dim: "#6f7d8d", grid: "rgba(255,255,255,.055)" };
  const fmtDate = (v) => new Date(v).toISOString().slice(0, 10);
  const topPoints = R.series.map((r) => ({ x: Date.parse(r.d), y: r.y }));
  const macd = R.macd.map((r) => ({ x: Date.parse(r.d), dif: r.dif, dea: r.dea, hist: r.hist }));
  const fullMin = topPoints[0].x, fullMax = topPoints[topPoints.length - 1].x;
  const MIN_SPAN = 180 * 86400000;
  const state = { min: fullMin, max: fullMax, drag: null };

  Chart.defaults.font.family = "'Inter','Noto Sans SC','Segoe UI',sans-serif";
  Chart.defaults.color = COLORS.dim;
  Chart.defaults.borderColor = COLORS.grid;

  const bandPlugin = {
    id: "ratioBand",
    beforeDatasetsDraw(chart, args, opts) {
      if (opts?.p20 == null || opts?.p80 == null || !chart.chartArea) return;
      const y = chart.scales.y;
      const area = chart.chartArea;
      const top = y.getPixelForValue(opts.p80);
      const bottom = y.getPixelForValue(opts.p20);
      if (!Number.isFinite(top) || !Number.isFinite(bottom)) return;
      chart.ctx.fillStyle = "rgba(85,199,178,.075)";
      chart.ctx.fillRect(area.left, Math.min(top, bottom), area.right - area.left, Math.abs(bottom - top));
    },
    afterDatasetsDraw(chart, args, opts) {
      if (opts?.mean == null || !chart.chartArea) return;
      const y = chart.scales.y.getPixelForValue(opts.mean);
      const area = chart.chartArea;
      if (!Number.isFinite(y) || y < area.top || y > area.bottom) return;
      chart.ctx.save();
      chart.ctx.setLineDash([5, 5]);
      chart.ctx.strokeStyle = "rgba(227,180,106,.85)";
      chart.ctx.lineWidth = 1.3;
      chart.ctx.beginPath(); chart.ctx.moveTo(area.left, y); chart.ctx.lineTo(area.right, y); chart.ctx.stroke();
      chart.ctx.fillStyle = "rgba(227,180,106,.85)";
      chart.ctx.font = "9px 'Bahnschrift','Segoe UI',sans-serif";
      chart.ctx.fillText(`均值 ${opts.mean.toFixed(1)}%`, area.left + 6, Math.max(area.top + 10, y - 5));
      chart.ctx.restore();
    },
  };
  Chart.register(bandPlugin);

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
  const baseTooltip = (formatter) => ({
    backgroundColor: "rgba(8,13,19,.96)", borderColor: "rgba(255,255,255,.12)", borderWidth: 1,
    padding: 10, displayColors: false, titleColor: "#e9eef5", bodyColor: "#a7b5c5",
    titleFont: { size: 10, weight: "600" }, bodyFont: { size: 10 },
    callbacks: { title: (items) => (items.length ? fmtDate(items[0].parsed.x) : ""), label: formatter },
  });

  const ratioChart = new Chart($("ratioChart"), {
    type: "line",
    data: { datasets: [{
      label: "比值同比", data: topPoints, borderColor: COLORS.teal,
      backgroundColor: "rgba(85,199,178,.08)", borderWidth: 1.8, pointRadius: 0,
      pointHitRadius: 8, tension: .16, fill: true,
    }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "nearest", intersect: false },
      layout: { padding: { top: 8, right: 6, left: 0, bottom: 0 } },
      plugins: {
        legend: { display: false },
        ratioBand: { p20: R.p20, p80: R.p80, mean: R.mean },
        tooltip: baseTooltip((ctx) => `  同比  ${ctx.parsed.y >= 0 ? "+" : ""}${ctx.parsed.y.toFixed(2)}%`),
      },
      scales: {
        x: xScale(),
        y: { position: "right", grace: "8%", grid: { color: COLORS.grid, drawTicks: false }, border: { display: false },
          ticks: { color: COLORS.dim, padding: 8, maxTicksLimit: 6, font: { size: 9 }, callback: (v) => `${Number(v).toFixed(0)}%` } },
      },
    },
  });

  const macdChart = new Chart($("macdChart"), {
    data: {
      datasets: [
        { type: "bar", label: "HIST", data: macd.map((r) => ({ x: r.x, y: r.hist })), backgroundColor: macd.map((r) => r.hist >= 0 ? "rgba(224,103,103,.48)" : "rgba(84,183,139,.48)"), borderWidth: 0, barPercentage: .72 },
        { type: "line", label: "DIF", data: macd.map((r) => ({ x: r.x, y: r.dif })), borderColor: COLORS.gold, borderWidth: 1.4, pointRadius: 0, tension: .15 },
        { type: "line", label: "DEA", data: macd.map((r) => ({ x: r.x, y: r.dea })), borderColor: COLORS.blue, borderWidth: 1.4, pointRadius: 0, tension: .15 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "nearest", intersect: false },
      layout: { padding: { top: 0, right: 6, left: 0, bottom: 0 } },
      plugins: { legend: { display: false }, tooltip: baseTooltip((ctx) => `  ${ctx.dataset.label}  ${Number(ctx.parsed.y).toFixed(3)}`) },
      scales: {
        x: xScale(),
        y: { position: "right", grid: { color: COLORS.grid, drawTicks: false }, border: { display: false },
          ticks: { color: COLORS.dim, padding: 6, maxTicksLimit: 4, font: { size: 9 }, callback: (v) => Number(v).toFixed(1) } },
      },
    },
  });

  function applyRange() {
    ratioChart.options.scales.x.min = state.min;
    ratioChart.options.scales.x.max = state.max;
    macdChart.options.scales.x.min = state.min;
    macdChart.options.scales.x.max = state.max;
    ratioChart.update("none");
    macdChart.update("none");
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

  function attach(canvas) {
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomAt(e, e.deltaY > 0 ? 1.22 : .82);
    }, { passive: false });
    canvas.addEventListener("pointerdown", (e) => {
      state.drag = { x: e.clientX, min: state.min, max: state.max };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!state.drag) return;
      const rect = canvas.getBoundingClientRect();
      const dx = (e.clientX - state.drag.x) / rect.width * (state.drag.max - state.drag.min);
      const next = clampRange(state.drag.min - dx, state.drag.max - dx);
      state.min = next.min; state.max = next.max;
      applyRange();
    });
    canvas.addEventListener("pointerup", () => { state.drag = null; });
    canvas.addEventListener("pointercancel", () => { state.drag = null; });
    canvas.addEventListener("dblclick", () => {
      state.min = fullMin; state.max = fullMax; applyRange();
    });
  }
  attach(ratioChart.canvas);
  attach(macdChart.canvas);

  const last = R.macd[R.macd.length - 1] || { dif: 0, dea: 0, hist: 0 };
  $("ratioRead").textContent = `${R.current_yoy >= 0 ? "+" : ""}${R.current_yoy.toFixed(1)}%`;
  $("ratioPill").textContent = `比值 ${R.current_ratio.toFixed(3)}`;
  $("ratioRangeText").textContent = `20–80 分位 ${R.p20.toFixed(1)}% / ${R.p80.toFixed(1)}% · 均值 ${R.mean.toFixed(1)}%`;
  $("ratioFoot").textContent = `创业板指 / 中证红利 · 当前比值 ${R.current_ratio.toFixed(3)} · 同比 ${R.current_yoy >= 0 ? "+" : ""}${R.current_yoy.toFixed(2)}% · 数据截至 ${R.as_of}`;
  $("macdDif").textContent = last.dif.toFixed(3);
  $("macdDea").textContent = last.dea.toFixed(3);
  $("macdHist").textContent = last.hist.toFixed(3);
})();

/* China index valuation terminal — shared page app. */
(() => {
  "use strict";

  const CFG = window.PAGE_CONFIG || {};
  const D = window.INDEX_DATA;
  if (!D) return;

  const $ = (id) => document.getElementById(id);
  const NUM = "'Bahnschrift','DIN Alternate','Aptos Display','Segoe UI',sans-serif";
  const FONT = "'Inter','Noto Sans SC','Segoe UI',sans-serif";
  const COLORS = {
    gold: "#e3b46a", blue: "#6aa7ef", teal: "#55c7b2",
    green: "#54b78b", red: "#e06767", amber: "#dd9159",
    purple: "#a897e8", dim: "#6f7d8d", grid: "rgba(255,255,255,.055)",
    text: "#e9eef5",
  };
  const num = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(d));
  const signed = (v, d = 1) => (v == null || Number.isNaN(Number(v)) ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(d)}`);
  const pctSign = (v, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(d)}%`);
  const pp = (v, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(d)}pp`);
  const discountText = (v, d = 1) => (v == null ? "—" : `${v >= 0 ? "-" : "+"}${Math.abs(v).toFixed(d)}%`);

  const charts = {};
  let allLabels = [];
  let perfData = [];
  let view = { start: 0, end: 0 };
  let drag = null;

  const PALETTE = {
    value: "#e3b46a", fcf: "#54b78b", dividend: "#d99a6c", soe: "#e06767",
    tech: "#6aa7ef", chinext: "#a897e8", star: "#55c7b2", benchmark: "#8b9bb0",
  };

  function applyPageConfig() {
    const theme = CFG.theme || "value";
    document.body.dataset.theme = theme;
    const accent = PALETTE[theme] || COLORS.gold;
    document.documentElement.style.setProperty("--accent-live", accent);
    COLORS.gold = accent;
    $("heroEyebrow").textContent = CFG.eyebrow || "";
    $("heroTitle").innerHTML = CFG.hero_title || "";
    $("heroLede").innerHTML = CFG.hero_lede || "";
    $("priceHead").textContent = CFG.price_head || "价格，是结果不是原因";
    $("priceSub").textContent = CFG.price_sub || "";
    $("valHead").textContent = CFG.val_head || "估值，历史的刻度";
    $("valSub").textContent = CFG.val_sub || "";
    $("incomeHead").textContent = CFG.income_head || "股息，现金回报的刻度";
    $("incomeSub").textContent = CFG.income_sub || "";
    $("topDate").textContent = D.meta.as_of.replaceAll("-", ".");
    document.title = `${D.meta.short} · 指数估值罗盘 | CHINA INDEX LAB`;
    document.querySelector(".etf-nav a.is-active")?.classList.remove("is-active");
    document.querySelector(`.etf-nav a[data-ticker="${CFG.ticker}"]`)?.classList.add("is-active");
    $("footerTicker").textContent = `${D.meta.short} · ${D.meta.code}`;
    $("dataStart").textContent = D.meta.data_start;
    $("compareDate").textContent = D.meta.as_of;
    $("csvLink").href = CFG.csv || "#";
    document.documentElement.style.setProperty("--chart-accent", accent);
  }

  /* ---------------- formatters / helpers ---------------- */
  function nearestChange(key, lookback) {
    const arr = D.series;
    if (!arr || arr.length <= lookback) return null;
    const last = arr[arr.length - 1][key];
    const prev = arr[arr.length - 1 - lookback][key];
    if (last == null || prev == null || prev === 0) return null;
    return (last / prev - 1) * 100;
  }

  function sparkline(key, color) {
    const pts = D.series.map((r) => r[key]).filter((v) => v != null).slice(-90);
    if (pts.length < 2) return "";
    const min = Math.min(...pts), max = Math.max(...pts);
    const span = max - min || 1;
    const w = 220, h = 46;
    const coords = pts.map((v, i) => `${(i / (pts.length - 1) * w).toFixed(1)},${(h - (v - min) / span * h).toFixed(1)}`);
    const area = `0,${h} ${coords.join(" ")} ${w},${h}`;
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polygon points="${area}" fill="${color}" opacity=".09"/><polyline points="${coords.join(" ")}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
  }

  /* ---------------- gauge ---------------- */
  function drawGauge(score) {
    const canvas = $("gauge");
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 360, h = 230;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = 180, r = Math.min(w * .38, 132);
    const start = Math.PI, end = 0;
    const segments = [[0, 20, "#54b78b"], [20, 40, "#7fc79b"], [40, 60, "#d9c16b"], [60, 80, "#dd9159"], [80, 100, "#e06767"]];
    segments.forEach(([a, b, color]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, start + Math.PI * a / 100, start + Math.PI * b / 100);
      ctx.strokeStyle = color; ctx.lineWidth = 12; ctx.lineCap = "butt"; ctx.stroke();
    });
    const angle = start + Math.PI * Math.max(0, Math.min(100, score)) / 100;
    const nx = cx + Math.cos(angle) * (r - 22), ny = cy + Math.sin(angle) * (r - 22);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny);
    ctx.strokeStyle = "#f4f7fa"; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fillStyle = "#e9eef5"; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fillStyle = "#111923"; ctx.fill();
    $("gaugeScore").textContent = Math.round(score);
    $("gaugeRegime").textContent = D.current.regime;
    $("gaugeRegime").className = `regime ${D.current.regime_en || ""}`;
    $("gaugeNote").textContent = `${D.meta.short} 的 PE、PB、ERP 三项历史分位等权后，位于 ${Math.round(score)} / 100。`;
  }

  /* ---------------- hero / ticker / cards ---------------- */
  function renderHero() {
    const C = D.current;
    $("heroPrice").textContent = num(C.close);
    const up = C.change_1d >= 0;
    $("heroChange").textContent = `${up ? "+" : ""}${num(C.change_1d)}%`;
    $("heroChange").className = `change-chip ${up ? "up" : "down"}`;
    $("heroMeta").innerHTML = [
      `<span>代码 <b>${D.meta.code}</b></span>`,
      `<span>估值起点 <b>${D.meta.valuation_start}</b></span>`,
      `<span>观测 <b>${D.meta.observations}</b> 日</span>`,
    ].join("");
    $("rangeText").textContent = `52周 ${num(C.low_52w)} – ${num(C.high_52w)}`;
    const pos = Math.max(0, Math.min(100, (C.close - C.low_52w) / Math.max(C.high_52w - C.low_52w, 1e-9) * 100));
    $("rangeFill").style.width = `${pos}%`;
    $("rangeDot").style.left = `${pos}%`;
    drawGauge(C.composite);

    $("tickPe").textContent = `${num(C.pe)}x`;
    $("tickPePct").textContent = `${num(C.pe_pct, 0)}% 分位`;
    $("tickPb").textContent = `${num(C.pb)}x`;
    $("tickPbPct").textContent = `${num(C.pb_pct, 0)}% 分位`;
    $("tickDy").textContent = `${num(C.dy)}%`;
    $("tickDyPct").textContent = `${num(C.dy_pct, 0)}% 分位`;
    $("tickErp").textContent = `${num(C.erp)}%`;
    $("tickErpPct").textContent = `10Y ${num(C.ust10y)}%`;
    $("tickVs300").textContent = discountText(D.comparison.pe_discount, 1);
    $("tickVsLabel").textContent = `PE ${D.comparison.pe_discount >= 0 ? "折价" : "溢价"}`;
  }

  function renderCards() {
    const C = D.current, cmp = D.comparison;
    const cards = [
      {
        label: "PRICE / 收盘", value: num(C.close), small: "", sub: `52周 ${num(C.low_52w)} – ${num(C.high_52w)}`,
        foot: "1D", footVal: pctSign(C.change_1d), color: COLORS.gold, spark: "c",
      },
      {
        label: "PE-TTM", value: num(C.pe), small: "x", sub: `历史 <b>${num(C.pe_pct, 0)}%</b> 分位 · 中位 ${num(C.pe_median)}x`,
        foot: "1M", footVal: pctSign(nearestChange("pe", 21)), color: COLORS.gold, spark: "pe",
      },
      {
        label: "PB", value: num(C.pb), small: "x", sub: `历史 <b>${num(C.pb_pct, 0)}%</b> 分位 · 中位 ${num(C.pb_median, 3)}x`,
        foot: "1M", footVal: pctSign(nearestChange("pb", 21)), color: COLORS.blue, spark: "pb",
      },
      {
        label: "DIVIDEND YIELD", value: num(C.dy), small: "%", sub: `历史 <b>${num(C.dy_pct, 0)}%</b> 分位 · 沪深300 ${num(D.benchmark.dy)}%`,
        foot: "利差", footVal: pp(cmp.dy_spread), color: COLORS.teal, spark: null,
      },
      {
        label: "ERP / 风险溢价", value: num(C.erp), small: "%", sub: `10Y <b>${num(C.ust10y)}%</b> · ${num(C.erp_pct, 0)}% 分位`,
        foot: "利差", footVal: pp(cmp.erp_spread), color: COLORS.red, spark: "erp",
      },
      {
        label: "VS 沪深300", value: num(Math.abs(cmp.pe_discount), 0), small: "%",
        sub: `PE ${cmp.pe_discount >= 0 ? "折价" : "溢价"} · 1Y 相对 <b>${pp(cmp.relative_1y)}</b>`,
        foot: "相对分位", footVal: `${num(cmp.relative_pct, 1)}%`, color: COLORS.amber, spark: "rel",
      },
    ];
    $("metricCards").innerHTML = cards.map((c) => `
      <article class="metric-card reveal" style="--accent:${c.color}">
        <div class="mc-top"><span class="mc-label">${c.label}</span><span class="mc-dot"></span></div>
        <div class="mc-value">${c.value}${c.small ? `<small>${c.small}</small>` : ""}</div>
        <div class="mc-sub">${c.sub}</div>
        ${c.spark ? `<div class="mc-spark">${sparkline(c.spark, c.color)}</div>` : `<div class="mc-spark empty"></div>`}
        <div class="mc-foot"><span>${c.foot}</span><b class="${String(c.footVal).startsWith("+") ? "up" : String(c.footVal).startsWith("-") ? "down" : ""}">${c.footVal}</b></div>
      </article>`).join("");
  }

  /* ---------------- compass / insights ---------------- */
  function renderCompass() {
    const C = D.current;
    const rows = [
      { label: "PE-TTM", raw: `${num(C.pe)}x`, exp: C.pe_pct },
      { label: "PB", raw: `${num(C.pb)}x`, exp: C.pb_pct },
      { label: "股息率", raw: `${num(C.dy)}%`, exp: 100 - C.dy_pct },
      { label: "风险溢价", raw: `${num(C.erp)}%`, exp: 100 - C.erp_pct },
      { label: "综合", raw: `${Math.round(C.composite)} / 100`, exp: C.composite },
    ];
    const verdict = (v) => v >= 80 ? "高估" : v >= 60 ? "偏高" : v >= 40 ? "适中" : v >= 20 ? "低估" : "深度低估";
    $("compassList").innerHTML = rows.map((r) => `
      <div class="compass-row">
        <div class="cr-label"><b>${r.label}</b><span>${r.raw}</span></div>
        <div class="cr-track" style="--p:${r.exp}">
          <span class="cr-tick" style="left:20%"></span><span class="cr-tick" style="left:40%"></span>
          <span class="cr-tick" style="left:60%"></span><span class="cr-tick" style="left:80%"></span>
          <span class="cr-marker" style="left:${r.exp}%"></span>
        </div>
        <div class="cr-value"><b>${Math.round(r.exp)}</b><small>% 昂贵度</small><em>${verdict(r.exp)}</em></div>
      </div>`).join("");
    $("compassFoot").textContent = `综合估值 ${Math.round(C.composite)} / 100 · ${C.regime}`;
  }

  function renderInsights() {
    $("insightStack").innerHTML = D.insights.map((x) => `
      <article class="insight-card ${x.tone || ""} reveal">
        <span class="insight-tag">${x.tag}</span>
        <h3>${x.title}</h3>
        <p>${x.body}</p>
      </article>`).join("");
  }

  /* ---------------- charts ---------------- */
  const bandsPlugin = {
    id: "bands",
    beforeDatasetsDraw(chart, args, opts) {
      const values = opts?.values;
      const area = chart.chartArea;
      if (!values || !area || values.some((v) => v == null)) return;
      const y = chart.scales.y;
      const colors = ["rgba(84,183,139,.115)", "rgba(127,199,155,.075)", "rgba(255,255,255,.018)", "rgba(221,145,89,.075)", "rgba(224,103,103,.105)"];
      const stops = [-Infinity, ...values, Infinity];
      for (let i = 0; i < 5; i++) {
        const top = i === 0 ? area.top : y.getPixelForValue(stops[i]);
        const bottom = i === 4 ? area.bottom : y.getPixelForValue(stops[i + 1]);
        if (Number.isFinite(top) && Number.isFinite(bottom)) {
          chart.ctx.fillStyle = colors[i];
          chart.ctx.fillRect(area.left, Math.min(top, bottom), area.right - area.left, Math.abs(bottom - top));
        }
      }
    },
    afterDatasetsDraw(chart, args, opts) {
      const median = opts?.median;
      if (median == null || !chart.chartArea) return;
      const y = chart.scales.y.getPixelForValue(median);
      const area = chart.chartArea;
      if (!Number.isFinite(y) || y < area.top || y > area.bottom) return;
      chart.ctx.save();
      chart.ctx.setLineDash([4, 4]);
      chart.ctx.strokeStyle = "rgba(255,255,255,.28)";
      chart.ctx.lineWidth = 1;
      chart.ctx.beginPath(); chart.ctx.moveTo(area.left, y); chart.ctx.lineTo(area.right, y); chart.ctx.stroke();
      chart.ctx.restore();
    },
  };
  Chart.register(bandsPlugin);

  function baseOptions(fmt = (v) => v, category = true) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 8, right: 4, left: 0, bottom: 0 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(8,13,19,.96)", borderColor: "rgba(255,255,255,.12)", borderWidth: 1,
          padding: 10, displayColors: false, titleColor: COLORS.text, bodyColor: "#a7b5c5",
          titleFont: { family: FONT, size: 10, weight: "600" }, bodyFont: { family: NUM, size: 10 },
          callbacks: { label: (ctx) => `  ${fmt(ctx.raw)}` },
        },
      },
      scales: {
        x: category ? {
          type: "category", grid: { display: false }, border: { display: false },
          ticks: { color: COLORS.dim, maxTicksLimit: 7, maxRotation: 0, autoSkip: true, font: { family: NUM, size: 9 } },
        } : {
          type: "linear", grid: { display: false }, border: { display: false },
          ticks: { color: COLORS.dim, maxTicksLimit: 6, font: { family: NUM, size: 9 }, callback: (v) => new Date(v).getFullYear() },
        },
        y: {
          position: "right", grace: "7%", grid: { color: COLORS.grid, drawTicks: false }, border: { display: false },
          ticks: { color: COLORS.dim, padding: 8, maxTicksLimit: 6, font: { family: NUM, size: 9 }, callback: (v) => fmt(v) },
        },
      },
    };
  }

  function lineDataset(data, color, label, fill = false) {
    return {
      label, data, borderColor: color, backgroundColor: fill ? color + "1f" : "transparent",
      borderWidth: 1.8, tension: 0.16, pointRadius: 0, pointHitRadius: 8, fill,
    };
  }

  function buildCharts() {
    Chart.defaults.font.family = FONT;
    Chart.defaults.color = COLORS.dim;
    Chart.defaults.borderColor = COLORS.grid;
    allLabels = D.series.map((r) => r.d);
    const close = D.series.map((r) => r.c);
    const pe = D.series.map((r) => r.pe);
    const pb = D.series.map((r) => r.pb);
    const erp = D.series.map((r) => r.erp);
    const rel = D.series.map((r) => r.rel);

    charts.price = new Chart($("priceChart"), {
      type: "line", data: { labels: allLabels, datasets: [lineDataset(close, COLORS.gold, "收盘", true)] },
      options: baseOptions((v) => num(v, 0)),
    });

    const peOpts = baseOptions((v) => `${num(v, 1)}x`);
    peOpts.plugins.bands = { values: D.bands.pe, median: D.current.pe_median };
    charts.pe = new Chart($("peChart"), {
      type: "line", data: { labels: allLabels, datasets: [lineDataset(pe, COLORS.gold, "PE-TTM", true)] },
      options: peOpts,
    });

    const pbOpts = baseOptions((v) => `${num(v, 2)}x`);
    pbOpts.plugins.bands = { values: D.bands.pb, median: D.current.pb_median };
    charts.pb = new Chart($("pbChart"), {
      type: "line", data: { labels: allLabels, datasets: [lineDataset(pb, COLORS.blue, "PB", true)] },
      options: pbOpts,
    });

    const erpOpts = baseOptions((v) => `${num(v, 1)}%`);
    erpOpts.plugins.bands = { values: D.bands.erp, median: D.current.erp_median };
    charts.erp = new Chart($("erpChart"), {
      type: "line", data: { labels: allLabels, datasets: [lineDataset(erp, COLORS.red, "ERP", true)] },
      options: erpOpts,
    });

    // Relative performance: both series normalized from the common start.
    const benchMap = new Map(D.bench_series.map((r) => [r.d, r.c]));
    const common = D.comparison.common_start;
    let baseSelf = null, baseBench = null;
    perfData = D.series.map((r) => {
      const b = benchMap.get(r.d);
      if (b == null) return { d: r.d, self: null, bench: null };
      if (baseSelf == null) baseSelf = r.c;
      if (baseBench == null) baseBench = b;
      return { d: r.d, self: r.c / baseSelf * 100, bench: b / baseBench * 100 };
    }).filter((r) => r.d >= common);
    charts.perf = new Chart($("perfChart"), {
      type: "line",
      data: { labels: perfData.map((r) => r.d), datasets: [
        lineDataset(perfData.map((r) => r.self), COLORS.gold, "指数"),
        lineDataset(perfData.map((r) => r.bench), COLORS.blue, "沪深300"),
      ] },
      options: baseOptions((v) => num(v, 0)),
    });

    charts.rel = new Chart($("relChart"), {
      type: "line", data: { labels: allLabels, datasets: [lineDataset(rel, COLORS.teal, "相对强弱", true)] },
      options: baseOptions((v) => num(v, 1)),
    });
  }

  function applyView(start, end) {
    const last = allLabels.length - 1;
    start = Math.max(0, Math.min(start, last - 2));
    end = Math.max(start + 2, Math.min(end, last));
    view = { start, end };
    const idxs = [];
    for (let i = start; i <= end; i++) idxs.push(i);
    const slice = (arr) => idxs.map((i) => arr[i]);
    const first = allLabels[start], lastDate = allLabels[end];
    charts.price.data.labels = slice(allLabels); charts.price.data.datasets[0].data = slice(D.series.map((r) => r.c));
    charts.pe.data.labels = slice(allLabels); charts.pe.data.datasets[0].data = slice(D.series.map((r) => r.pe));
    charts.pb.data.labels = slice(allLabels); charts.pb.data.datasets[0].data = slice(D.series.map((r) => r.pb));
    charts.erp.data.labels = slice(allLabels); charts.erp.data.datasets[0].data = slice(D.series.map((r) => r.erp));
    charts.rel.data.labels = slice(allLabels); charts.rel.data.datasets[0].data = slice(D.series.map((r) => r.rel));
    const perfRows = perfData.filter((r) => r.d >= first && r.d <= lastDate);
    charts.perf.data.labels = perfRows.map((r) => r.d);
    charts.perf.data.datasets[0].data = perfRows.map((r) => r.self);
    charts.perf.data.datasets[1].data = perfRows.map((r) => r.bench);
    Object.values(charts).forEach((c) => c.update("none"));
  }

  function clearRangeActive() {
    document.querySelectorAll("#rangeTabs button").forEach((b) => b.classList.remove("is-active"));
  }

  function setPreset(range) {
    const endTs = new Date(allLabels[allLabels.length - 1]).getTime();
    const years = range === "1y" ? 1 : range === "3y" ? 3 : range === "5y" ? 5 : 0;
    let start = 0;
    if (range !== "all") {
      const cutoff = endTs - years * 365.25 * 86400000;
      const found = allLabels.findIndex((d) => new Date(d).getTime() >= cutoff);
      start = found < 0 ? 0 : found;
    }
    applyView(start, allLabels.length - 1);
  }

  function attachZoom(canvas) {
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const span = view.end - view.start;
      const rect = canvas.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const nextSpan = Math.max(20, Math.min(allLabels.length - 1, Math.round(span * (e.deltaY > 0 ? 1.22 : 0.82))));
      const anchor = view.start + span * frac;
      let start = Math.round(anchor - nextSpan * frac);
      start = Math.max(0, Math.min(start, allLabels.length - 1 - nextSpan));
      applyView(start, start + nextSpan);
      clearRangeActive();
    }, { passive: false });

    canvas.addEventListener("pointerdown", (e) => {
      drag = { x: e.clientX, start: view.start, end: view.end };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const span = drag.end - drag.start;
      const rect = canvas.getBoundingClientRect();
      const shift = Math.round((e.clientX - drag.x) / rect.width * span);
      applyView(drag.start - shift, drag.end - shift);
      clearRangeActive();
    });
    canvas.addEventListener("pointerup", () => { drag = null; });
    canvas.addEventListener("pointercancel", () => { drag = null; });
    canvas.addEventListener("dblclick", () => {
      applyView(0, allLabels.length - 1);
      clearRangeActive();
      document.querySelector('#rangeTabs button[data-range="all"]')?.classList.add("is-active");
    });
  }

  /* ---------------- price / valuation copies ---------------- */
  function renderChartCopy() {
    const C = D.current, cmp = D.comparison;
    $("priceRead").textContent = num(C.close);
    $("pricePill").textContent = pctSign(C.change_1d);
    $("pricePill").className = `pill ${C.change_1d >= 0 ? "tone-red" : "tone-green"}`;
    $("priceLegend").textContent = D.meta.short;
    $("priceFoot").textContent = `${D.meta.short} · 年化 ${signed(C.cagr, 1)}% · 波动 ${num(C.vol, 1)}% · 最大回撤 ${num(C.max_drawdown, 1)}%`;
    $("peRead").textContent = `${num(C.pe)}x`;
    $("pePill").textContent = `${num(C.pe_pct, 0)}% 分位`;
    $("peFoot").textContent = `历史中位 ${num(C.pe_median)}x · 20/80 分位 ${num(D.bands.pe[0])}x / ${num(D.bands.pe[3])}x`;
    $("pbRead").textContent = `${num(C.pb)}x`;
    $("pbPill").textContent = `${num(C.pb_pct, 0)}% 分位`;
    $("pbFoot").textContent = `历史中位 ${num(C.pb_median, 3)}x · 当前 ${num(C.pb)}x`;
    $("erpRead").textContent = `${num(C.erp)}%`;
    $("erpPill").textContent = `${num(C.erp_pct, 0)}% 分位`;
    $("erpFoot").textContent = `历史中位 ${num(C.erp_median)}% · 10年期国债 ${num(C.ust10y)}%`;
    $("ust10y").textContent = `${num(C.ust10y)}%`;
    $("perfRead").textContent = pp(cmp.relative_since);
    $("perfPill").textContent = "累计相对";
    $("perfLegend").textContent = D.meta.short;
    $("perfFoot").textContent = `${D.meta.short} ${pp(cmp.return_1y)} vs 沪深300 ${pp(cmp.bench_return_1y)} · 共同起点 ${cmp.common_start}`;
    $("relRead").textContent = num(D.series[D.series.length - 1].rel, 1);
    $("relPill").textContent = `历史 ${num(cmp.relative_pct, 1)}% 分位`;
    $("relTicker").textContent = D.meta.short;
    $("perfTicker").textContent = D.meta.short;
  }

  /* ---------------- benchmark comparison ---------------- */
  function renderCompare() {
    const C = D.current, B = D.benchmark, cmp = D.comparison;
    const rows = [
      { name: "PE-TTM", self: `${num(C.pe)}x`, bench: `${num(B.pe)}x`, delta: discountText(cmp.pe_discount), good: cmp.pe_discount >= 0 },
      { name: "PB", self: `${num(C.pb)}x`, bench: `${num(B.pb)}x`, delta: discountText(cmp.pb_discount), good: cmp.pb_discount >= 0 },
      { name: "股息率", self: `${num(C.dy)}%`, bench: `${num(B.dy)}%`, delta: pp(cmp.dy_spread), good: cmp.dy_spread >= 0 },
      { name: "ERP", self: `${num(C.erp)}%`, bench: `${num(B.erp)}%`, delta: pp(cmp.erp_spread), good: cmp.erp_spread >= 0 },
    ];
    $("compareList").innerHTML = rows.map((r) => `
      <div class="compare-row">
        <div class="compare-name">${r.name}</div>
        <div class="compare-values"><b>${r.self}</b><span>vs <b>${r.bench}</b></span></div>
        <div class="compare-delta ${r.good ? "neg" : "pos"}">${r.delta}</div>
      </div>`).join("");
    $("compareFoot").textContent = `PE ${discountText(cmp.pe_discount)} · PB ${discountText(cmp.pb_discount)} · 股息率 ${pp(cmp.dy_spread)} · ERP ${pp(cmp.erp_spread)}`;
  }

  /* ---------------- income ---------------- */
  function renderIncome() {
    const C = D.current, B = D.benchmark, cmp = D.comparison;
    $("dyRead").textContent = `${num(C.dy)}%`;
    $("dyPill").textContent = `${num(C.dy_pct, 0)}% 分位`;
    $("dyBig").textContent = num(C.dy);
    $("dyBar").style.width = `${Math.max(2, Math.min(100, C.dy_pct))}%`;
    $("dyPctText").textContent = `${num(C.dy_pct, 1)}%`;
    $("dyNote").textContent = D.meta.note;
    $("dySpread").textContent = pp(cmp.dy_spread);
    $("dySelfLabel").textContent = D.meta.short;
    $("dySelf").textContent = `${num(C.dy)}%`;
    $("dyBench").textContent = `${num(B.dy)}%`;
    $("dySelfLabel").parentElement.style.setProperty("--w", `${Math.min(100, C.dy * 18)}%`);
    $("dyBenchBar").style.width = `${Math.min(100, B.dy * 18)}%`;
    $("incomeStats").innerHTML = [
      { label: "历史分位", value: `${num(C.dy_pct, 1)}%` },
      { label: "与300利差", value: pp(cmp.dy_spread) },
      { label: "当前股息率", value: `${num(C.dy)}%` },
    ].map((x) => `<div class="risk-stat"><span>${x.label}</span><b>${x.value}</b></div>`).join("");
  }

  /* ---------------- seasonality ---------------- */
  function renderSeasonality() {
    const S = D.seasonality;
    const months = S.months || [];
    const maxAbs = Math.max(1, ...months.map((m) => Math.abs(m.avg || 0)));
    $("seasonBars").innerHTML = months.map((m) => {
      if (m.avg == null) return `<div class="season-col empty"><div class="season-track"></div><div class="season-month">${m.month}月</div><div class="season-val">—</div></div>`;
      const h = Math.max(2, Math.abs(m.avg) / maxAbs * 43);
      const pos = m.avg >= 0;
      const tip = `${m.month}月 · 平均 ${pctSign(m.avg, 2)} · 中位 ${pctSign(m.median, 2)} · 胜率 ${num(m.win_rate, 0)}% · n=${m.n}`;
      return `<div class="season-col" title="${tip}">
        <div class="season-track"><div class="season-bar ${pos ? "pos" : "neg"}" style="${pos ? "bottom" : "top"}:50%;height:${h}%"></div></div>
        <div class="season-month">${m.month}月</div><div class="season-val ${pos ? "pos" : "neg"}">${pctSign(m.avg, 1)}</div>
      </div>`;
    }).join("");
    const best = S.best, worst = S.worst;
    $("seasonRead").textContent = best ? `${best.month}月 ${pctSign(best.avg, 1)}` : "—";
    $("seasonPill").textContent = `${S.total_months} 个月样本`;
    $("seasonFoot").textContent = `${D.meta.short} · ${S.total_months} 个完整月度价格回报 · 不含股息`;
    $("seasonStrip").innerHTML = [
      { label: "最强月份", value: best ? `${best.month}月` : "—", sub: best ? `${pctSign(best.avg, 2)} · 胜率 ${num(best.win_rate, 0)}%` : "—" },
      { label: "最弱月份", value: worst ? `${worst.month}月` : "—", sub: worst ? `${pctSign(worst.avg, 2)} · 胜率 ${num(worst.win_rate, 0)}%` : "—" },
      { label: "上涨月份", value: `${S.positive_months} / ${S.total_months}`, sub: S.total_months ? `${Math.round(S.positive_months / S.total_months * 100)}% 为正` : "—" },
      { label: "样本跨度", value: `${S.total_months} 个月`, sub: S.note },
    ].map((x) => `<div class="season-stat"><span>${x.label}</span><b>${x.value}</b><em>${x.sub}</em></div>`).join("");
  }

  /* ---------------- log / sources ---------------- */
  function renderLog() {
    const rows = D.monthly.slice(-12);
    $("logBody").innerHTML = rows.map((r) => `
      <tr><td>${r.date}</td><td>${num(r.pe)}x</td><td>${num(r.pb, 3)}x</td><td>${num(r.erp)}%</td>
      <td>${Math.round(r.composite)}</td><td><span class="regime ${r.regime === "高估" ? "expensive" : r.regime === "偏高" ? "rich" : r.regime === "适中" ? "fair" : "cheap"}">${r.regime}</span></td></tr>`).join("");
    $("logFoot").textContent = `${D.meta.short} · ${rows.length} 个月末快照 · 估值起点 ${D.meta.valuation_start}`;
  }

  function renderSources() {
    $("sourceList").innerHTML = D.meta.sources.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.label} ↗</a>`).join("");
    $("auditNote").textContent = `数据审计：数据日 ${D.meta.as_of}（收盘） · 页面生成 ${D.meta.generated_at}；PE / PB / 股息率 / 历史分位为韭圈儿；10 年期国债 ${num(D.current.ust10y)}%；${D.meta.note}`;
  }

  /* ---------------- boot ---------------- */
  function boot() {
    applyPageConfig();
    renderHero();
    renderCards();
    renderCompass();
    renderInsights();
    renderChartCopy();
    renderCompare();
    renderIncome();
    renderSeasonality();
    renderLog();
    renderSources();
    buildCharts();
    applyView(0, allLabels.length - 1);
    [charts.price, charts.pe, charts.pb, charts.erp, charts.perf, charts.rel].forEach((c) => attachZoom(c.canvas));
    document.querySelectorAll("#rangeTabs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#rangeTabs button").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        setPreset(btn.dataset.range);
      });
    });
    window.addEventListener("resize", () => drawGauge(D.current.composite));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in"); });
    }, { threshold: 0.05 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

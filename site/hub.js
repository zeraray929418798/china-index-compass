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

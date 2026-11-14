#!/usr/bin/env python3
"""Build the seven-index China valuation site."""
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from indices import BENCHMARK, CURRENT, INDICES

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
SITE = ROOT / "site"
SITE_DATA = SITE / "data"
TEMPLATES = ROOT / "templates"
GENERATED = datetime.now(timezone.utc).date().isoformat()


def pct_rank(series: pd.Series, value: float) -> float:
    s = series.dropna()
    if s.empty:
        return None
    return round(float((s <= value).mean() * 100.0), 1)


def q(series: pd.Series, p: float):
    s = series.dropna()
    return round(float(np.nanquantile(s.to_numpy(), p)), 4) if len(s) else None


def regime(score: float) -> tuple[str, str]:
    if score >= 80:
        return "高估", "expensive"
    if score >= 60:
        return "偏高", "rich"
    if score >= 40:
        return "适中", "fair"
    if score >= 20:
        return "低估", "cheap"
    return "深度低估", "deep-cheap"


def load_yield() -> pd.Series:
    df = pd.read_csv(RAW / "china10y.csv", parse_dates=["日期"])
    s = df.set_index("日期")["中国国债收益率10年"].astype(float).sort_index()
    return s


def load_index(code: str) -> pd.DataFrame:
    df = pd.read_csv(RAW / f"{code}.csv", parse_dates=["日期"]).set_index("日期").sort_index()
    df = df.rename(columns={"收盘价": "close"})
    df["pe"] = pd.to_numeric(df["pe"], errors="coerce")
    df["pb"] = pd.to_numeric(df["pb"], errors="coerce")
    df.loc[(df["pe"] <= 0) | (df["pe"] > 1000), "pe"] = np.nan
    df.loc[(df["pb"] <= 0) | (df["pb"] > 100), "pb"] = np.nan
    return df


def derive_dy(code: str, price: pd.DataFrame) -> pd.Series:
    tr_code = {"980081": "480081", "980092": "480092"}[code]
    tr = pd.read_csv(RAW / f"tr_{tr_code}.csv", parse_dates=["日期"]).set_index("日期")
    tr = tr.rename(columns={"收盘价": "tr"}).sort_index()
    joined = price[["close"]].join(tr["tr"], how="inner").dropna()
    ratio = joined["tr"] / joined["close"]
    dy = (ratio / ratio.shift(252) - 1.0) * 100.0
    dy = dy.replace([np.inf, -np.inf], np.nan)
    dy = dy.where((dy > -5) & (dy < 20))
    return dy


def monthly_seasonality(close: pd.Series) -> dict:
    monthly = close.resample("ME").last().dropna()
    as_of = close.index[-1]
    if as_of < as_of + pd.offsets.MonthEnd(0) and len(monthly) > 1:
        monthly = monthly.iloc[:-1]
    rets = monthly.pct_change().dropna()
    rows = []
    for m in range(1, 13):
        x = rets[rets.index.month == m]
        rows.append({
            "month": m,
            "avg": round(float(x.mean()) * 100, 2) if len(x) else None,
            "median": round(float(x.median()) * 100, 2) if len(x) else None,
            "win_rate": round(float((x > 0).mean()) * 100, 1) if len(x) else None,
            "n": int(len(x)),
        })
    valid = [r for r in rows if r["avg"] is not None]
    total = len(rets)
    if total < 36:
        note = "样本不足 3 年，季节性仅供参考"
    elif total < 60:
        note = "样本不足 5 年，季节性仅供参考"
    else:
        note = f"基于 {total} 个完整月度价格回报"
    return {
        "months": rows,
        "total_months": total,
        "note": note,
        "best": max(valid, key=lambda r: r["avg"]) if valid else None,
        "worst": min(valid, key=lambda r: r["avg"]) if valid else None,
        "positive_months": int((rets > 0).sum()),
    }


def build_one(cfg: dict, bench: pd.DataFrame, y10: pd.Series, current_all: dict) -> dict:
    code = cfg["ticker"]
    df = load_index(code)
    if code in ("980081", "980092"):
        df["dy_hist"] = derive_dy(code, df)
    y = y10.reindex(df.index).interpolate(method="time").ffill().bfill()
    df["ust10y"] = y
    df["erp"] = 100.0 / df["pe"] - df["ust10y"]

    # Current readings: Jiuquan valuation table for six, history for the two CNI indices.
    if code in current_all or code in CURRENT:
        cd = current_all.get(code) or CURRENT[code]
        pe, pb, dy = cd["pe"], cd["pb"], cd["dy"]
        pe_pct = pct_rank(df["pe"], pe)
        pb_pct = pct_rank(df["pb"], pb)
        dy_pct = cd["dy_pct"]
        pe_src, pb_src, dy_src = "韭圈儿估值表 / 历史分位", "韭圈儿估值表 / 历史分位", "韭圈儿估值表"
    else:
        last = df.dropna(subset=["pe", "pb"]).iloc[-1]
        pe, pb = float(last["pe"]), float(last["pb"])
        pe_pct = pct_rank(df["pe"], pe)
        pb_pct = pct_rank(df["pb"], pb)
        dy = float(df["dy_hist"].dropna().iloc[-1])
        dy_pct = pct_rank(df["dy_hist"], dy)
        pe_src = pb_src = dy_src = "韭圈儿历史 / 国证全收益推导"
    erp = round(100.0 / pe - float(y10.iloc[-1]), 2)
    erp_pct = pct_rank(df["erp"], erp)
    composite = round((pe_pct + pb_pct + (100 - erp_pct)) / 3.0, 1)
    reg, reg_en = regime(composite)

    # Benchmark comparison.
    bpe, bpb, bdy = BENCH_CURRENT["pe"], BENCH_CURRENT["pb"], BENCH_CURRENT["dy"]
    berp = round(100.0 / bpe - float(y10.iloc[-1]), 2)
    pe_discount = round((1.0 - pe / bpe) * 100.0, 1)
    pb_discount = round((1.0 - pb / bpb) * 100.0, 1)
    dy_spread = round(dy - bdy, 2)
    erp_spread = round(erp - berp, 2)

    # Price / benchmark relative series.
    b = bench[["close"]].rename(columns={"close": "bench"})
    rel_df = df[["close"]].join(b, how="inner").dropna()
    rel_df["rel"] = rel_df["close"] / rel_df["close"].iloc[0] / (rel_df["bench"] / rel_df["bench"].iloc[0]) * 100.0
    df = df.join(rel_df[["rel"]], how="left")
    ret_1y = float(df["close"].iloc[-1] / df["close"].iloc[-253] - 1.0) if len(df) > 253 else None
    bret_1y = float(bench["close"].iloc[-1] / bench["close"].iloc[-253] - 1.0) if len(bench) > 253 else None
    relative_1y = ((1 + ret_1y) / (1 + bret_1y) - 1.0) * 100 if ret_1y is not None and bret_1y is not None else None
    rel_since = float(df["rel"].iloc[-1] - 100.0) if pd.notna(df["rel"].iloc[-1]) else None
    rel_pct = pct_rank(df["rel"], float(df["rel"].iloc[-1])) if pd.notna(df["rel"].iloc[-1]) else None

    close = df["close"]
    cagr = float((close.iloc[-1] / close.iloc[0]) ** (365.25 / max((close.index[-1] - close.index[0]).days, 1)) - 1.0) * 100
    vol = float(np.log(close / close.shift(1)).dropna().tail(252).std() * np.sqrt(252) * 100)
    max_dd = float((close / close.cummax() - 1.0).min() * 100)

    pe_valid = df["pe"].dropna()
    pb_valid = df["pb"].dropna()
    erp_valid = df["erp"].dropna()
    bands = {
        "pe": [q(pe_valid, p) for p in (0.2, 0.4, 0.6, 0.8)],
        "pb": [q(pb_valid, p) for p in (0.2, 0.4, 0.6, 0.8)],
        "erp": [q(erp_valid, p) for p in (0.2, 0.4, 0.6, 0.8)],
    }

    # Monthly valuation history (3-factor composite; DY has no uniform history).
    m = df[["pe", "pb", "erp"]].resample("ME").last().dropna()
    rows = []
    for dt, r in m.tail(14).iterrows():
        p1 = pct_rank(pe_valid, float(r["pe"]))
        p2 = pct_rank(pb_valid, float(r["pb"]))
        p3 = pct_rank(erp_valid, float(r["erp"]))
        comp = round((p1 + p2 + (100 - p3)) / 3.0, 1)
        rows.append({
            "date": dt.strftime("%Y-%m"),
            "pe": round(float(r["pe"]), 2),
            "pb": round(float(r["pb"]), 3),
            "erp": round(float(r["erp"]), 2),
            "composite": comp,
            "regime": regime(comp)[0],
        })

    series = []
    for dt, r in df.iterrows():
        if pd.isna(r["close"]):
            continue
        series.append({
            "d": dt.strftime("%Y-%m-%d"),
            "c": round(float(r["close"]), 2),
            "pe": None if pd.isna(r["pe"]) else round(float(r["pe"]), 4),
            "pb": None if pd.isna(r["pb"]) else round(float(r["pb"]), 4),
            "erp": None if pd.isna(r["erp"]) else round(float(r["erp"]), 3),
            "rel": None if pd.isna(r["rel"]) else round(float(r["rel"]), 3),
        })

    low52 = float(close.tail(252).min())
    high52 = float(close.tail(252).max())
    chg = float(close.iloc[-1] / close.iloc[-2] - 1.0) * 100
    start_valid = df.dropna(subset=["pe", "pb"]).index[0].strftime("%Y-%m-%d")
    note = (
        "PE/PB 历史序列可用，股息率历史由全收益/价格比推导；样本较短。"
        if code in ("980081", "980092")
        else "股息率为当前值与历史分位，没有统一可用的历史派息序列。"
    )
    if code == "000688":
        note = "科创50估值历史从 2019-12 起可用；PE/PB 分位覆盖 2019 年以来。"

    insights = [
        {
            "tag": "相对沪深300",
            "title": f"PE {pe_discount:+.1f}% · PB {pb_discount:+.1f}%",
            "body": f"{cfg['short']} PE {pe:.2f}x，沪深300 {bpe:.2f}x；PB {pb:.2f}x vs {bpb:.2f}x。股息率差 {dy_spread:+.2f}pp，ERP 差 {erp_spread:+.2f}pp。",
            "tone": "amber",
        },
        {
            "tag": "历史位置",
            "title": f"PE {pe_pct:.0f}% · PB {pb_pct:.0f}% · ERP {erp_pct:.0f}%",
            "body": f"综合估值 {composite:.0f}/100（PE、PB、ERP 三等权），当前为{reg}。分位越高越贵；ERP 已做反向处理。",
            "tone": "blue",
        },
        {
            "tag": "相对表现",
            "title": f"近一年相对沪深300 {relative_1y:+.1f}pp" if relative_1y is not None else "近一年数据不足",
            "body": f"共同起点 {rel_df.index[0].strftime('%Y-%m-%d')} 以来，{cfg['short']} 相对沪深300 {rel_since:+.1f}%；当前相对强弱位于历史 {rel_pct:.1f}% 分位。",
            "tone": "teal",
        },
        {
            "tag": "现金回报",
            "title": f"股息率 {dy:.2f}% · 历史 {dy_pct:.0f}% 分位",
            "body": f"沪深300 股息率 {bdy:.2f}%，利差 {dy_spread:+.2f}pp。{note}",
            "tone": "green",
        },
    ]

    return {
        "meta": {
            **{k: cfg[k] for k in ("ticker", "slug", "name", "short", "code", "theme", "kind", "eyebrow", "hero_title", "hero_lede", "about", "price_head", "price_sub", "val_head", "val_sub", "income_head", "income_sub")},
            "as_of": df.index[-1].strftime("%Y-%m-%d"),
            "generated_at": GENERATED,
            "data_start": df.index[0].strftime("%Y-%m-%d"),
            "valuation_start": start_valid,
            "observations": int(len(df)),
            "note": note,
            "sources": [
                {"label": "韭圈儿 · 指数估值历史（PE/PB/ROE）", "url": "https://pre.jiucaishuo.com"},
                {"label": "韭圈儿 · 指数估值表（当前 PE/PB/股息率/分位）", "url": "https://funddb.cn/site/index"},
                {"label": "国证指数 · 全收益指数（980081/980092 股息率推导）", "url": "https://www.cnindex.com.cn"},
                {"label": "中国债券信息网 / AKShare · 中国 10 年期国债", "url": "https://yield.chinabond.com.cn"},
            ],
        },
        "current": {
            "close": round(float(close.iloc[-1]), 2),
            "change_1d": round(chg, 2),
            "low_52w": round(low52, 2),
            "high_52w": round(high52, 2),
            "pe": round(float(pe), 2),
            "pb": round(float(pb), 2),
            "dy": round(float(dy), 2),
            "erp": round(float(erp), 2),
            "pe_pct": round(float(pe_pct), 1),
            "pb_pct": round(float(pb_pct), 1),
            "dy_pct": round(float(dy_pct), 1),
            "erp_pct": round(float(erp_pct), 1),
            "composite": composite,
            "regime": reg,
            "regime_en": reg_en,
            "pe_median": round(float(pe_valid.median()), 2),
            "pb_median": round(float(pb_valid.median()), 3),
            "erp_median": round(float(erp_valid.median()), 2),
            "pe_band_low": bands["pe"][0],
            "pe_band_high": bands["pe"][3],
            "cagr": round(cagr, 1),
            "vol": round(vol, 1),
            "max_drawdown": round(max_dd, 1),
            "ust10y": round(float(y10.iloc[-1]), 3),
        },
        "benchmark": {
            **BENCH_CURRENT,
            "erp": berp,
            "composite": BENCH_COMPOSITE,
            "regime": BENCH_REGIME[0],
            "regime_en": BENCH_REGIME[1],
        },
        "comparison": {
            "pe_discount": pe_discount,
            "pb_discount": pb_discount,
            "dy_spread": dy_spread,
            "erp_spread": erp_spread,
            "relative_1y": None if relative_1y is None else round(relative_1y, 2),
            "relative_since": None if rel_since is None else round(rel_since, 1),
            "relative_pct": rel_pct,
            "common_start": rel_df.index[0].strftime("%Y-%m-%d"),
            "return_1y": None if ret_1y is None else round(ret_1y * 100, 2),
            "bench_return_1y": None if bret_1y is None else round(bret_1y * 100, 2),
            "cagr": round(cagr, 1),
            "vol": round(vol, 1),
            "max_drawdown": round(max_dd, 1),
        },
        "series": series,
        "bench_series": [
            {"d": dt.strftime("%Y-%m-%d"), "c": round(float(r["close"]), 2)}
            for dt, r in bench.iterrows()
        ],
        "bands": bands,
        "monthly": rows,
        "seasonality": monthly_seasonality(close),
        "insights": insights,
    }


# Benchmark snapshot (Jiuquan valuation table, 2026-11-13).
BENCH_CURRENT = {
    "pe": 13.43, "pb": 1.32, "dy": 3.12,
    "pe_pct": 64.92, "pb_pct": 19.18, "dy_pct": 79.29,
}
BENCH_ERP = round(100 / BENCH_CURRENT["pe"] - 1.6123, 2)
BENCH_ERP_PCT = 50.0  # replaced after history is loaded


def main() -> int:
    SITE_DATA.mkdir(parents=True, exist_ok=True)
    current_all = json.loads((RAW / "current.json").read_text(encoding="utf-8"))
    y10 = load_yield()
    bench = load_index("000300")
    bench["ust10y"] = y10.reindex(bench.index).interpolate(method="time").ffill().bfill()
    bench["erp"] = 100 / bench["pe"] - bench["ust10y"]
    if "000300" in current_all:
        BENCH_CURRENT.update({k: current_all["000300"][k] for k in ("pe", "pb", "dy", "dy_pct")})
    global BENCH_ERP, BENCH_ERP_PCT, BENCH_COMPOSITE, BENCH_REGIME
    BENCH_ERP = round(100 / BENCH_CURRENT["pe"] - float(y10.iloc[-1]), 2)
    BENCH_CURRENT["pe_pct"] = pct_rank(bench["pe"], BENCH_CURRENT["pe"])
    BENCH_CURRENT["pb_pct"] = pct_rank(bench["pb"], BENCH_CURRENT["pb"])
    BENCH_ERP_PCT = pct_rank(bench["erp"], BENCH_ERP)
    BENCH_COMPOSITE = round((BENCH_CURRENT["pe_pct"] + BENCH_CURRENT["pb_pct"] + (100 - BENCH_ERP_PCT)) / 3, 1)
    BENCH_REGIME = regime(BENCH_COMPOSITE)

    payloads = []
    for cfg in INDICES:
        payload = build_one(cfg, bench, y10, current_all)
        payloads.append(payload)
        print(f"{cfg['short']}: {payload['current']['pe']}x PB {payload['current']['pb']} DY {payload['current']['dy']}% "
              f"comp={payload['current']['composite']} ({payload['current']['regime']}) "
              f"vs300 PE {payload['comparison']['pe_discount']:+.1f}%")

        (SITE_DATA / f"{cfg['slug']}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        (SITE_DATA / f"{cfg['slug']}.js").write_text("window.INDEX_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";", encoding="utf-8")
        with open(SITE_DATA / f"{cfg['slug']}_daily.csv", "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["date", "close", "pe_ttm", "pb", "erp", "relative_csi300"])
            for row in payload["series"]:
                w.writerow([row["d"], row["c"], row["pe"], row["pb"], row["erp"], row["rel"]])

    hub = {
        "as_of": bench.index[-1].strftime("%Y-%m-%d"),
        "generated_at": GENERATED,
        "benchmark": {
            **BENCH_CURRENT,
            "erp": BENCH_ERP,
            "erp_pct": BENCH_ERP_PCT,
            "composite": BENCH_COMPOSITE,
            "regime": BENCH_REGIME[0],
        },
        "funds": [
            {
                "ticker": p["meta"]["ticker"],
                "name": p["meta"]["name"],
                "short": p["meta"]["short"],
                "slug": p["meta"]["slug"],
                "theme": p["meta"]["theme"],
                "href": f"{p['meta']['slug']}.html",
                "close": p["current"]["close"],
                "change_1d": p["current"]["change_1d"],
                "pe": p["current"]["pe"],
                "pb": p["current"]["pb"],
                "dy": p["current"]["dy"],
                "erp": p["current"]["erp"],
                "composite": p["current"]["composite"],
                "regime": p["current"]["regime"],
                "pe_discount": p["comparison"]["pe_discount"],
                "relative_1y": p["comparison"]["relative_1y"],
                "spark": [r["c"] for r in p["series"][-120:]],
            }
            for p in payloads
        ],
    }
    (SITE_DATA / "hub.json").write_text(json.dumps(hub, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (SITE_DATA / "hub.js").write_text("window.HUB_DATA = " + json.dumps(hub, ensure_ascii=False, separators=(",", ":")) + ";", encoding="utf-8")

    template = (TEMPLATES / "page.html").read_text(encoding="utf-8")
    for p in payloads:
        cfg_json = json.dumps({
            "ticker": p["meta"]["ticker"],
            "slug": p["meta"]["slug"],
            "name": p["meta"]["name"],
            "code": p["meta"]["code"],
            "theme": p["meta"]["theme"],
            "csv": f"data/{p['meta']['slug']}_daily.csv",
            "data": f"data/{p['meta']['slug']}.js",
            "hero_title": p["meta"]["hero_title"],
            "hero_lede": p["meta"]["hero_lede"],
            "eyebrow": p["meta"]["eyebrow"],
            "price_head": p["meta"]["price_head"],
            "price_sub": p["meta"]["price_sub"],
            "val_head": p["meta"]["val_head"],
            "val_sub": p["meta"]["val_sub"],
            "income_head": p["meta"]["income_head"],
            "income_sub": p["meta"]["income_sub"],
        }, ensure_ascii=False)
        html = (template.replace("{{PAGE_CONFIG}}", cfg_json)
                .replace("{{DATA_SCRIPT}}", f"data/{p['meta']['slug']}.js")
                .replace("{{SLUG}}", p["meta"]["slug"]))
        (SITE / f"{p['meta']['slug']}.html").write_text(html, encoding="utf-8")

    print(f"Wrote {len(payloads)} pages + hub")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

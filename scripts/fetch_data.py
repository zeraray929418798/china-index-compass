#!/usr/bin/env python3
"""Fetch China index prices/valuations and China 10Y yield."""
from __future__ import annotations

import json
import time
import urllib.request
from pathlib import Path
from datetime import datetime

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
JIQUAN = "https://pre.jiucaishuo.com/v4/open-ai/index-data"
GROUP = "https://govip.jiucaishuo.com/indexvaluation/industry/group-list"

CODES = {
    "980081": "980081.CNI",
    "980092": "980092.CNI",
    "000922": "000922.CSI",
    "000825": "000825.CSI",
    "931187": "931187.CSI",
    "399006": "399006.SZ",
    "000688": "000688.SH",
    "000300": "000300.SH",
}
TARGETS = set(CODES)


def jq_index(code: str, start: str = "2016-01-01", end: str | None = None) -> pd.DataFrame:
    end = end or datetime.now().date().isoformat()
    body = {"code": code, "start_time": start, "end_time": end}
    req = urllib.request.Request(
        JIQUAN,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": UA},
        method="POST",
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=40) as resp:
                obj = json.loads(resp.read().decode("utf-8"))
            if obj.get("code") != 0 or not obj.get("data"):
                raise RuntimeError(obj.get("message"))
            rows = obj["data"]
            head = rows[0]
            df = pd.DataFrame(rows[1:], columns=head)
            df["日期"] = pd.to_datetime(df["日期"])
            for col in ["收盘价", "pe", "pb", "roe"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            for col in ["pe", "pb"]:
                df.loc[(df[col] <= 0) | (df[col] > 10000), col] = pd.NA
            df.loc[(df["pb"] > 100), "pb"] = pd.NA
            return df.sort_values("日期").drop_duplicates("日期")
        except Exception as exc:  # noqa: BLE001
            print(f"  [retry {attempt + 1}] {code}: {exc}")
            time.sleep(3 + attempt * 3)
    raise RuntimeError(f"failed: {code}")


def group_current() -> dict:
    """Current PE/PB/DY and percentiles for the names in the valuation list."""
    found = {}
    for cat in (8, 3, 2, 9):
        for page in range(1, 18):
            body = {
                "category": cat, "types": 2, "p": page, "field": "", "order_by": "",
                "type": "h5", "version": "2.5.9", "authtoken": "", "ss": "",
                "act_time": int(time.time() * 1000),
            }
            req = urllib.request.Request(
                GROUP, data=json.dumps(body).encode(), method="POST",
                headers={"Content-Type": "application/json", "User-Agent": UA},
            )
            try:
                with urllib.request.urlopen(req, timeout=25) as resp:
                    data = json.loads(resp.read().decode()).get("data") or {}
            except Exception as exc:  # noqa: BLE001
                print(f"  [warn] group cat={cat} page={page}: {exc}")
                break
            rows = data.get("list") or []
            if not rows:
                break
            for rec in rows:
                code = str(rec.get("gu_code", "")).split(".")[0]
                if code not in TARGETS:
                    continue
                vals = [str(c.get("val", "")).replace("%", "").replace(",", "") for c in rec.get("list", [])]
                try:
                    nums = [float(v) for v in vals[:7]]
                except ValueError:
                    continue
                found[code] = {
                    "name": rec.get("gu_name"),
                    "pe": nums[0], "pe_pct": nums[1], "pb": nums[2],
                    "pb_pct": nums[3], "dy": nums[4], "dy_pct": nums[5],
                    "roe": nums[6], "tag": rec.get("tag"),
                }
    return found


def main() -> int:
    for code, full in CODES.items():
        df = jq_index(full)
        df.to_csv(RAW / f"{code}.csv", index=False, encoding="utf-8")
        print(f"{code}: {len(df)} rows, {df['日期'].min().date()} → {df['日期'].max().date()}, last PE {df['pe'].dropna().iloc[-1]:.2f}")

    current = group_current()
    (RAW / "current.json").write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    print("current:", {k: (v["pe"], v["pb"], v["dy"]) for k, v in current.items()})

    # Total-return series for the two CNI indices (for DY derivation).
    import akshare as ak
    for code in ["480081", "480092"]:
        df = ak.index_hist_cni(symbol=code, start_date="20160101", end_date=datetime.now().strftime("%Y%m%d"))
        df.to_csv(RAW / f"tr_{code}.csv", index=False, encoding="utf-8")
        print(f"TR {code}: {len(df)} rows")

    # China 10Y government bond yield.
    yield_df = ak.bond_zh_us_yield_em()
    yield_df[["日期", "中国国债收益率10年"]].to_csv(RAW / "china10y.csv", index=False, encoding="utf-8")
    print("10Y:", yield_df[["日期", "中国国债收益率10年"]].dropna().tail(1).to_dict("records"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

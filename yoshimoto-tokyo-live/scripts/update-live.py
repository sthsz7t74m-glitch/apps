from __future__ import annotations

import html
import re
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://live.yoshimoto.co.jp"
LIST_URL = f"{BASE}/live/"
OUT = Path(__file__).resolve().parents[1] / "auto-data.js"
UA = {"User-Agent": "Mozilla/5.0 (compatible; YoshimotoTokyoLiveUpdater/1.0)"}
TOKYO_WORDS = ("東京都", "東京", "新宿", "渋谷", "神保町", "ルミネ", "六本木")


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(text or "")).strip()


def find_detail_links() -> list[str]:
    links: set[str] = set()
    for page in range(1, 7):
        url = LIST_URL if page == 1 else f"{LIST_URL}page/{page}/"
        r = requests.get(url, headers=UA, timeout=25)
        if r.status_code == 404:
            break
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.select('a[href*="/live/live-"]'):
            href = a.get("href")
            if href:
                links.add(urljoin(BASE, href))
    return sorted(links)


def parse_date(text: str) -> str | None:
    m = re.search(r"(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日", text)
    if not m:
        return None
    return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"


def parse_time_pair(text: str) -> tuple[str, str]:
    open_m = re.search(r"(\d{1,2}:\d{2})\s*開場", text)
    start_m = re.search(r"(\d{1,2}:\d{2})\s*開演", text)
    return (open_m.group(1) if open_m else "", start_m.group(1) if start_m else "")


def parse_price(text: str) -> tuple[str, str]:
    nums = [int(x.replace(",", "")) for x in re.findall(r"(?:前売|一般|料金)[^\d]{0,12}([0-9,]{3,6})円", text)]
    price = str(min(nums)) if nums else ""
    price_text = f"前売 {price}円" if price else "価格は公式で確認"
    return price, price_text


def parse_detail(url: str, today: str, horizon: str) -> str | None:
    r = requests.get(url, headers=UA, timeout=25)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    text = clean(soup.get_text(" "))
    if not any(word in text for word in TOKYO_WORDS):
        return None

    title_node = soup.find("h1") or soup.find("h2")
    title = clean(title_node.get_text(" ") if title_node else "")
    if not title:
        return None

    date = parse_date(text)
    if not date or date < today or date > horizon:
        return None
    open_time, start_time = parse_time_pair(text)
    if not start_time:
        return None

    venue = "会場は公式で確認"
    area = "東京"
    for candidate in (
        "ルミネtheよしもと", "渋谷よしもと漫才劇場", "神保町よしもと漫才劇場",
        "YOSHIMOTO ROPPONGI THEATER", "よしもと有楽町シアター"
    ):
        if candidate in text:
            venue = candidate
            break
    if "新宿" in text or "ルミネ" in venue:
        area = "新宿"
    elif "渋谷" in text or "渋谷" in venue:
        area = "渋谷"
    elif "神保町" in text or "神保町" in venue:
        area = "神保町"
    elif "六本木" in text or "ROPPONGI" in venue:
        area = "六本木"

    performers = "出演者は公式で確認"
    m = re.search(r"出演者\s+(.+?)(?:チケット|料金|主催|お問い合わせ)", text)
    if m:
        performers = clean(m.group(1)).replace("、", "／")[:700]

    price, price_text = parse_price(text)
    genre = "neta-corner" if "ネタ" in title else "project"
    safe = lambda s: clean(s).replace("|", "／").replace("\n", " ")
    return "|".join([
        date, safe(open_time), safe(start_time), safe(venue), safe(area), safe(title), genre,
        "check", price, safe(price_text), safe(performers), url
    ])


def main() -> None:
    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    horizon = (now + timedelta(days=120)).strftime("%Y-%m-%d")
    rows: set[str] = set()
    errors = 0

    for url in find_detail_links():
        try:
            row = parse_detail(url, today, horizon)
            if row:
                rows.add(row)
        except Exception as exc:
            errors += 1
            print(f"WARN {url}: {exc}")

    ordered = sorted(rows, key=lambda x: (x.split("|")[0], x.split("|")[2], x.split("|")[5]))
    body = "\n".join(ordered)
    OUT.write_text(
        "(() => {\n"
        "  \"use strict\";\n"
        "  const autoRows = String.raw`\n" + body + "`;\n"
        "  const current = String(window.YOSHIMOTO_LIVE_ROWS || \"\").trim();\n"
        "  window.YOSHIMOTO_LIVE_ROWS = `${current}\\n${autoRows.trim()}`.trim();\n"
        "})();\n",
        encoding="utf-8",
    )
    print(f"updated {OUT}: {len(ordered)} events, {errors} detail errors")


if __name__ == "__main__":
    main()

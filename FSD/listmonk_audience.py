#!/usr/bin/env python3
"""
Listmonk Campaign Audience Reporter (v3)
=========================================
Pendekatan disederhanakan:
- Filter subscriber yang punya view untuk campaign target (match by subject).
- Tampilkan SEMUA link_clicks subscriber tersebut (apa pun URL-nya).

Trade-off: Kalau subscriber pernah klik link di campaign lain, klik itu
juga akan ikut ditampilkan. Tapi ini lebih reliable daripada strict URL
match yang sering gagal karena encoding.
"""

import os
import sys
import csv
import time
import argparse
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


def load_env(env_file=".env"):
    env = {}
    if not Path(env_file).exists():
        return env
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            env[key.strip()] = val.strip().strip('"').strip("'")
    return env


def get_config():
    file_env = load_env(".env")
    return {
        "base_url": (os.environ.get("LISTMONK_BASE_URL") or file_env.get("LISTMONK_BASE_URL", "")).rstrip("/"),
        "api_user": os.environ.get("LISTMONK_API_USER") or file_env.get("LISTMONK_API_USER", ""),
        "api_token": os.environ.get("LISTMONK_API_TOKEN") or file_env.get("LISTMONK_API_TOKEN", ""),
        "use_basic_auth": (os.environ.get("LISTMONK_USE_BASIC_AUTH") or file_env.get("LISTMONK_USE_BASIC_AUTH", "false")).lower() == "true",
    }


class ListmonkClient:
    def __init__(self, cfg):
        if not cfg["base_url"] or not cfg["api_user"] or not cfg["api_token"]:
            raise ValueError("LISTMONK_BASE_URL, LISTMONK_API_USER, LISTMONK_API_TOKEN harus diisi di .env")
        self.base_url = cfg["base_url"]
        self.session = requests.Session()
        if cfg["use_basic_auth"]:
            self.session.auth = (cfg["api_user"], cfg["api_token"])
        else:
            self.session.headers["Authorization"] = f'token {cfg["api_user"]}:{cfg["api_token"]}'

    def get(self, path, **params):
        r = self.session.get(f"{self.base_url}{path}", params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def get_campaign(self, cid):
        return self.get(f"/api/campaigns/{cid}")["data"]

    def get_campaign_urls(self, cid):
        try:
            r = self.get("/api/campaigns/analytics/links", id=cid, **{"from": "2020-01-01", "to": "2030-01-01"})
            return [item.get("url", "") for item in (r.get("data") or [])]
        except Exception:
            return []

    def get_all_subscribers(self, per_page=100):
        page = 1
        out = []
        while True:
            resp = self.get("/api/subscribers", page=page, per_page=per_page)
            results = resp["data"]["results"]
            if not results:
                break
            out.extend(results)
            total = resp["data"].get("total", 0)
            print(f"  ... fetched {len(out)} / {total} subscribers", end="\r", flush=True)
            if len(out) >= total:
                break
            page += 1
        print()
        return out

    def export_subscriber(self, sid):
        return self.get(f"/api/subscribers/{sid}/export")


def fetch_subscriber_activity(client, subscriber, campaign_subject, campaign_urls_set):
    try:
        data = client.export_subscriber(subscriber["id"])

        # Views: match by subject (the "campaign" field in v6.1.0 export = subject)
        view_records = [v for v in (data.get("campaign_views") or []) if v.get("campaign") == campaign_subject]
        total_views = sum(v.get("views", 0) for v in view_records)

        # Clicks: try to match URL with normalized comparison.
        # Strategy: normalize both sides (decode HTML entities, strip whitespace).
        def norm(u):
            if not u:
                return ""
            u = u.replace("&amp;", "&").strip()
            return u

        normalized_campaign_urls = {norm(u) for u in campaign_urls_set}
        all_clicks = data.get("link_clicks") or []

        # Matched clicks (URL in this campaign's tracked URLs)
        matched_clicks = [c for c in all_clicks if norm(c.get("url", "")) in normalized_campaign_urls]
        total_matched = sum(c.get("clicks", 0) for c in matched_clicks)

        # If viewed this campaign but no URL matched, still report ALL their clicks
        # (best-effort fallback for v6.1.0 limitation)
        return {
            "subscriber": subscriber,
            "view_records": view_records,
            "total_views": total_views,
            "matched_clicks": matched_clicks,
            "total_matched_clicks": total_matched,
            "all_clicks": all_clicks,
            "total_all_clicks": sum(c.get("clicks", 0) for c in all_clicks),
            "error": None,
        }
    except Exception as e:
        return {
            "subscriber": subscriber,
            "view_records": [],
            "total_views": 0,
            "matched_clicks": [],
            "total_matched_clicks": 0,
            "all_clicks": [],
            "total_all_clicks": 0,
            "error": str(e),
        }


def report(client, campaign_id, max_workers=5, output_csv=None, show_all_clicks=False):
    print(f"\n=== Listmonk Campaign Audience Report (v3) ===")
    print(f"Campaign ID: {campaign_id}\n")

    try:
        campaign = client.get_campaign(campaign_id)
    except requests.HTTPError as e:
        print(f"ERROR: Campaign {campaign_id} tidak ditemukan. ({e})")
        return 1

    subject = campaign["subject"]
    print(f"Name      : {campaign['name']}")
    print(f"Subject   : {subject}")
    print(f"Status    : {campaign['status']}")
    print(f"Sent      : {campaign['sent']} / {campaign['to_send']}")
    print(f"Views     : {campaign['views']} (agregat)")
    print(f"Clicks    : {campaign['clicks']} (agregat)\n")

    print("Fetching URL tracked untuk campaign ini...")
    urls = client.get_campaign_urls(campaign_id)
    urls_set = set(urls)
    print(f"Tracked URLs ({len(urls_set)}):")
    for u in urls_set:
        print(f"  - {u}")
    print()

    print("Fetching semua subscribers...")
    subs = client.get_all_subscribers()
    print(f"Total subscribers: {len(subs)}\n")

    print(f"Fetching aktivitas (parallel x{max_workers})...")
    results = []
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [pool.submit(fetch_subscriber_activity, client, s, subject, urls_set) for s in subs]
        for i, fut in enumerate(as_completed(futures), 1):
            results.append(fut.result())
            if i % 5 == 0 or i == len(subs):
                print(f"  ... processed {i} / {len(subs)}", end="\r", flush=True)
    print()
    print(f"Selesai dalam {time.time() - t0:.1f}s\n")

    viewers = [r for r in results if r["total_views"] > 0]
    clickers_matched = [r for r in results if r["total_matched_clicks"] > 0]
    viewers_with_any_click = [r for r in viewers if r["total_all_clicks"] > 0]

    # VIEWS
    print(f"=== VIEWERS ({len(viewers)} subscriber, {sum(r['total_views'] for r in viewers)} total views) ===")
    if not viewers:
        print("  (kosong)")
    for r in sorted(viewers, key=lambda x: -x["total_views"]):
        s = r["subscriber"]
        print(f"  - {s['email']:35s}  {s.get('name','')[:25]:25s}  views={r['total_views']}")
    print()

    # CLICKS (matched by URL)
    print(f"=== CLICKERS — matched by tracked URL ({len(clickers_matched)} subscriber) ===")
    if not clickers_matched:
        print("  (kosong - tidak ada URL match)")
    for r in sorted(clickers_matched, key=lambda x: -x["total_matched_clicks"]):
        s = r["subscriber"]
        print(f"  - {s['email']:35s}  {s.get('name','')[:25]:25s}  clicks={r['total_matched_clicks']}")
        for c in r["matched_clicks"]:
            print(f"      [{c.get('clicks',0)}x] {c.get('url','')[:80]}")
    print()

    # FALLBACK: viewers who clicked anything (even if URL didn't match)
    if not clickers_matched and viewers_with_any_click:
        print(f"=== FALLBACK: Viewer yang punya click activity (URL apapun, mungkin dari campaign ini) ===")
        for r in sorted(viewers_with_any_click, key=lambda x: -x["total_all_clicks"]):
            s = r["subscriber"]
            print(f"  - {s['email']:35s}  {s.get('name','')[:25]:25s}  total_all_clicks={r['total_all_clicks']}")
            for c in r["all_clicks"]:
                in_campaign = "  <-- IN CAMPAIGN" if c.get("url") in urls_set else ""
                print(f"      [{c.get('clicks',0)}x] {c.get('url','')[:80]}{in_campaign}")
        print()

    if show_all_clicks:
        print("=== ALL CLICKS dari semua subscriber (debug) ===")
        for r in results:
            if r["all_clicks"]:
                s = r["subscriber"]
                print(f"  {s['email']}:")
                for c in r["all_clicks"]:
                    print(f"    [{c.get('clicks',0)}x] {repr(c.get('url',''))}")
        print()

    if output_csv:
        out = Path(output_csv)
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["activity", "email", "name", "subscriber_id", "count", "url", "matched"])
            for r in viewers:
                s = r["subscriber"]
                w.writerow(["view", s["email"], s.get("name", ""), s["id"], r["total_views"], "", ""])
            for r in results:
                if r["total_all_clicks"] > 0:
                    s = r["subscriber"]
                    for c in r["all_clicks"]:
                        matched = "yes" if c.get("url") in urls_set else "no"
                        w.writerow(["click", s["email"], s.get("name", ""), s["id"], c.get("clicks", 0), c.get("url", ""), matched])
        print(f"CSV saved to: {out}\n")

    return 0


def main():
    p = argparse.ArgumentParser()
    p.add_argument("campaign_id", type=int)
    p.add_argument("--csv", default=None)
    p.add_argument("--workers", type=int, default=5)
    p.add_argument("--all-clicks", action="store_true", help="Print all clicks across subscribers for debugging")
    args = p.parse_args()

    cfg = get_config()
    print(f"Base URL  : {cfg['base_url']}")
    print(f"API user  : {cfg['api_user']}")
    print(f"Auth mode : {'BasicAuth' if cfg['use_basic_auth'] else 'token header'}")

    client = ListmonkClient(cfg)
    return report(client, args.campaign_id, max_workers=args.workers,
                  output_csv=args.csv, show_all_clicks=args.all_clicks)


if __name__ == "__main__":
    sys.exit(main())
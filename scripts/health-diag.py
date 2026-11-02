#!/usr/bin/env python3
"""Hayaan.co health diagnosis — mirrors the Ahrefs Site Audit of 29 Oct 2026.
Owner report: Health Score 100 -> 97. Ahrefs says: 6x 5XX (+6 new, -5 fixed),
1 redirect, 1 client error, 75 URLs TTFB>500ms, 38 slow pages, 9 slow responses
for AI crawlers. This script reproduces those findings on the live site:
  1. sitemap.xml -> all URLs (+ internal links harvested from key pages)
  2. pass 1: GET every URL, record status + TTFB
  3. pass 2: re-test every failure 3x to separate transient 503 from persistent
  4. GPTBot user-agent subset test (AI-crawler slowness)
Output: human-readable table + scripts/health-diag-result.json
"""
import concurrent.futures as cf
import json, re, statistics, sys, time, urllib.request, urllib.error

BASE = "https://hayaan.co"
UA_BROWSER = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
UA_GPTBOT = ("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; "
             "GPTBot/1.2; +https://openai.com/gptbot)")

def fetch(url, ua=UA_BROWSER, timeout=35, keep=False):
    t0 = time.time()
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "text/html,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body, ttfb = b"", None
            while True:
                chunk = r.read(65536)
                if not chunk:
                    break
                if ttfb is None:
                    ttfb = time.time() - t0
                if len(body) < 3_000_000:
                    body += chunk
            return {"url": url, "code": r.status, "ttfb": round(ttfb, 3),
                    "total": round(time.time() - t0, 3), "bytes": len(body),
                    "body": body if keep else b""}
    except urllib.error.HTTPError as e:
        return {"url": url, "code": e.code, "ttfb": round(time.time() - t0, 3),
                "total": round(time.time() - t0, 3), "bytes": 0, "body": b"",
                "err": str(e)[:120]}
    except Exception as e:
        return {"url": url, "code": None, "ttfb": round(time.time() - t0, 3),
                "total": round(time.time() - t0, 3), "bytes": 0, "body": b"",
                "err": repr(e)[:120]}

def get_sitemap_urls():
    r = fetch(BASE + "/sitemap.xml", keep=True)
    if r["code"] != 200:
        print(f"!! sitemap.xml -> {r['code']} {r.get('err','')}")
        return []
    locs = [l.decode() for l in re.findall(rb"<loc>\s*(.*?)\s*</loc>", r["body"])]
    if any(u.endswith(".xml") for u in locs):  # sitemap index -> expand
        all_u = []
        for sm in [u for u in locs if u.endswith(".xml")]:
            rr = fetch(sm, keep=True)
            all_u += [l.decode() for l in re.findall(rb"<loc>\s*(.*?)\s*</loc>", rr["body"])]
        locs = all_u
    return locs

def harvest_internal(html):
    out = set()
    for h in re.findall(r'href="([^"#]+)"', html):
        if h.startswith(BASE):
            h = h[len(BASE):] or "/"
        if h.startswith("/") and not h.startswith("//"):
            out.add(h.split("?")[0])
    return out

def parallel(urls, ua=UA_BROWSER, workers=12):
    res = {}
    with cf.ThreadPoolExecutor(workers) as ex:
        futs = {ex.submit(fetch, u, ua): u for u in urls}
        for f in cf.as_completed(futs):
            r = f.result()
            res[r["url"]] = r
    return res

def bucket(code):
    if code is None:
        return "neterr"
    if code >= 500:
        return "5xx"
    if code >= 400:
        return "4xx"
    if code >= 300:
        return "3xx"
    return "ok"

def main():
    t0 = time.time()
    rep = {"generated": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())}

    # 0. robots.txt — AI crawler rules
    rob = fetch(BASE + "/robots.txt", keep=True)
    rep["robots_status"] = rob["code"]
    rep["robots_ai_lines"] = [l for l in rob["body"].decode("utf-8", "replace").splitlines()
                              if any(k in l.lower() for k in ("gptbot", "claude", "perplex",
                                                              "google-extended", "ccbot", "user-agent", "sitemap"))][:30]
    print("== robots.txt ==", rob["code"])
    for l in rep["robots_ai_lines"]:
        print("  ", l)

    # 1. URL set: sitemap + internal links from home/category/PDP/blog
    sm_urls = get_sitemap_urls()
    print(f"\n== sitemap: {len(sm_urls)} URLs")
    seed = ["", "/category/phones-wearables", "/product/samsung-galaxy-a17",
            "/product/samsung-galaxy-a17-2", "/product/samsung-galaxy-a17-3", "/blog"]
    linkset = set()
    for p in seed:
        r = fetch(BASE + p, keep=True)
        if r["code"] == 200:
            linkset |= harvest_internal(r["body"].decode("utf-8", "replace"))
    extra = sorted(u for u in linkset if BASE + u not in set(sm_urls))
    print(f"== internal links harvested: {len(linkset)}, not in sitemap: {len(extra)}")
    urls = sorted(set(sm_urls) | {BASE + u for u in extra})
    urls = urls[:170]  # cap for runtime
    rep["url_count"] = len(urls)
    rep["sitemap_count"] = len(sm_urls)
    rep["extra_not_in_sitemap"] = extra[:60]

    # 2. pass 1
    print(f"\n== pass 1: {len(urls)} URLs ...")
    r1 = parallel(urls)
    ok = [r for r in r1.values() if bucket(r["code"]) == "ok"]
    fails = [r for r in r1.values() if bucket(r["code"]) != "ok"]
    slow = sorted([r for r in ok if r["ttfb"] > 0.5], key=lambda r: -r["ttfb"])
    tt = sorted(r["ttfb"] for r in ok)
    rep["pass1"] = {
        "ok": len(ok), "fail": len(fails),
        "ttfb_median": round(statistics.median(tt), 3) if tt else None,
        "ttfb_p90": round(tt[int(0.9 * len(tt)) - 1], 3) if tt else None,
        "ttfb_max": round(tt[-1], 3) if tt else None,
        "over_500ms": len(slow),
        "over_300ms": sum(1 for t in tt if t > 0.3),
    }
    print(f"   ok={len(ok)} fail={len(fails)}  TTFB median={rep['pass1']['ttfb_median']}s "
          f"p90={rep['pass1']['ttfb_p90']}s max={rep['pass1']['ttfb_max']}s")
    print(f"   >500ms: {len(slow)}  >300ms: {rep['pass1']['over_300ms']}")

    # 3. failures detail + persistence retest (3 attempts)
    print("\n== failures (pass 1):")
    rep["failures"] = []
    for r in sorted(fails, key=lambda r: (bucket(r["code"]), r["url"])):
        retr = []
        for i in range(3):
            time.sleep(1.5)
            rr = fetch(r["url"])
            retr.append(rr["code"])
            if rr["code"] and rr["code"] < 400:
                break
        row = {"url": r["url"].replace(BASE, ""), "code": r["code"],
               "err": r.get("err", "")[:80], "retest": retr,
               "persistent": all(c == r["code"] for c in retr if c is not None) and retr and retr[0] == r["code"]}
        rep["failures"].append(row)
        print(f"   {row['code']} {row['url']}  retest={retr}  persistent={row['persistent']}")

    # 4. slow pages detail (top 25)
    print("\n== slowest OK pages (TTFB):")
    rep["slowest"] = [{"url": r["url"].replace(BASE, ""), "ttfb": r["ttfb"]}
                      for r in slow[:25]]
    for s in rep["slowest"]:
        print(f"   {s['ttfb']:>6.3f}s  {s['url']}")

    # 5. GPTBot AI-crawler subset
    ai_urls = [BASE + p for p in ["", "/category/phones-wearables", "/blog",
                                  "/product/samsung-galaxy-a17",
                                  "/product/samsung-galaxy-a17-2",
                                  "/product/samsung-galaxy-a17-3"]]
    print("\n== AI crawler (GPTBot UA) TTFB test:")
    rep["ai_crawler"] = []
    for u in ai_urls:
        rb = fetch(u, ua=UA_BROWSER)
        rg = fetch(u, ua=UA_GPTBOT)
        rep["ai_crawler"].append({"url": u.replace(BASE, "") or "/", "browser": rb["ttfb"],
                                  "gptbot": rg["ttfb"], "gptbot_code": rg["code"]})
        print(f"   /{u.replace(BASE,'').strip('/'):40s} browser={rb['ttfb']:.3f}s  gptbot={rg['ttfb']:.3f}s code={rg['code']}")

    rep["elapsed_s"] = round(time.time() - t0, 1)
    with open("/home/z/my-project/scripts/health-diag-result.json", "w") as f:
        json.dump(rep, f, indent=1, ensure_ascii=False)
    print(f"\n== done in {rep['elapsed_s']}s — result saved to scripts/health-diag-result.json")

if __name__ == "__main__":
    main()

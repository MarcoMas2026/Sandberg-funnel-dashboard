#!/usr/bin/env python3
"""Syncs Live Grid assets to Supabase Storage (public bucket `live-grid`).

Sources (outside this repo):
  ~/Desktop/LANDINGS/sandbergestates.es/<ref>/hero.jpg  (or <ref>/ENG/hero.jpg)
  ~/Desktop/LANDINGS/sandbergestates.es/<ref>.data.json  -> agentName
  ~/Desktop/SP Videos/Specific Property Ads/<ref> Ad [ENG|DEU|<LANG>].MP4

Per ref it encodes 540p web proxies (ffmpeg), uploads hero/video/poster files to
`live-grid/<ref>/...`, then merges that ref into `live-grid/manifest.json`, which
lib/live-grid-assets.ts reads at request time. No git commit / deploy needed.

Usage: scripts/sync-live-grid-assets.py [ref ...] [--force] [--dry-run]
  no refs = every ACTIVE numeric-ref property campaign in the live dashboard.
  --force re-encodes + re-uploads even if unchanged. --dry-run only reports.
"""
import json, os, re, subprocess, sys, time, urllib.request, urllib.error
from pathlib import Path

HOME = Path.home() / "Desktop"
LAND = HOME / "LANDINGS" / "sandbergestates.es"
VIDS = HOME / "SP Videos" / "Specific Property Ads"
ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".live-grid-cache"  # encoded proxies + upload state (gitignored)
BUCKET = "live-grid"
FUNNEL_URL = "https://sandberg-funnel-dashboard.vercel.app/api/funnel"
# Video files whose names don't follow "<ref> Ad [LANG].MP4".
VIDEO_ALIAS = {"32859": "Ses Salines Ad.MP4", "32785": "32785 Ad copy.MP4"}
# Language folders/labels to look for; extend when a new ad language is launched.
LANGS = ["ENG", "DEU", "SWE", "FRA", "ESP", "NLD"]


def load_env():
    env = dict(os.environ)
    f = ROOT / ".env.local"
    if f.exists():
        for line in f.read_text().splitlines():
            m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
            if m:
                env.setdefault(m.group(1), m.group(2).strip().strip('"').strip("'"))
    return env


ENV = load_env()
SB = ENV.get("SUPABASE_URL", "").rstrip("/")
KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY", "")


def sh(*a):
    subprocess.run(a, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def api(method, path, body=None, headers=None, raw=False):
    h = {"Authorization": f"Bearer {KEY}", "apikey": KEY, **(headers or {})}
    req = urllib.request.Request(f"{SB}{path}", data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read()
            return data if raw else (json.loads(data) if data else {})
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} -> {e.code} {e.read().decode()[:200]}")


def ensure_bucket():
    try:
        api("POST", "/storage/v1/bucket", json.dumps({"id": BUCKET, "name": BUCKET, "public": True}).encode(),
            {"Content-Type": "application/json"})
        print(f"created public bucket '{BUCKET}'")
    except RuntimeError as e:
        if "already exists" not in str(e) and "Duplicate" not in str(e) and "409" not in str(e):
            raise


def upload(remote, local_or_bytes, ctype, cache="max-age=3600"):
    data = local_or_bytes if isinstance(local_or_bytes, bytes) else Path(local_or_bytes).read_bytes()
    api("POST", f"/storage/v1/object/{BUCKET}/{remote}", data, {"Content-Type": ctype, "x-upsert": "true", "Cache-Control": cache})
    return f"{SB}/storage/v1/object/public/{BUCKET}/{remote}"


def active_refs():
    with urllib.request.urlopen(FUNNEL_URL) as r:
        data = json.load(r)
    return [c["ref"] for c in data["campaigns"]
            if c["status"] == "ACTIVE" and c["campaign_type"] == "property" and re.fullmatch(r"\d+", c["ref"])]


def find_hero(ref):
    for p in [LAND / ref / "hero.jpg", LAND / ref / "ENG" / "hero.jpg", LAND / ref / "DEU" / "hero.jpg"]:
        if p.exists():
            return p


def agent_from_brochure(ref):
    """Fallback: the brochure's last page lists 'LISTING AGENT' / 'YOUR CONTACT' (or the Swedish 'DIN KONTAKTPERSON' / German 'IHR ANSPRECHPARTNER') then the name."""
    pdf = HOME / "LANDINGS" / "BROCHURES" / f"{ref}.pdf"
    if not pdf.exists():
        return None
    try:
        import pypdf
        lines = [l.strip() for l in pypdf.PdfReader(str(pdf)).pages[-1].extract_text().splitlines() if l.strip()]
    except Exception:
        return None
    for i, l in enumerate(lines):
        if re.sub(r"\s+", "", l).upper() in ("LISTINGAGENT", "YOURCONTACT", "DINKONTAKTPERSON", "IHRANSPRECHPARTNER") and i + 1 < len(lines):
            return lines[i + 1].title()


def find_agent(ref):
    for p in [LAND / f"{ref}.data.json", LAND / ref / "ENG.data.json", LAND / ref / "DEU.data.json", LAND / f"{ref}D.data.json"]:
        if p.exists():
            name = json.loads(p.read_text()).get("agentName")
            if name:
                return name
    return agent_from_brochure(ref)


# Hero tagline is usually "Asking price: €5,400,000" / "Kaufpreis: €5.400.000" /
# "Angebotspreis: €8.950.000" (comma or dot as thousands separator), but sometimes a
# marketing line instead — skip those. Older landings (no .data.json) carry the same
# line in index.html's og:description meta tag / hero__tagline instead.
PRICE_RE = re.compile(r"(?:asking price|kaufpreis|angebotspreis)\s*:?\s*€?\s*([\d.,]+)\s*€?", re.IGNORECASE)


def _price_from_text(text):
    m = PRICE_RE.search(text or "")
    if not m:
        return None
    digits = re.sub(r"[.,]", "", m.group(1))
    return int(digits) if digits.isdigit() else None


def find_asking_price(ref):
    for p in [LAND / f"{ref}.data.json", LAND / ref / "ENG.data.json", LAND / ref / "DEU.data.json", LAND / f"{ref}D.data.json"]:
        if not p.exists():
            continue
        price = _price_from_text(json.loads(p.read_text()).get("tagline"))
        if price:
            return price
    for p in [LAND / ref / "index.html", LAND / f"{ref}.html"]:
        if p.exists():
            price = _price_from_text(p.read_text())
            if price:
                return price
    return None


def find_video(ref, lang):
    names = [f"{ref} Ad {lang}.MP4"]
    if lang == "ENG":
        names += ([VIDEO_ALIAS[ref]] if ref in VIDEO_ALIAS else []) + [f"{ref} Ad.MP4"]
    for n in names:
        if (VIDS / n).exists():
            return VIDS / n


def landings(ref):
    d = LAND / ref
    if (d / "index.html").exists():
        base = {"default": f"https://sandbergestates.es/{ref}", "ENG": f"https://sandbergestates.es/{ref}"}
    else:  # language-only landing folders, e.g. 30489/ENG
        base = {"default": f"https://sandbergestates.es/{ref}/ENG", "ENG": f"https://sandbergestates.es/{ref}/ENG"}
    for lang in LANGS:
        if lang != "ENG":
            base[lang] = f"https://sandbergestates.es/{ref}/{lang}"
    return base


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force, dry = "--force" in sys.argv, "--dry-run" in sys.argv
    if not SB or not KEY:
        sys.exit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (.env.local)")
    refs = args or active_refs()
    print("refs:", ", ".join(refs))
    CACHE.mkdir(exist_ok=True)
    state_f = CACHE / "state.json"
    state = json.loads(state_f.read_text()) if state_f.exists() else {}
    if not dry:
        ensure_bucket()
    try:
        manifest = json.loads(api("GET", f"/storage/v1/object/public/{BUCKET}/manifest.json?t={int(time.time())}", raw=True))
    except RuntimeError:
        manifest = {}

    report = []
    for ref in refs:
        entry = {"hero": None, "agent": None, "agentPhoto": None, "askingPrice": None, "videos": {}, "landings": landings(ref)}
        notes = []
        hero = find_hero(ref)
        if hero:
            key = f"{ref}/hero.jpg"
            sig = f"{hero.stat().st_mtime}"
            if force or state.get(key) != sig:
                if not dry:
                    tmp = CACHE / f"{ref}-hero.jpg"
                    sh("ffmpeg", "-y", "-i", str(hero), "-vf", "scale=720:-2", "-q:v", "4", str(tmp))
                    upload(key, tmp, "image/jpeg")
                    state[key] = sig
                notes.append("hero updated")
            entry["hero"] = f"{SB}/storage/v1/object/public/{BUCKET}/{key}"
        else:
            notes.append("NO hero image found")
        agent = find_agent(ref)
        if agent:
            entry["agent"] = agent
            slug = re.sub(r"[^a-z]+", "-", agent.lower()).strip("-")
            # head-and-shoulders crop (scripts/make-agent-avatars.py) preferred over the full-body photo
            for folder in ("team-avatars", "team"):
                if (ROOT / "public" / folder / f"{slug}.jpg").exists():
                    entry["agentPhoto"] = f"/{folder}/{slug}.jpg"
                    break
            if not entry["agentPhoto"]:
                notes.append(f"no team photo for {agent}")
        else:
            notes.append("NO agent name (landing data missing)")
        price = find_asking_price(ref)
        if price:
            entry["askingPrice"] = price
        else:
            notes.append("no asking price in tagline")
        for lang in LANGS:
            src = find_video(ref, lang)
            if not src:
                continue
            vkey, pkey = f"{ref}/{lang}.mp4", f"{ref}/{lang}.jpg"
            sig = f"{src.stat().st_mtime}"
            if force or state.get(vkey) != sig:
                if not dry:
                    mp4, poster = CACHE / f"{ref}-{lang}.mp4", CACHE / f"{ref}-{lang}.jpg"
                    sh("ffmpeg", "-y", "-i", str(src), "-vf", "scale=540:-2", "-c:v", "libx264", "-crf", "30", "-preset", "veryfast",
                       "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", str(mp4))
                    sh("ffmpeg", "-y", "-ss", "1", "-i", str(mp4), "-frames:v", "1", "-q:v", "5", str(poster))
                    upload(vkey, mp4, "video/mp4")
                    upload(pkey, poster, "image/jpeg")
                    state[vkey] = sig
                notes.append(f"{lang} video updated")
            entry["videos"][lang] = {"src": f"{SB}/storage/v1/object/public/{BUCKET}/{vkey}",
                                     "poster": f"{SB}/storage/v1/object/public/{BUCKET}/{pkey}"}
        if not entry["videos"]:
            notes.append("NO video files found")
        manifest[ref] = entry
        report.append((ref, entry, notes))
        print(f"{ref}  agent={entry['agent']}  videos={list(entry['videos'])}  {'; '.join(notes) or 'up to date'}")

    if not dry:
        upload("manifest.json", json.dumps(manifest, indent=2).encode(), "application/json", cache="no-cache, max-age=0")
        state_f.write_text(json.dumps(state, indent=2))
        print(f"manifest.json updated ({len(manifest)} refs)")


main()

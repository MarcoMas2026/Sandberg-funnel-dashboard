#!/usr/bin/env python3
"""
Regenerates lib/properties.ts from ~/Desktop/LANDINGS.

Source of truth for property image/price/agent is NOT this repo — it's the
LANDINGS folder (IMAGES/<ref>/*.jpg, BROCHURES/<ref>.pdf), maintained
separately from the Meta/Typeform campaign map in lib/config.ts. Run this
whenever a new property brochure+photos lands in LANDINGS (new or renewed
campaign) to pick up the new ref.

What it does:
  1. Reads every BROCHURES/<ref>.pdf, extracts asking price, location, and
     listing agent name via text patterns (two known brochure layouts: an
     older "YOUR CONTACT" / "PRICE:" template and a newer "LISTING AGENT" /
     cover-page "€X.XXX.XXX" template).
  2. Picks one representative image per ref from IMAGES/<ref>/ — prefers
     filenames hinting at exterior/aerial/pool shots, falls back to
     excluding obvious interior-detail-room shots (bathroom, kitchen,
     floorplan pages), then falls back to the lowest-numbered file.
  3. Copies the chosen image into public/properties/<ref>.<ext>, resized to
     1200px wide (sips, no Python imaging dep) so cards don't ship raw
     3-10MB camera JPGs.
  4. Writes lib/properties.ts — a plain ref -> {price, location, agent,
     image} map, imported by the leads card UI.

CAVEAT: image selection is a heuristic guess (filename keywords only, no
vision check). Spot-check new refs after running — see CONTEXT.md for the
known-good picks that were manually corrected (32606, 6648).

Requires: pip install pdfplumber (not a repo dependency, run locally/ad hoc).
Run from repo root: python3 scripts/sync-properties.py
"""
import json
import os
import re
import shutil
import subprocess

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANDINGS_DIR = os.path.expanduser("~/Desktop/LANDINGS")
BROCHURE_DIR = os.path.join(LANDINGS_DIR, "BROCHURES")
IMAGES_DIR = os.path.join(LANDINGS_DIR, "IMAGES")
OUT_IMAGE_DIR = os.path.join(REPO_ROOT, "public", "properties")
OUT_TS_FILE = os.path.join(REPO_ROOT, "lib", "properties.ts")

# Known manual corrections to the auto-picked hero image, keyed by ref, as
# {source filename} relative to IMAGES/<ref>/. The heuristic below picks a
# reasonable default from filename keywords alone (no vision check), and
# these overrides record where that default was visually wrong and someone
# picked a better shot by hand. Extend this dict rather than re-guessing.
IMAGE_OVERRIDES = {
    "32606": "DSC04150 copia.jpg",  # heuristic picked a bathroom shot; this is the rooftop terrace
}

PRIORITY_KEYWORDS = [
    "exterior", "aerial", "dji", "fachada", "facade", "view", "vista",
    "pool", "piscina", "azotea", "terraza", "terrace", "jardin", "garden",
    "hero", "cover",
]
BLOCKED_KEYWORDS = [
    "bano", "baño", "dorm", "bed", "garaje", "cocina", "kitchen", "vestidor",
    "sauna", "lavander", " wc", "aseo", "closet", "pasillo", "escritorio",
    "gimnasio", "trastero", "planta", "floor", "chimenea", "compressed",
]


def extract_brochure_fields(pdf_path):
    import pdfplumber

    with pdfplumber.open(pdf_path) as pdf:
        pages = [p.extract_text() or "" for p in pdf.pages]
        joined = "\n".join(pages)

        price = None
        m = re.search(r"PRICE:\s*([\d.,]+)\s*€", joined)
        if m:
            price = m.group(1) + " €"
        else:
            m2 = re.search(r"€\s?([\d]{1,3}(?:[.,]\d{3})+)", joined)
            if m2:
                price = m2.group(1) + " €"

        location = None
        m = re.search(r"LOCATION:\s*([^\n]+?)\s*PRICE", joined)
        if m:
            location = m.group(1).strip()
        else:
            m2 = re.search(r"^([A-ZÀ-Ü' ]{4,40})\s*(?:·|,)\s*MALLORCA", joined, re.M)
            if m2:
                location = m2.group(1).strip().title()

        agent = None
        for label in ["YOUR CONTACT", "LISTING AGENT"]:
            for page_text in pages:
                if label in page_text:
                    lines = page_text.split("\n")
                    for j, line in enumerate(lines):
                        if label in line and j + 1 < len(lines):
                            candidate = lines[j + 1].strip()
                            if candidate and not candidate.startswith("+") and "@" not in candidate:
                                agent = candidate.title()  # normalize e.g. "ANGUS CAMPBELL" -> "Angus Campbell"
                            break
                    break
            if agent:
                break

        return {"price": price, "location": location, "agent": agent}


def numeric_key(fname):
    m = re.search(r"(\d+)(?=\.\w+$)", fname)
    return int(m.group(1)) if m else 9999


def pick_hero_image(files):
    lower = {f: f.lower() for f in files}
    priority_hits = [f for f in files if any(k in lower[f] for k in PRIORITY_KEYWORDS)]
    if priority_hits:
        priority_hits.sort(key=lambda f: (numeric_key(f), f.lower()))
        return priority_hits[0]
    clean = [f for f in files if not any(k in lower[f] for k in BLOCKED_KEYWORDS)]
    pool = clean if clean else files
    pool.sort(key=lambda f: (numeric_key(f), f.lower()))
    return pool[0]


def main():
    os.makedirs(OUT_IMAGE_DIR, exist_ok=True)
    refs = sorted(
        f[:-4] for f in os.listdir(BROCHURE_DIR)
        if f.endswith(".pdf") and f[:-4].isdigit()
    )

    registry = {}
    for ref in refs:
        brochure_path = os.path.join(BROCHURE_DIR, f"{ref}.pdf")
        fields = extract_brochure_fields(brochure_path)

        image_folder = os.path.join(IMAGES_DIR, ref)
        image_path = None
        if os.path.isdir(image_folder):
            override = IMAGE_OVERRIDES.get(ref)
            if override and os.path.isfile(os.path.join(image_folder, override)):
                chosen = override
            else:
                files = [
                    f for f in os.listdir(image_folder)
                    if f.lower().endswith((".jpg", ".jpeg", ".png"))
                    and os.path.isfile(os.path.join(image_folder, f))
                ]
                chosen = pick_hero_image(files) if files else None

            if chosen:
                ext = os.path.splitext(chosen)[1].lower()
                dest_name = f"{ref}{ext}"
                dest_path = os.path.join(OUT_IMAGE_DIR, dest_name)
                shutil.copy2(os.path.join(image_folder, chosen), dest_path)
                subprocess.run(
                    ["sips", "--resampleWidth", "1200", "-s", "formatOptions", "78",
                     dest_path, "--out", dest_path],
                    check=True, capture_output=True,
                )
                image_path = f"/properties/{dest_name}"

        registry[ref] = {
            "price": fields["price"],
            "location": fields["location"],
            "agent": fields["agent"],
            "image": image_path,
        }

    ts_entries = []
    for ref, data in sorted(registry.items()):
        ts_entries.append(
            f'  "{ref}": {{ price: {json.dumps(data["price"])}, '
            f'location: {json.dumps(data["location"])}, '
            f'agent: {json.dumps(data["agent"])}, '
            f'image: {json.dumps(data["image"])} }},'
        )

    ts_content = (
        "// AUTO-GENERATED by scripts/sync-properties.py — do not hand-edit.\n"
        "// Source: ~/Desktop/LANDINGS (IMAGES/<ref>/, BROCHURES/<ref>.pdf), a\n"
        "// folder outside this repo. Re-run the script after a new property's\n"
        "// brochure+photos land in LANDINGS to pick up its ref.\n"
        "//\n"
        "// Keyed by property ref (matches CampaignMapEntry.ref in lib/config.ts,\n"
        "// and the numeric ref embedded in historical campaign_name strings like\n"
        '// "SP - 32785 - Finca Bugambilia" for leads whose campaign has since\n'
        "// been retired from CAMPAIGN_MAP). price/agent are raw strings scraped\n"
        "// from the brochure PDF text, not structured data — display as-is.\n"
        "export interface PropertyInfo {\n"
        "  price: string | null;\n"
        "  location: string | null;\n"
        "  agent: string | null;\n"
        "  image: string | null;\n"
        "}\n\n"
        "export const PROPERTY_REGISTRY: Record<string, PropertyInfo> = {\n"
        + "\n".join(ts_entries) + "\n"
        "};\n"
    )

    with open(OUT_TS_FILE, "w") as f:
        f.write(ts_content)

    print(f"Wrote {len(registry)} properties to {OUT_TS_FILE}")
    print(f"Images synced to {OUT_IMAGE_DIR}")


if __name__ == "__main__":
    main()

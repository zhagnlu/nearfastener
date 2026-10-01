"""Turn the observed Near Fastener pages into editable, self-contained content.

Only rendered markup and the site's observed visual assets are imported. Editor
metadata, tracking scripts, and the remote preview runtime are not included.
"""
from pathlib import Path
from urllib.parse import urlparse
import hashlib
import html
import json
import re
import shutil

ROOT = Path(__file__).resolve().parent.parent
REFERENCE = ROOT / "reference"
CONTENT = ROOT / "content"
ASSETS = ROOT / "public" / "assets"
CONTENT.mkdir(exist_ok=True)
(CONTENT / "pages").mkdir(exist_ok=True)
ASSETS.mkdir(parents=True, exist_ok=True)

def read(name):
    return json.loads((REFERENCE / name).read_text())

paths = read("crawl-index.json")["paths"]
captured = {
    path: read((path.strip("/").replace("/", "__") or "home") + ".json")
    for path in paths
}
available = {
    asset["url"]: asset
    for bundle in read("assets.json")
    for asset in bundle["assets"]
}
wanted = {image["src"] for page in captured.values() for image in page["images"]}
missing = wanted - available.keys()
if missing:
    raise SystemExit("Missing observed images:\n" + "\n".join(sorted(missing)))

asset_map = {}
mapping_file = CONTENT / "assets.json"
existing_assets = json.loads(mapping_file.read_text()) if mapping_file.exists() else {}
for url in sorted(wanted):
    asset = available[url]
    name = Path(urlparse(url).path).stem
    suffix = Path(asset["path"]).suffix
    digest = hashlib.sha256(url.encode()).hexdigest()[:8]
    local_name = f"{name}-{digest}{suffix}"
    # Preserve curated category paths when reimporting an existing image.
    local_url = existing_assets.get(url, "/assets/imports/" + local_name)
    target = ROOT / "public" / local_url.lstrip("/")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(asset["path"], target)
    asset_map[url] = local_url

def clean(markup):
    markup = re.sub(r"<script\b[^>]*>.*?</script>", "", markup, flags=re.S | re.I)
    markup = re.sub(r'\sdata-[\w-]+="[^"]*"', "", markup)
    markup = re.sub(r'\son\w+="[^"]*"', "", markup, flags=re.I)
    # The source hides off-screen sections until its React observer reveals them.
    # Render them accessibly by default and attach our small optional observer.
    markup = re.sub(
        r'class="([^"]*\btransition-all duration-500 opacity-(?:0|100) translate-y-(?:0|6)[^"]*)"',
        lambda m: 'data-reveal="" class="' + m[1].replace("opacity-0", "opacity-100").replace("translate-y-6", "translate-y-0") + '"',
        markup,
    )
    for url, local in asset_map.items():
        markup = markup.replace(html.escape(url, quote=True), local).replace(url, local)
    markup = markup.replace('<main class="', '<main id="main-content" class="', 1)
    return markup

routes = {}
for route, page in captured.items():
    file = (route.strip("/") or "home") + ".html"
    target = CONTENT / "pages" / file
    target.parent.mkdir(parents=True, exist_ok=True)
    markup = clean(page["main"])
    if route == "/standards":
        for title, anchor in [("GB / GB/T", "gb"), ("DIN", "din"), ("ISO", "iso"), ("ASTM / ASME", "astm")]:
            markup = re.sub(r'(<h2\b)([^>]*>\s*' + re.escape(title) + r')', r'\1 id="' + anchor + r'"\2', markup, count=1)
    if route in {"/contact", "/rfq"}:
        # Keep the original layout, associate labels, and make preview behavior clear.
        field_names = (["name", "email", "subject", "message"] if route == "/contact" else
                       ["product", "standard", "diameter", "length", "thread_pitch", "material", "property_class", "surface_treatment", "quantity", "destination", "drawing", "message", "name", "email"])
        iterator = iter(field_names)
        def field(m):
            tag = m[0]
            name = next(iterator)
            field_id = "file-upload" if name == "drawing" else "field-" + name
            if ' id="' not in tag:
                tag = tag[:-1] + f' id="{field_id}">'
            return tag[:-1] + f' name="{name}">'
        markup = re.sub(r"<(?:input|textarea)\b[^>]*>", field, markup)
        markup = re.sub(r'<label(?![^>]*\bfor=)([^>]*)>([^<]*)</label>(<input[^>]*id="([^"]+)"[^>]*>|<textarea[^>]*id="([^"]+)"[^>]*>)',
                        lambda m: '<label for="' + (m[4] or m[5]) + '"' + m[1] + '>' + m[2] + '</label>' + m[3], markup)
        markup = markup.replace('<form ', '<form data-preview-form="' + route.strip("/") + '" ')
        markup = markup.replace('<button type="submit"', '<p class="preview-form-note">Preview form: no message or file will be sent.</p><button type="submit"')
        markup = markup.replace('</form>', '<div class="form-feedback" role="status" aria-live="polite" hidden></div></form>')
        markup = markup.replace('id="file-upload"', 'aria-label="Upload Drawing / RFQ" id="file-upload"')
    target.write_text(markup + "\n")
    routes[route] = {"title": page["title"], "description": page.get("description") or "Industrial fasteners manufactured to GB, DIN, ISO and ASTM standards. Near Fastener.", "file": file}

(CONTENT / "header.html").write_text(clean(captured["/"]["header"]) + "\n")
(CONTENT / "footer.html").write_text(clean(captured["/"]["footer"]) + "\n")
(CONTENT / "routes.json").write_text(json.dumps(routes, indent=2, ensure_ascii=False) + "\n")
(CONTENT / "assets.json").write_text(json.dumps(asset_map, indent=2) + "\n")
css = next(style["css"] for style in captured["/"]["styles"] if style["id"].endswith("/src/index.css"))
(ROOT / "public" / "site.css").write_text(css)
print(f"Imported {len(routes)} pages and {len(asset_map)} original images.")

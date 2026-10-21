#!/usr/bin/env python3
"""Alat pemeliharaan KuisKelas.

  python3 tools/kuiskelas.py sync       Salin engine/kuiskelas.{js,css} ke semua file materi
  python3 tools/kuiskelas.py manifest   Tulis materi.json (daftar materi untuk KuisKelas Online)
  python3 tools/kuiskelas.py check      Pastikan semua materi memakai mesin terbaru dan manifest mutakhir
  python3 tools/kuiskelas.py            sync lalu manifest

Materi = setiap file .html di dalam folder mata kuliah (bukan index.html, engine/, online/, tools/).
Hanya blok mesin yang disentuh; isi materi, soal, dan skrip khusus materi tidak diubah.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENGINE_JS = ROOT / 'engine' / 'kuiskelas.js'
ENGINE_CSS = ROOT / 'engine' / 'kuiskelas.css'
MANIFEST = ROOT / 'materi.json'
# Kunci teks soal, ditulis gaya JS (q: "...") maupun JSON ("q": "...")
Q_KEY = re.compile(r"""(?<![\w$])["']?q["']?\s*:\s*["'`]""")
SKIP_DIRS = {'engine', 'online', 'tools', 'node_modules'}

CSS_MARK = '<!-- KUISKELAS:ENGINE-CSS -->'
JS_MARK = '<!-- KUISKELAS:ENGINE-JS -->'
# Blok <style>/<script> mesin dikenali dari komentar pembukanya, dengan atau tanpa penanda di atasnya.
CSS_RE = re.compile(r'(?:<!-- KUISKELAS:ENGINE-CSS -->\s*)?<style>\s*/\*! KuisKelas engine CSS v[^<]*?</style>', re.S)
JS_RE = re.compile(r'(?:<!-- KUISKELAS:ENGINE-JS -->\s*)?<script>\s*/\*!\s*\n \* KuisKelas engine v.*?</script>', re.S)


def materials():
    for p in sorted(ROOT.rglob('*.html')):
        rel = p.relative_to(ROOT)
        if len(rel.parts) < 2 or rel.parts[0] in SKIP_DIRS or rel.parts[0].startswith('.'):
            continue
        yield p, rel


def engine_blocks():
    css = ENGINE_CSS.read_text(encoding='utf-8').rstrip() + '\n'
    js = ENGINE_JS.read_text(encoding='utf-8').rstrip() + '\n'
    return f'{CSS_MARK}\n<style>\n{css}</style>', f'{JS_MARK}\n<script>\n{js}\n</script>'


def synced(html):
    """Kembalikan (html_baru, status). status: 'engine' atau 'legacy' (tanpa mesin KuisKelas)."""
    css_block, js_block = engine_blocks()
    if not CSS_RE.search(html) or not JS_RE.search(html):
        return html, 'legacy'
    html = CSS_RE.sub(lambda m: css_block, html, count=1)
    html = JS_RE.sub(lambda m: js_block, html, count=1)
    return html, 'engine'


def cmd_sync():
    changed = 0
    for p, rel in materials():
        old = p.read_text(encoding='utf-8')
        new, kind = synced(old)
        if kind == 'legacy':
            print(f'  lewati (format lama, tanpa mesin): {rel}')
        elif new != old:
            p.write_text(new, encoding='utf-8')
            changed += 1
            print(f'  diperbarui: {rel} ({len(old.encode()) // 1024} KB -> {len(new.encode()) // 1024} KB)')
    print(f'sync: {changed} file diperbarui')


def js_string(block, key):
    m = re.search(r'\b' + key + r'\s*:\s*(["\'])((?:\\.|(?!\1).)*)\1', block)
    return m.group(2) if m else ''


def describe(p, rel):
    html = p.read_text(encoding='utf-8')
    title = re.search(r'<title>(.*?)</title>', html, re.S)
    title = re.sub(r'\s+', ' ', title.group(1)).strip() if title else rel.stem
    title = re.sub(r'\s*[:|]\s*Rangkuman dan Kuis( Kahoot)?$', '', title)
    item = {'path': rel.as_posix(), 'folder': rel.parts[0], 'file': rel.name, 'title': title}
    course = re.search(r'window\.COURSE\s*=\s*\{(.*?)\n\};', html, re.S)
    if course:
        body = course.group(1)
        head = body.split('questions', 1)[0]
        item.update({'format': 'kuiskelas', 'id': js_string(head, 'id'),
                     'short': js_string(head, 'short') or title,
                     'questions': len(Q_KEY.findall(body))})
    else:
        legacy = re.search(r'\bconst Q\s*=\s*\[(.*?)\n\];', html, re.S)
        item.update({'format': 'legacy', 'id': '', 'short': title,
                     'questions': len(Q_KEY.findall(legacy.group(1))) if legacy else 0})
    return item


def build_manifest():
    items = [describe(p, rel) for p, rel in materials()]
    folders = []
    for it in items:
        if it['folder'] not in folders:
            folders.append(it['folder'])
    return {'generator': 'tools/kuiskelas.py', 'folders': folders, 'materials': items}


def manifest_text():
    return json.dumps(build_manifest(), ensure_ascii=False, indent=2) + '\n'


def cmd_manifest():
    MANIFEST.write_text(manifest_text(), encoding='utf-8')
    n = len(build_manifest()['materials'])
    print(f'manifest: {n} materi ditulis ke {MANIFEST.relative_to(ROOT)}')


def cmd_check():
    bad = []
    for p, rel in materials():
        old = p.read_text(encoding='utf-8')
        new, kind = synced(old)
        if kind == 'engine' and new != old:
            bad.append(f'mesin usang: {rel}')
        if kind == 'engine' and re.search(r'supabase', old, re.I):
            bad.append(f'masih memuat kode online: {rel}')
    if not MANIFEST.exists() or MANIFEST.read_text(encoding='utf-8') != manifest_text():
        bad.append('materi.json belum mutakhir')
    for b in bad:
        print('  ' + b)
    print('check: ' + ('gagal, jalankan "python3 tools/kuiskelas.py"' if bad else 'semua materi mutakhir'))
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if cmd == 'sync':
        cmd_sync()
    elif cmd == 'manifest':
        cmd_manifest()
    elif cmd == 'check':
        sys.exit(cmd_check())
    elif cmd == 'all':
        cmd_sync()
        cmd_manifest()
    else:
        print(__doc__)
        sys.exit(2)

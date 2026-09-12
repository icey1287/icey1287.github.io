#!/usr/bin/env python3
"""Build a self-contained homepage from editable content and bundled libraries."""
from pathlib import Path
import json
import re
import html

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / 'content'
MANIFEST = json.loads((CONTENT / 'manifest.json').read_text(encoding='utf-8'))

def main():
    # Decode bytes directly to preserve the uploaded Markdown's exact line endings.
    files = {p.relative_to(CONTENT).as_posix(): p.read_bytes().decode('utf-8')
             for p in sorted(CONTENT.rglob('*'))
             if p.is_file() and p.name != 'manifest.json' and p.suffix in ('.md', '.json')}
    (CONTENT / 'blog').mkdir(exist_ok=True)
    template = (ROOT / 'src/profile.template.js').read_text(encoding='utf-8')
    profile = template.replace('/*__MANIFEST__*/', json.dumps(MANIFEST, ensure_ascii=False, indent=2))
    profile = profile.replace('/*__CONTENT__*/', json.dumps(files, ensure_ascii=False, indent=2))
    (ROOT / 'src/profile.js').write_text(profile, encoding='utf-8')
    parts = ['app-head.js','icons.js','documents.part.js','eggs.part.js','effects.part.js',
             'commands.part.js','input.part.js','boot.part.js']
    app = '\n'.join((ROOT / 'src' / name).read_text(encoding='utf-8') for name in parts)
    (ROOT / 'src/app.js').write_text(app, encoding='utf-8')
    content = (ROOT / 'src/template.html').read_text(encoding='utf-8')
    rows = []
    for item in MANIFEST['projects']:
        slug = item['slug']
        if not re.fullmatch('[a-z0-9-]+', slug) or f'projects/{slug}.md' not in files:
            raise ValueError(f'Invalid or missing project: {slug}')
        rows.append(f'            <button class="file-item" type="button" data-doc="projects/{slug}">'
                    f'<span class="file-glyph">M↓</span><span>{html.escape(slug)}.md</span></button>')
    content = content.replace('/*__PROJECT_COUNT__*/', str(len(rows))).replace('/*__PROJECT_NAV__*/', '\n'.join(rows))
    for marker, path in [('STYLE','src/style.css'),('XTERM_CSS','vendor/xterm.css'),
                         ('MARKED','vendor/marked.js'),('XTERM','vendor/xterm.js'),
                         ('PROFILE','src/profile.js'),('SHELL','src/shell.js'),('APP','src/app.js')]:
        source = (ROOT / path).read_text(encoding='utf-8')
        if marker not in ['STYLE', 'XTERM_CSS']:
            source = re.sub(r'</script', r'<\\/script', source, flags=re.I)
        content = content.replace(f'/*__{marker}__*/', source)
    (ROOT / 'index.html').write_text(content, encoding='utf-8')
    print(f'Built {ROOT / "index.html"} ({len(content.encode()):,} bytes)')

if __name__ == '__main__':
    main()

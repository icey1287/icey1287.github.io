#!/usr/bin/env python3
"""Build a self-contained homepage from editable content and bundled libraries."""
from pathlib import Path
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / 'content'
MANIFEST = json.loads((CONTENT / 'manifest.json').read_text(encoding='utf-8'))

def activity_markdown(files):
    """Content dates come from Git, independently of build or checkout times."""
    sections = {'KNOWLEDGE_UPDATES': [], 'SPACE_UPDATES': []}
    for path, text in files.items():
        if not text.strip() or not path.endswith('.md'):
            continue
        if path.startswith(('Notes/', 'blog/')):
            section = 'KNOWLEDGE_UPDATES'
        elif path.startswith(('projects/', 'life/Travel/')):
            section = 'SPACE_UPDATES'
        else:
            continue
        date = subprocess.check_output(
            ['git', 'log', '-1', '--format=%cs', '--', 'content/' + path], cwd=ROOT, text=True).strip()
        if not date:
            continue
        heading = re.search(r'^# (.+)$', text, re.M)
        title = heading.group(1) if heading else Path(path).stem
        sections[section].append((date, path, title))
    source = files['空间动态.md']
    for name, entries in sections.items():
        entries.sort(key=lambda entry: entry[1])
        entries.sort(key=lambda entry: entry[0], reverse=True)
        rows = [f'- {date} · [{title}](#{path[:-3]})' for date, path, title in entries[:8]]
        source = source.replace(f'<!-- {name} -->', '\n'.join(rows))
    return source

def main():
    # Decode bytes directly to preserve the uploaded Markdown's exact line endings.
    files = {p.relative_to(CONTENT).as_posix(): p.read_bytes().decode('utf-8')
             for p in sorted(CONTENT.rglob('*'))
             if p.is_file() and p.name != 'manifest.json' and p.suffix in ('.md', '.json')}
    files['空间动态.md'] = activity_markdown(files)
    template = (ROOT / 'src/profile.template.js').read_text(encoding='utf-8')
    profile = template.replace('/*__MANIFEST__*/', json.dumps(MANIFEST, ensure_ascii=False, indent=2))
    profile = profile.replace('/*__CONTENT__*/', json.dumps(files, ensure_ascii=False, indent=2))
    (ROOT / 'src/profile.js').write_text(profile, encoding='utf-8')
    parts = ['app-head.js','icons.js','routes.js','motion.part.js','documents.part.js','eggs.part.js','effects.part.js',
             'commands.part.js','input.part.js','boot.part.js']
    app = '\n'.join((ROOT / 'src' / name).read_text(encoding='utf-8') for name in parts)
    (ROOT / 'src/app.js').write_text(app, encoding='utf-8')
    content = (ROOT / 'src/template.html').read_text(encoding='utf-8')
    for item in MANIFEST['projects']:
        slug = item['slug']
        if not re.fullmatch('[a-z0-9-]+', slug) or f'projects/{slug}.md' not in files:
            raise ValueError(f'Invalid or missing project: {slug}')
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

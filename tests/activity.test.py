"""Verify update dates against a real, isolated Git history."""
from pathlib import Path
import importlib.util
import os
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('icey_build', ROOT / 'build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class ActivityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.previous_root = build.ROOT
        build.ROOT = self.root
        self.files = {'空间动态.md': (ROOT / 'content/空间动态.md').read_text()}
        self.git('init', '-q')
        self.git('config', 'user.name', 'Activity fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')

    def tearDown(self):
        build.ROOT = self.previous_root
        self.temp.cleanup()

    def git(self, *args, date=None):
        env = dict(os.environ)
        if date:
            env.update(GIT_AUTHOR_DATE=date+'T12:00:00+08:00', GIT_COMMITTER_DATE=date+'T12:00:00+08:00')
        return subprocess.check_output(['git', *args], cwd=self.root, env=env, text=True).strip()

    def add(self, path, text, date=None):
        self.files[path] = text
        target = self.root / 'content' / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
        if date:
            self.git('add', 'content/'+path)
            self.git('commit', '-qm', path, date=date)

    def test_dates_are_content_dates_and_empty_or_uncommitted_files_are_excluded(self):
        self.add('Notes/new.md', '# New research\n', '2026-10-10')
        self.add('blog/old.md', '# Older reflection\n', '2026-10-03')
        self.add('projects/a.md', '# A project\n', '2026-10-04')
        self.add('life/Travel/香港.md', '', '2026-10-11')
        self.add('Notes/draft.md', '# Local draft\n')
        style = self.root / 'style.css'
        style.write_text('body { color: green; }')
        self.git('add', 'style.css')
        self.git('commit', '-qm', 'Only visual changes', date='2026-10-25')
        text = build.activity_markdown(self.files)
        self.assertIn('2026-10-10 · [New research]', text)
        self.assertIn('2026-10-03 · [Older reflection]', text)
        self.assertLess(text.index('[New research]'), text.index('[Older reflection]'))
        self.assertIn('2026-10-04 · [A project]', text)
        self.assertNotIn('#life/Travel/香港)', text)
        self.assertNotIn('Local draft', text)
        self.assertNotIn('2026-10-25', text)
        self.assertNotIn('<!--', text)

    def test_each_section_is_limited_to_eight_with_stable_same_day_order(self):
        for prefix in ['Notes', 'projects']:
            for i in reversed(range(10)):
                self.add(f'{prefix}/{i:02}.md', f'# {prefix} {i}\n', '2026-10-12')
        text = build.activity_markdown(self.files)
        for prefix in ['Notes', 'projects']:
            self.assertEqual(text.count(f'](#{prefix}/'), 8)
            self.assertLess(text.index(f'](#{prefix}/00)'), text.index(f'](#{prefix}/07)'))
            self.assertNotIn(f'](#{prefix}/08)', text)

    def test_travel_enters_updates_when_it_has_committed_content(self):
        self.add('life/Travel/香港.md', '# 香港\n\n沿途的记录。\n', '2026-10-20')
        text = build.activity_markdown(self.files)
        self.assertIn('2026-10-20 · [香港](#life/Travel/香港)', text)


if __name__ == '__main__':
    unittest.main()

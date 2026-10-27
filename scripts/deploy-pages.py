"""Build and publish this repository's frontend to its own GitHub Pages branch."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent

def run(args, **kwargs):
    return subprocess.run(args, check=True, text=True, **kwargs)

def main():
    token = run(['gh', 'auth', 'token', '--user', 'reimage-demo'], capture_output=True).stdout.strip()
    env = {**os.environ, 'GH_TOKEN': token}
    env.setdefault('VITE_CONVEX_URL', 'https://sincere-turtle-299.convex.cloud')
    remote = run(['git', 'remote', 'get-url', 'origin'], cwd=ROOT, capture_output=True).stdout.strip()
    if not remote.startswith('https://github.com/reimage-demo/'):
        raise SystemExit('Expected the origin remote to be a Reimage repository.')
    source_sha = run(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, capture_output=True).stdout.strip()
    run(['npm', 'run', 'build'], cwd=ROOT, env=env)
    if not (ROOT / 'dist/index.html').is_file():
        raise SystemExit('Build output is missing index.html.')
    with tempfile.TemporaryDirectory(prefix='botticello-pages-') as temporary:
        target = Path(temporary)
        git = ['git', '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential']
        def g(*args, **kwargs):
            return run([*git, *args], cwd=target, env=env, **kwargs)
        g('init', '-b', 'gh-pages', '--quiet')
        g('remote', 'add', 'origin', remote)
        existing = g('ls-remote', '--heads', 'origin', 'gh-pages', capture_output=True).stdout.strip()
        if existing:
            g('fetch', '--depth=1', 'origin', 'gh-pages')
            g('reset', '--soft', 'FETCH_HEAD')
        shutil.copytree(ROOT / 'dist', target, dirs_exist_ok=True)
        (target / '.nojekyll').touch()
        g('add', '-A')
        changed = subprocess.run([*git, 'diff', '--cached', '--quiet'], cwd=target, env=env).returncode
        if changed == 1:
            g('-c', 'user.name=REIMAGE BUSINESS SOLUTIONS', '-c', 'user.email=reimage-demo@users.noreply.github.com', 'commit', '-m', 'Publish frontend from ' + source_sha)
            g('push', 'origin', 'HEAD:gh-pages')
        elif changed != 0:
            raise SystemExit('Could not inspect deployment changes.')
        else:
            print('The published build is already current.')

if __name__ == '__main__':
    main()

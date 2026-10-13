import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const branch = 'push_remote';
const dryRun = process.argv.includes('--dry-run');
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
if (git(['branch', '--show-current']) === branch) throw new Error('Run publishing from the development branch, not push_remote.');
if (git(['status', '--porcelain'])) throw new Error('Commit development changes before publishing.');
const sourceCommit = git(['rev-parse', 'HEAD']);
const origin = git(['remote', 'get-url', 'origin']);
if (!existsSync(join(root, 'static-site/index.html'))) throw new Error('Static export is missing index.html.');
const marker = join(root, 'static-site/.ecs-build.json');
if (!existsSync(marker)) throw new Error('Run npm run build:ecs and preview the result before publishing.');
const build = JSON.parse(readFileSync(marker, 'utf8'));
if (build.sourceCommit !== sourceCommit) throw new Error('Development commit changed since the ECS build. Run build:ecs and preview again.');

// A separate temporary checkout preserves the development branch and its files.
const publishRoot = mkdtempSync(join(tmpdir(), 'nearfastener-publish-'));
try {
  git(['init', '-b', branch], publishRoot);
  git(['remote', 'add', 'origin', origin], publishRoot);
  const ref = git(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], publishRoot);
  if (ref) {
    git(['fetch', '--depth=1', 'origin', branch], publishRoot);
    git(['reset', '--mixed', 'FETCH_HEAD'], publishRoot);
  }
  cpSync(join(root, 'static-site'), publishRoot, { recursive: true, filter: (path) => path !== marker });
  mkdirSync(join(publishRoot, '.github/workflows'), { recursive: true });
  cpSync(join(root, '.github/workflows/deploy-ecs.yml'), join(publishRoot, '.github/workflows/deploy-ecs.yml'));
  git(['config', 'user.name', git(['show', '-s', '--format=%cn', 'HEAD'])], publishRoot);
  git(['config', 'user.email', git(['show', '-s', '--format=%ce', 'HEAD'])], publishRoot);
  git(['add', '-A'], publishRoot);
  const changes = git(['diff', '--cached', '--name-only'], publishRoot);
  if (!changes) {
    console.log('Published files already match push_remote.');
  } else {
    git(['commit', '-m', `Publish static website from ${sourceCommit.slice(0, 7)}`], publishRoot);
    if (dryRun) console.log('Dry run passed: static-only publication commit prepared; nothing pushed.');
    else {
      // No force push: concurrent remote changes cause a safe rejection.
      execFileSync('git', ['push', 'origin', `HEAD:refs/heads/${branch}`], { cwd: publishRoot, stdio: 'inherit' });
      console.log(`Published ${sourceCommit.slice(0, 7)} to ${branch}. ECS workflow will sync the files.`);
    }
  }
} finally {
  rmSync(publishRoot, { recursive: true, force: true });
}

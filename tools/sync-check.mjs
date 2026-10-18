// Run at the start of every Claude Code session (the SessionStart hook in .claude/settings.json), on any machine.
// It fetches from GitHub, brings this machine's main up to date, and reports what changed elsewhere, so work pushed from another computer
// is never a surprise.
// main is fast-forwarded only (owner, 2026-10-18: "make sure its auto updated moving forward so we dont have to manually do this"): every
// change reaches main through a pull request, so main never holds work of its own and a fast-forward cannot lose any. If main has commits
// GitHub does not, or uncommitted files the update would change, git refuses and the report says so. When package-lock.json changed, or
// node_modules is missing, it runs `npm ci` there. It never touches any other branch: those are only reported (see docs/SYNC.md).
// Usage: node tools/sync-check.mjs   (prints a short plain-text report; always exits 0)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, GIT_TERMINAL_PROMPT:'0', GH_PROMPT_DISABLED:'1' };
const run = (cmd, args, timeout = 8000, cwd = ROOT, shell = false) => {
  try { return execFileSync(cmd, args, { cwd, env, timeout, encoding:'utf8', stdio:['ignore', 'pipe', 'ignore'], windowsHide:true, shell }).trimEnd(); }
  catch (e) { return null; }
};
const git = (...a) => run('git', a);
const lines = s => (s || '').split('\n').filter(Boolean);
const out = [];
const say = s => out.push(s);

if (git('rev-parse', '--is-inside-work-tree') !== 'true'){ process.exit(0); }
const fetched = run('git', ['fetch', '--all', '--prune', '--quiet'], 20000) !== null;
const branch = git('rev-parse', '--abbrev-ref', 'HEAD') || '?';
const host = process.platform === 'win32' ? 'Windows desktop' : process.platform === 'darwin' ? 'MacBook' : process.platform;

say(`[sync-check] ${host}, on branch ${branch}. ${fetched ? 'Fetched from GitHub just now.' : 'Could not reach GitHub (offline?): this report uses the last fetch.'}`);
const ab = (a, b) => { const r = git('rev-list', '--left-right', '--count', `${a}...${b}`); if (!r) return null; const [x, y] = r.split(/\s+/).map(Number); return { ahead:x, behind:y }; };

// main up to date: in the folder that has it checked out (this one, or the main folder when this session runs in a worktree), else the
// branch alone is moved
if (fetched && git('rev-parse', '--verify', '--quiet', 'main') && git('rev-parse', '--verify', '--quiet', 'origin/main')){
  const before = git('rev-parse', 'main'), target = git('rev-parse', 'origin/main'), c = ab('main', 'origin/main');
  if (c && c.behind){
    let dir = null, mainDir = null;
    for (const l of lines(git('worktree', 'list', '--porcelain'))){ if (l.startsWith('worktree ')) dir = l.slice(9); else if (l === 'branch refs/heads/main') mainDir = dir; }
    if (c.ahead) say(`- Local main has ${c.ahead} commit(s) GitHub does not have, so it was not updated: tell the owner.`);
    else {
      const ok = mainDir ? run('git', ['-C', mainDir, 'merge', '--ff-only', '--quiet', 'origin/main'], 30000) !== null : git('update-ref', 'refs/heads/main', target, before) !== null;
      if (!ok) say(`- Local main is ${c.behind} commit(s) behind GitHub and could not be fast-forwarded (uncommitted files there that GitHub's version changes?): run git status in ${mainDir || 'this folder'}.`);
      else {
        let ver = ''; try { ver = JSON.parse(git('show', 'origin/main:package.json')).version; } catch (e) {}
        const prs = lines(git('log', '--first-parent', '--merges', '--format=%s', `${before}..${target}`)).map(s => (s.match(/^Merge pull request (#\d+)/) || [])[1]).filter(Boolean);
        say(`- Updated main by ${c.behind} commit(s)${ver ? ` to ${ver}` : ''}${prs.length ? ` (${prs.reverse().join(', ')})` : ''}${mainDir ? '' : ' (the branch only: no folder has it checked out)'}.`);
        // (the packages: when the lockfile changed, or node_modules is missing; npm ci never rewrites the lockfile, where npm install did)
        if (mainDir){
          const lockChanged = git('diff', '--quiet', before, target, '--', 'package-lock.json') === null, missing = !fs.existsSync(path.join(mainDir, 'node_modules', '.package-lock.json'));
          if (lockChanged || missing){
            const done = run('npm', ['ci', '--no-audit', '--no-fund'], 150000, mainDir, true) !== null;
            say(done ? `- Installed the packages there (npm ci${missing ? ': node_modules was missing' : ': package-lock.json changed'}).` : `- npm ci failed in ${mainDir}: run npm install there.`);
          }
        }
      }
    }
  }
}

// this branch against its upstream, and main against origin/main
const up = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}');
if (up){ const c = ab('HEAD', up); if (c && (c.ahead || c.behind)) say(`- ${branch} is ${c.behind} commit(s) behind and ${c.ahead} ahead of ${up}.`); }
else say(`- ${branch} has no upstream on GitHub yet (never pushed).`);
if (branch !== 'main' && git('rev-parse', '--verify', '--quiet', 'main')){ const c = ab('main', 'origin/main'); if (c && c.behind) say(`- Local main is ${c.behind} commit(s) behind origin/main.`); }
{ const c = ab('HEAD', 'origin/main'); if (c && c.behind && branch !== 'main') say(`- origin/main has ${c.behind} commit(s) this branch does not have yet.`); }

// what this machine has that GitHub does not: uncommitted files and unpushed commits
const dirty = lines(git('status', '--porcelain')).map(l => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop());
const unpushed = up ? lines(git('diff', '--name-only', `${up}...HEAD`)) : lines(git('diff', '--name-only', 'origin/main...HEAD'));
const mine = new Set([...dirty, ...unpushed]);
if (dirty.length) say(`- ${dirty.length} uncommitted file(s) here: ${dirty.slice(0, 12).join(', ')}${dirty.length > 12 ? ', ...' : ''}`);

// work in flight on GitHub: remote branches not merged into main, newest first (the open PRs are among them)
const prs = {};
{ const j = run('gh', ['pr', 'list', '--state', 'open', '--limit', '30', '--json', 'number,title,headRefName,baseRefName,author,updatedAt'], 15000);
  if (j){ try { for (const p of JSON.parse(j)) prs[p.headRefName] = p; } catch (e) {} } }
const refs = lines(git('for-each-ref', '--sort=-committerdate', '--format=%(refname:short)|%(committerdate:short)|%(subject)', 'refs/remotes/origin'))
  .map(l => { const [ref, date, ...s] = l.split('|'); return { ref, name:ref.replace(/^origin\//, ''), date, subject:s.join('|') }; })
  .filter(r => r.name !== 'HEAD' && r.name !== 'main' && r.ref !== 'origin');
const open = refs.filter(r => prs[r.name] || git('merge-base', '--is-ancestor', r.ref, 'origin/main') === null);
const recent = open.filter(r => prs[r.name] || Date.now() - Date.parse(r.date) < 21*864e5).slice(0, 10);
if (recent.length){
  say('- Work on GitHub not yet in main (newest first):');
  for (const r of recent){
    const p = prs[r.name], files = lines(git('diff', '--name-only', `origin/main...${r.ref}`));
    const clash = files.filter(f => mine.has(f));
    const local = git('rev-parse', '--verify', '--quiet', r.name), lc = local ? ab(r.name, r.ref) : null;
    say(`  * ${r.name}${p ? ` (PR #${p.number}${p.author && p.author.login !== 'eshin087' ? `, author ${p.author.login}: NOT the owner, see CLAUDE.md rule zero` : ''}${p.baseRefName !== 'main' ? `, stacked on ${p.baseRefName}` : ''})` : ''}, ${r.date}: ${p ? p.title : r.subject}`
      + `${local ? (lc && lc.behind ? ` [local copy is ${lc.behind} commit(s) behind]` : '') : ' [not checked out here]'}`
      + `${clash.length ? `\n    ! also changed here (uncommitted or unpushed): ${clash.join(', ')}` : ''}`);
  }
}
if (!fetched || out.some(l => !/^\[sync-check\]|^- Updated main|^- Installed the packages/.test(l))){
  say('main is kept up to date by this check. For anything else above, tell the owner what is new before editing, and integrate only when they say so (docs/SYNC.md). Never force-push.');
}
else say('- Everything here matches GitHub.');
process.stdout.write(out.join('\n') + '\n');

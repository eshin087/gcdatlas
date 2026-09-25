# Workflow: how changes get from an idea to the live site

The goal: keep adding features and content for years without breaking what already works, and make it cheap to try ideas that might be thrown away.

## Environments

| Environment | Where | Built from |
| --- | --- | --- |
| Local | `node build.mjs` then open `dist/index.html`, or `npx vercel dev` (with `/api`) | your working copy |
| Preview | a unique `*.vercel.app` URL per pull request (Vercel posts it on the PR) | the PR branch |
| Production | https://gcdatlas.vercel.app | `main` |

## The loop

1. **Plan**: write the idea as a GitHub issue (or a line in `docs/ROADMAP.md`). Say what "done" looks like and whether it needs a feature flag.
2. **Branch**: `git switch -c feat/short-name` (also `fix/…`, `content/…`, `docs/…`, `exp/…` for experiments).
3. **Build it** in small commits. New experimental or networked features go behind a flag (`docs/FEATURE_FLAGS.md`), default off.
4. **Check it**:
   - `node build.mjs` (syntax check) and `npm test` (smoke test).
   - `npm run test:tour` when touching the camera, tours or anything global.
   - Screenshots of every view you changed: `npm run shots -- key:0,key:1`. Look at them.
   - Phone layout: `npm run shots -- --phone key:0`.
   - `npm run catalog` when objects were added or removed.
5. **Record it**: add a line to `docs/CHANGELOG.md` under *Unreleased*; update `docs/ACCURACY.md` if something illustrative was added.
6. **Pull request**: push the branch, open a PR, open the Vercel preview on desktop and phone. Merge when happy (squash merge keeps history readable).
7. **Release**: `main` deploys automatically. For a named release, move *Unreleased* to a version heading, bump `package.json`, tag `vX.Y.Z`.

## Versioning

- Patch (0.7.1): fixes and small content additions.
- Minor (0.8.0): new features or content packs.
- Major (1.0.0): when the site is considered complete enough to promote widely, or a breaking change to share links or saved settings.

Saved state (settings, collection, share links) must keep working across versions. If a format must change, migrate the old value when reading it.

## Rolling back

Vercel keeps every deployment: in the Vercel dashboard, *Deployments* → pick the last good one → *Promote to Production*. Then revert the bad commit on `main` (`git revert <sha>`).

## Experiments that might be scrapped

- Build them on an `exp/…` branch behind a flag that defaults to `false`.
- Keep their code in their own file(s) (for example `src/objects/x-social.js`, `api/comments.js`) and touch shared files only through small hooks, so deleting the experiment is deleting files plus a few lines.
- Try them on a preview URL, or in production with `?flags=name` for yourself only.

## Definition of done

- Builds, tests pass, no console errors.
- Works on a phone (layout and touch) and with reduced motion.
- Every new object: true fact, real readout numbers, 2–3 views, search words.
- Nothing visitor-identifying leaves the device.
- Changelog updated.

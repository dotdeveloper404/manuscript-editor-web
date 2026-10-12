# Manuscript Editor: product website

A one-page product and download site. Plain HTML, CSS and JavaScript with **no dependencies**, so it builds in
under a second and deploys anywhere static. Deployed to **Vercel** by GitHub Actions
(`.github/workflows/website.yml`).

```
website/
  src/index.html, styles.css, main.js, favicon.svg   the page (sections: hero, features, how it works,
                                                     audio, formatting, privacy, details, FAQ, download)
  site.config.json    default download link, version and size
  scripts/build.mjs   checks the page, copies src/ to dist/ and writes dist/config.js
  vercel.json         build settings, security headers; Vercel's own Git deploys are off (CI deploys instead)
```

## Change the download link

The installer (`desktop/dist/ManuscriptEditor-Setup.exe`) is too large to host on Vercel, so host it somewhere
else. A **GitHub Release** is free and simple:

1. On GitHub, open the repository, then **Releases → Draft a new release**, and attach `ManuscriptEditor-Setup.exe`.
2. Copy the file's link (it looks like `https://github.com/<you>/<repo>/releases/download/v0.9.0/ManuscriptEditor-Setup.exe`).
3. Put it in GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   - `DOWNLOAD_URL`: the link (must start with `https://`)
   - `APP_VERSION` (optional): for example `0.9.0 (test build)`
   - `DOWNLOAD_SIZE` (optional): for example `450 MB`
4. Re-run the workflow (Actions → Website → Run workflow). No code change is needed.

Until `DOWNLOAD_URL` is set, the final button reads "Download coming soon".

## One-time Vercel setup

1. Create a free account at vercel.com, then **Add New → Project**. Pick this repository, set **Root Directory**
   to `website`, and deploy once.
2. Create a token: Vercel → **Account Settings → Tokens → Create**. Copy it.
3. Find the IDs: on your PC, in the `website` folder, run `npx vercel link` and follow the prompts. It writes
   `.vercel/project.json`, which contains `orgId` and `projectId`. That folder is git-ignored.
4. In GitHub, go to **Settings → Secrets and variables → Actions → Secrets** and add:
   - `VERCEL_TOKEN`: the token from step 2
   - `VERCEL_ORG_ID`: `orgId`
   - `VERCEL_PROJECT_ID`: `projectId`
5. In the Vercel project, go to **Settings → General → Root Directory** and clear it (leave it empty). The
   workflow already runs from inside `website/`, and a Root Directory setting would make Vercel look for
   `website/website`.

## What the pipeline does

| Event | Result |
| --- | --- |
| Pull request that changes `website/` | Checks links, builds, and makes a **Preview** deployment (the link appears in the run summary) |
| Push to `main` that changes `website/` | Checks, builds, and deploys to **Production** |
| Actions → Website → **Run workflow** | Deploys to Production on demand |

The check fails the build if a menu link points to a missing section, a file the page uses is missing, or
`DOWNLOAD_URL` isn't `https://`.

## Work on it locally

```bash
npm run check     # validate links and settings
npm run build     # build to dist/
npm run preview   # build and serve dist/ at http://localhost:5050
```

Or just open `dist/index.html` in a browser after `npm run build`.

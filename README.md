# Manuscript Editor & Formatter: product website

A one-page product and download site. Plain HTML, CSS and JavaScript with **no dependencies**, so it builds in
under a second. Every push to `master` goes live on **Vercel** through GitHub Actions
(`.github/workflows/deploy.yml`).

```
src/index.html, styles.css, main.js, favicon.svg   the page (sections: hero, features, how it works,
                                                   audio, formatting, privacy, details, FAQ, download)
site.config.json    default download link, version and size
scripts/build.mjs   checks the page, copies src/ to dist/ and writes dist/config.js
vercel.json         build settings, security headers; Vercel's own Git deploys are off (the workflow deploys)
.github/workflows/deploy.yml   the CI/CD pipeline
```

## One-time Vercel setup (after this, every push to master goes live automatically)

1. Create a free account at vercel.com. Then **Add New → Project → Import** this GitHub repository
   (`manuscript-editor-web`). Leave **Root Directory** empty and click **Deploy**.
2. Create a token: Vercel → your avatar → **Account Settings → Tokens → Create**. Copy it.
3. Find the two IDs:
   - **Project ID**: Vercel → your project → **Settings → General** → "Project ID".
   - **Org ID**: Vercel → your avatar → **Account Settings → General** → "Vercel ID" (for a team: Team Settings → "Team ID").
4. In GitHub, open the repository, then **Settings → Secrets and variables → Actions → Secrets → New repository
   secret**, and add:
   - `VERCEL_TOKEN`: the token from step 2
   - `VERCEL_ORG_ID`: the Org ID
   - `VERCEL_PROJECT_ID`: the Project ID
5. Push anything to `master` (or go to Actions → Deploy → **Run workflow**). The run turns green and the live
   link appears on the run page.

Vercel's own Git deploys are switched off in `vercel.json`, so each push deploys exactly once, through the
workflow, and only after the checks pass.

## What the pipeline does

| Event | Result |
| --- | --- |
| Push to `master` | Checks links, builds, and deploys **live (Production)** |
| Pull request into `master` | Checks, builds, and makes a **Preview** deployment (the link appears in the run summary) |
| Actions → Deploy → **Run workflow** | Deploys live on demand |

The check stops the deploy if a menu link points to a missing section, a file the page uses is missing, or
`DOWNLOAD_URL` isn't `https://`. If a secret is missing, the run names it.

## Change the download link

The installer (`ManuscriptEditor-Setup.exe`) is too large to host on Vercel, so host it somewhere else. A
**GitHub Release** is free and simple:

1. On GitHub, open the repository, then **Releases → Draft a new release**, and attach `ManuscriptEditor-Setup.exe`.
2. Copy the file's link (it looks like `https://github.com/<you>/<repo>/releases/download/v0.9.0/ManuscriptEditor-Setup.exe`).
3. In GitHub, go to **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   - `DOWNLOAD_URL`: the link (must start with `https://`)
   - `APP_VERSION` (optional): for example `0.9.0 (test build)`
   - `DOWNLOAD_SIZE` (optional): for example `450 MB`
4. Re-run the workflow (Actions → Deploy → Run workflow). No code change is needed.

Until `DOWNLOAD_URL` is set, the final button reads "Download coming soon".

## Work on it locally

```bash
npm run check     # validate links and settings
npm run build     # build to dist/
npm run preview   # build and serve dist/ at http://localhost:5050
```

Or just open `dist/index.html` in a browser after `npm run build`.

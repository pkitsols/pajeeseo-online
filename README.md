# Pajeeseo.online — GitHub + Vercel Ready SEO Audit App

This folder is ready for GitHub and Vercel deployment. It uses a static `index.html` frontend and a Vercel Serverless Function at `/api/seo`.

## Folder structure

```txt
pajeeseo-online-vercel/
├── index.html
├── package.json
├── vercel.json
├── .env.example
├── .gitignore
├── api/
│   └── seo.js
└── assets/
    ├── pajeeseo-logo.svg
    ├── pajeeseo-logo.png
    └── pajeeseo-favicon.svg
```

## Why this version is different

The earlier cPanel version used `api.php`. Vercel does not run PHP in the normal static/serverless setup, so this version replaces PHP with `api/seo.js`.

## Required environment variables

Add these in Vercel:

```txt
PAGESPEED_API_KEY
GOOGLE_CSE_API_KEY
GOOGLE_CSE_ID
```

`PAGESPEED_API_KEY` is optional but recommended. `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_ID` are required for live SERP results.

## GitHub upload steps

1. Create a new GitHub repository.
2. Upload all files from this folder to the repository root.
3. Do not upload `.env` with real keys.
4. Commit and push.

## Vercel deploy steps

1. Open Vercel dashboard.
2. Click **Add New Project**.
3. Import your GitHub repo.
4. Framework preset: **Other**.
5. Build command: leave empty or default.
6. Output directory: leave empty.
7. Add environment variables.
8. Deploy.

## Test URLs after deploy

```txt
https://your-domain.vercel.app/
https://your-domain.vercel.app/api/seo?action=health
```

If `health` shows `backend: true`, your API route is working.

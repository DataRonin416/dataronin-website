# PVR Report Viewer (Client-safe)

This is a simple, client-friendly webpage that renders either:
- Forensic engine JSON (report-style preview + tables), or
- Automation engine JSON (tabbed tables view).

## How to use (no coding)

1) Open the webpage.
2) Upload a `.json` file or paste JSON into the box.
3) Click **Render report**.
4) Use **Report view** or **Detailed tables**.

## Deploy to GitHub Pages (click-by-click)

1) In GitHub, click **New repository**
2) Name it: `pvr-report-viewer` (or anything you like)
3) Choose **Public**
4) Click **Create repository**
5) On the repo page, click **Add file** → **Upload files**
6) Upload these files/folders:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `assets/` folder (with `logo.avif`)
7) Click **Commit changes**
8) Go to **Settings** → **Pages**
9) Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/ (root)**
10) Click **Save**
11) Wait ~30–60 seconds, then refresh the Pages page to see your site link.

## Notes

- This site runs entirely in the browser (no server).
- It does not upload your data anywhere.
- If your JSON is very large, prefer file upload instead of pasting.

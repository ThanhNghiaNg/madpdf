# MadPDF v3

Fully Vercel-deployable version of MadPDF, built as a hybrid client/server PDF optimizer.

This folder is independent from:

- `../madpdf` — running Ghostscript version
- `../madpdf_v2` — serverless API-only prototype

## Goal

Run completely on Vercel while accepting files from `0MB` up to `150MB`.

## Architecture

### Primary path: browser-side compression

Large PDFs are optimized in the browser with `pdf-lib` loaded from CDN:

- no Vercel request body limit issue
- no serverless timeout during upload
- file stays on the user's machine
- supports up to 150MB depending on browser RAM/device

### Fallback path: Vercel Serverless API

Small PDFs can fall back to `/api/compress` if the browser engine fails.

- `api/index.js`
- max parser setting: 150MB
- real Vercel platform/body limits may still reject large requests

## Compression type

V3 performs serverless-safe structural PDF optimization:

- rewrites PDF object streams
- strips metadata
- saves with compressed object streams
- returns original if rewrite is larger

## Limitation

This is not Ghostscript-level DPI/image downsampling. Vercel cannot reliably run full Ghostscript/container workloads. DPI remains in the UI/API for compatibility.

## Install

```bash
npm install
npm run check
```

## Dev

```bash
npm run dev
```

## Deploy

```bash
vercel
vercel --prod
```

## Files

```text
api/index.js       Vercel serverless fallback
lib/pdf.js         Node fallback optimizer
lib/i18n.js        server translations
public/app.js      client-side optimizer + UI logic
public/*           UI assets/locales/styles
vercel.json        Vercel routing/function config
```

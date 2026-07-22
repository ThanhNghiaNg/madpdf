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

## Public binary API

### `POST /api/compress-file`

Receives a PDF and DPI, returns the compressed PDF bytes directly.

Request: `multipart/form-data`

- `pdf`: input PDF file
- `dpi`: target DPI, clamped to `10..300`

Example:

```bash
curl -X POST https://YOUR_DOMAIN/api/compress-file \
  -F "pdf=@input.pdf" \
  -F "dpi=50" \
  --output output.pdf
```

Response:

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="...-compressed-50dpi.pdf"`
- `X-MadPDF-DPI`
- `X-MadPDF-Original-Bytes`
- `X-MadPDF-Compressed-Bytes`

Note: this endpoint runs inside Vercel Serverless. Large files may hit Vercel body/time/memory limits. Browser-side compression remains the safest path for near-150MB PDFs.

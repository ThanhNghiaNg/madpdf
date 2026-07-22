const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { IncomingForm } = require('formidable');
const ffmpegPath = require('ffmpeg-static');
const { optimizePdf, sanitizeDownloadName, normalizeUploadedFileName } = require('../lib/pdf');
const { SUPPORTED_LOCALES, serverText, resolveLocale } = require('../lib/i18n');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_FILE_SIZE = 150 * 1024 * 1024;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}
function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function buildContentDisposition(fileName) {
  const safeName = sanitizeDownloadName(fileName);
  const fallbackName = safeName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_') || 'download.pdf';
  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}
function readBodyFile(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ maxFileSize: MAX_FILE_SIZE, multiples: false, keepExtensions: true, uploadDir: require('os').tmpdir() });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      const pdf = Array.isArray(files.pdf) ? files.pdf[0] : files.pdf;
      resolve({ fields, file: pdf });
    });
  });
}
async function sendStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
  res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
  res.end(await fsp.readFile(filePath));
}
function renderPage({ locale = 'en', error = '' }) {
  const lang = resolveLocale(locale);
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${escapeHtml(serverText(lang, 'metaTitle'))}</title><meta name="description" content="${escapeHtml(serverText(lang, 'metaDescription'))}"/><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="icon" type="image/png" href="/favicon.png"/><link rel="stylesheet" href="/styles.css"/></head><body data-gs-ready="true"><div class="bg-orb orb-a"></div><div class="bg-orb orb-b"></div><div class="bg-grid"></div><main class="page"><section class="hero-shell"><div class="hero-topbar"><p class="eyebrow">MadPDF v3</p><label class="lang-switcher" for="lang-select"><span class="sr-only">${escapeHtml(serverText(lang, 'languageLabel'))}</span><select id="lang-select" aria-label="${escapeHtml(serverText(lang, 'languageLabel'))}">${SUPPORTED_LOCALES.map(l => `<option value="${l}" ${lang === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div><div class="hero-copy"><h1 data-i18n="heroTitle">MadPDF v3</h1><p class="subtitle" data-i18n="heroSubtitle">Fully Vercel deployable hybrid compressor. Files up to 150MB run client-side first; API fallback also supports 150MB when platform limits allow.</p></div></section>${error ? `<section class="card notice error"><h2>${escapeHtml(serverText(lang, 'errorTitle'))}</h2><p>${escapeHtml(error)}</p></section>` : ''}<section class="card app-shell"><div class="panel-head"><div><p class="section-kicker" data-i18n="consoleKicker">${escapeHtml(serverText(lang, 'consoleKicker'))}</p><h2 data-i18n="consoleTitle">${escapeHtml(serverText(lang, 'consoleTitle'))}</h2></div><div class="pill-row"><span class="pill" data-i18n="maxFile">${escapeHtml(serverText(lang, 'maxFile'))}</span><span class="pill" data-i18n="pdfOnly">${escapeHtml(serverText(lang, 'pdfOnly'))}</span></div></div><form class="form" id="compress-form" novalidate><label class="dropzone" id="dropzone"><input type="file" name="pdf" accept="application/pdf,.pdf" required id="pdf-input"/><div class="dropzone-icon">PDF</div><div><strong data-i18n="dropTitle">${escapeHtml(serverText(lang, 'dropTitle'))}</strong><span data-i18n="dropSubtitle">${escapeHtml(serverText(lang, 'dropSubtitle'))}</span></div><p id="selected-file" data-i18n="noFile">${escapeHtml(serverText(lang, 'noFile'))}</p></label><div class="control-grid single"><label class="field field-full"><div class="field-head"><span data-i18n="dpiLabel">${escapeHtml(serverText(lang, 'dpiLabel'))}</span><small data-i18n="dpiHint">${escapeHtml(serverText(lang, 'dpiHint'))}</small></div><input type="number" name="dpi" min="0" max="300" step="1" value="50" required id="dpi-input"/></label></div><div class="actions"><button type="submit" class="button" id="submit-button"><span data-i18n="compressButton">${escapeHtml(serverText(lang, 'compressButton'))}</span></button><p class="helper" data-i18n="helper">${escapeHtml(serverText(lang, 'helper'))}</p></div><section class="progress-card hidden" id="progress-card" aria-live="polite"><div class="progress-top"><strong id="progress-label">...</strong><span id="progress-percent">0%</span></div><div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div><p id="progress-note">...</p></section><section class="notice error hidden" id="error-card"><h2 data-i18n="errorTitle">${escapeHtml(serverText(lang, 'errorTitle'))}</h2><p id="error-message"></p></section><section class="result hidden" id="result-card"><div class="result-inline"><div class="result-copy"><strong id="result-file-name">-</strong><p id="result-summary">${escapeHtml(serverText(lang, 'resultSummary')).replace('{size}', '<span>-</span>').replace('{percent}', '<span>-</span>')}</p></div><a class="button secondary download-button" id="download-link" href="#"><span class="button-icon" aria-hidden="true">↓</span><span data-i18n="download">${escapeHtml(serverText(lang, 'download'))}</span></a></div></section></form></section><footer class="site-footer"><p>© <span id="current-year"></span> ThanhNghia</p></footer></main><script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js?v=madpdf-v3-3"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js?v=madpdf-v3-3"></script><script>window.__MADPDF__=${JSON.stringify({ gsReady: true, supportedLocales: SUPPORTED_LOCALES, locale: lang, version: 'v3-vercel-hybrid' })};</script><script src="/app.js?v=madpdf-v3-3"></script></body></html>`;
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  try {
    if (req.method === 'GET' && pathname === '/api/status') return sendJson(res, 200, { ok: true, gsReady: true, ffmpegReady: !!ffmpegPath && fs.existsSync(ffmpegPath), ffmpegPath: !!ffmpegPath, locale: resolveLocale(url.searchParams.get('locale') || url.searchParams.get('lang')) });
    if (req.method === 'POST' && (pathname === '/api/compress' || pathname === '/compress')) {
      const locale = resolveLocale(url.searchParams.get('lang'));
      const { fields, file } = await readBodyFile(req);
      const fieldLocale = Array.isArray(fields.locale) ? fields.locale[0] : fields.locale;
      const lang = resolveLocale(fieldLocale || locale);
      if (!file) return sendJson(res, 400, { ok: false, error: serverText(lang, 'fileRequired'), code: 'FILE_REQUIRED' });
      const originalName = normalizeUploadedFileName(file.originalFilename || 'download.pdf');
      if (file.mimetype !== 'application/pdf' && !originalName.toLowerCase().endsWith('.pdf')) return sendJson(res, 400, { ok: false, error: serverText(lang, 'pdfOnlyError'), code: 'PDF_ONLY' });
      const inputBuffer = await fsp.readFile(file.filepath);
      await fsp.unlink(file.filepath).catch(() => {});
      const dpi = Array.isArray(fields.dpi) ? fields.dpi[0] : fields.dpi;
      const result = await optimizePdf(inputBuffer, { dpi, originalName });
      const dataUrl = `data:application/pdf;base64,${result.buffer.toString('base64')}`;
      delete result.buffer;
      result.downloadUrl = dataUrl;
      return sendJson(res, 200, { ok: true, result, locale: lang });
    }
    if (req.method === 'GET' && pathname.startsWith('/download/')) return sendJson(res, 410, { ok: false, error: serverText(url.searchParams.get('lang'), 'expiredFile') });
    if (req.method === 'GET' && pathname !== '/') {
      const safe = path.normalize(pathname).replace(/^\/+/, '');
      const publicPath = path.join(PUBLIC_DIR, safe);
      if (publicPath.startsWith(PUBLIC_DIR) && fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) return sendStatic(res, publicPath);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(renderPage({ locale: url.searchParams.get('lang') || url.searchParams.get('locale') }));
  } catch (error) {
    const locale = resolveLocale(new URL(req.url, 'http://localhost').searchParams.get('lang'));
    if ((req.url || '').startsWith('/api/')) return sendJson(res, 500, { ok: false, error: serverText(locale, 'compressFailed'), code: 'COMPRESS_FAILED', detail: process.env.NODE_ENV === 'development' ? String(error.message || error) : undefined });
    res.statusCode = 500; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(renderPage({ locale, error: serverText(locale, 'compressFailed') }));
  }
};

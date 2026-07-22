const config = window.__MADPDF__ || { gsReady: false, supportedLocales: ['en'], locale: 'en', version: 'dev' };

const currentComithash = config.version || 'dev';
console.debug('version ', currentComithash);

const localeLabels = {
  vi: 'Tiếng Việt',
  en: 'English',
  'zh-TW': '繁體中文（台灣）',
  'zh-CN': '简体中文（中国大陆）',
  ko: '한국어',
  ja: '日本語',
};


const MAX_CLIENT_FILE_SIZE = 150 * 1024 * 1024;
const SERVER_FALLBACK_LIMIT = 4 * 1024 * 1024;

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = Number(bytes) || 0;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function sanitizePdfName(name) {
  const clean = String(name || 'download.pdf').normalize('NFC').replace(/[\r\n"]/g, '_');
  return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
}

function jpegQualityForDpi(dpi) {
  if (dpi <= 30) return 0.42;
  if (dpi <= 50) return 0.50;
  if (dpi <= 72) return 0.58;
  if (dpi <= 100) return 0.66;
  if (dpi <= 150) return 0.74;
  if (dpi <= 220) return 0.82;
  return 0.88;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('CANVAS_EXPORT_FAILED')), type, quality);
  });
}

async function optimizePdfInBrowser(file, dpi) {
  if (!window.PDFLib?.PDFDocument || !window.pdfjsLib) throw new Error('CLIENT_ENGINE_MISSING');
  const targetDpi = Math.max(10, Math.min(300, Number(dpi) || 10));
  const quality = jpegQualityForDpi(targetDpi);
  setProgress(5, t('compressing'), 'Reading PDF in browser...');
  const inputBytes = new Uint8Array(await file.arrayBuffer());

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const loadingTask = window.pdfjsLib.getDocument({ data: inputBytes.slice(), useWorkerFetch: true, isEvalSupported: false, disableFontFace: false, useSystemFonts: true, stopAtErrors: false });
  const srcPdf = await loadingTask.promise;
  const outPdf = await window.PDFLib.PDFDocument.create();
  outPdf.setProducer('MadPDF v3 raster DPI compressor');
  outPdf.setCreator('MadPDF v3');

  for (let pageNum = 1; pageNum <= srcPdf.numPages; pageNum += 1) {
    const page = await srcPdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = targetDpi / 72;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setProgress(8 + ((pageNum - 1) / srcPdf.numPages) * 82, t('compressing'), `Rasterizing page ${pageNum}/${srcPdf.numPages} at ${targetDpi} DPI...`);
    const renderTask = page.render({ canvasContext: context, viewport, intent: 'print', background: 'white' });
    await renderTask.promise;
    const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (!jpegBlob || jpegBlob.size < 100) throw new Error(`Failed to encode page ${pageNum}`);
    const jpegBytes = await jpegBlob.arrayBuffer();
    const jpg = await outPdf.embedJpg(jpegBytes);
    const outPage = outPdf.addPage([baseViewport.width, baseViewport.height]);
    outPage.drawImage(jpg, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height });
    canvas.width = 1; canvas.height = 1;
    page.cleanup?.();
  }

  setProgress(92, t('compressing'), 'Saving compressed PDF...');
  const outputBytes = await outPdf.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 20 });
  if (!outputBytes || outputBytes.length < 1024) throw new Error('Compression produced an invalid empty PDF. Try higher DPI.');
  const outputBuffer = outputBytes.buffer.slice(outputBytes.byteOffset, outputBytes.byteOffset + outputBytes.byteLength);
  const inputBuffer = inputBytes.buffer.slice(inputBytes.byteOffset, inputBytes.byteOffset + inputBytes.byteLength);
  const outputBlob = new Blob([outputBuffer], { type: 'application/pdf' });
  const inputBlob = new Blob([inputBuffer], { type: 'application/pdf' });
  const blob = outputBlob.size > 1024 && outputBlob.size < inputBlob.size ? outputBlob : inputBlob;
  const savedBytes = Math.max(0, inputBlob.size - blob.size);
  const savedPercent = inputBlob.size ? Number(((savedBytes / inputBlob.size) * 100).toFixed(1)) : 0;
  const originalName = sanitizePdfName(file.name);
  const objectUrl = URL.createObjectURL(blob);
  return {
    fileName: originalName.replace(/\.pdf$/i, '') + `-madpdf-v3-${targetDpi}dpi.pdf`,
    originalName,
    dpi: targetDpi,
    originalBytes: inputBlob.size,
    compressedBytes: blob.size,
    savedBytes,
    savedPercent,
    originalSize: formatBytes(inputBlob.size),
    compressedSize: formatBytes(blob.size),
    savedSize: formatBytes(savedBytes),
    downloadUrl: objectUrl,
    _objectUrl: objectUrl
  };
}

function isObjectUrl(url) {
  return String(url || '').startsWith('blob:') || String(url || '').startsWith('data:');
}

const defaultTranslations = {
  en: {
    metaTitle: 'MadPDF — Compress PDF by DPI',
    metaDescription: 'Compress PDF directly on the web with a custom DPI value and instant download.',
    languageLabel: 'Language',
    brand: 'MadPDF',
    heroTitle: 'Compress PDF fully on Vercel',
    heroSubtitle: 'Compress by rasterizing each page at target DPI in your browser. Files up to 150MB stay Vercel-deployable.',
    gsTitle: 'Ghostscript is missing',
    gsBody: 'The PDF compression engine uses Ghostscript. Install it on the server first to start processing.',
    errorTitle: 'Error',
    consoleKicker: 'Compression Console',
    consoleTitle: 'Upload & optimize',
    maxFile: 'Max file: 150MB',
    pdfOnly: 'PDF only',
    dropTitle: 'Drop your PDF here',
    dropSubtitle: 'or click to choose a file',
    noFile: 'No file selected',
    dpiLabel: 'DPI (0 - 300)',
    dpiHint: 'Lower DPI rasterizes pages smaller. Very low DPI = smaller file, lower quality.',
    compressButton: 'Compress PDF',
    helper: 'After processing, your download link will appear here.',
    uploading: 'Processing...',
    uploadPrepare: 'Preparing client-side compression...',
    uploadSending: 'Uploading file to the server...',
    uploadSent: 'Sent {percent}% of the file to the server',
    completed: 'Completed',
    completedNote: 'Your PDF is ready. You can download it now.',
    failed: 'Processing failed',
    failedNote: 'The server returned an error during processing.',
    connectionFailed: 'Connection failed',
    connectionNote: 'Unable to reach the server.',
    connectionRetry: 'Unable to reach the server. Please try again.',
    uploadStart: 'Starting upload...',
    compressing: 'Optimizing PDF...',
    compressingNote: 'Upload is done. The server is optimizing your PDF now...',
    download: 'Download',
    resultSummary: 'Compressed file {size} • Saved {percent}',
    gsMissing: 'Ghostscript (gs) is not installed on the server yet, so PDF compression is unavailable.',
    chooseFile: 'Please choose a PDF file.',
    invalidFile: 'Only PDF files are supported.'
  }
};

const form = document.getElementById('compress-form');
const dropzone = document.getElementById('dropzone');
const input = document.getElementById('pdf-input');
const dpiInput = document.getElementById('dpi-input');
const selectedFile = document.getElementById('selected-file');
const submitButton = document.getElementById('submit-button');
const langSelect = document.getElementById('lang-select');
const resultSummary = document.getElementById('result-summary');
const metaDescription = document.querySelector('meta[name="description"]');

const progressCard = document.getElementById('progress-card');
const progressLabel = document.getElementById('progress-label');
const progressPercent = document.getElementById('progress-percent');
const progressFill = document.getElementById('progress-fill');
const progressNote = document.getElementById('progress-note');

const errorCard = document.getElementById('error-card');
const errorMessage = document.getElementById('error-message');

const resultCard = document.getElementById('result-card');
const downloadLink = document.getElementById('download-link');
const resultFileName = document.getElementById('result-file-name');
const currentYear = document.getElementById('current-year');

if (currentYear) {
  currentYear.textContent = String(new Date().getFullYear());
}

let translations = { ...defaultTranslations };
let currentLocale = config.locale || 'en';
let lastSelectedFile = null;
let lastResult = null;

function normalizeLocale(locale) {
  const input = String(locale || '').trim().toLowerCase();
  if (input === 'zh-tw' || input === 'zh_tw' || input === 'zhtw') return 'zh-TW';
  if (input === 'zh-cn' || input === 'zh_cn' || input === 'zhcn') return 'zh-CN';
  if (input.startsWith('zh-hant')) return 'zh-TW';
  if (input.startsWith('zh-hans')) return 'zh-CN';
  if (input.startsWith('zh-tw')) return 'zh-TW';
  if (input.startsWith('zh-cn')) return 'zh-CN';
  if (input.startsWith('zh')) return 'zh-CN';
  if (input.startsWith('ko')) return 'ko';
  if (input.startsWith('ja')) return 'ja';
  if (input.startsWith('vi')) return 'vi';
  if (input.startsWith('en')) return 'en';
  return 'en';
}

function isSupportedLocale(locale) {
  return (config.supportedLocales || []).includes(locale);
}

function getLangFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get('lang');
  const normalized = normalizeLocale(lang);
  return isSupportedLocale(normalized) ? normalized : null;
}

function detectInitialLocale() {
  const fromUrl = getLangFromUrl();
  if (fromUrl) return fromUrl;

  const saved = normalizeLocale(localStorage.getItem('madpdf.locale'));
  if (saved && isSupportedLocale(saved)) return saved;

  return normalizeLocale(navigator.language || 'en');
}

function t(key, vars = {}) {
  const dict = translations[currentLocale] || translations.en || defaultTranslations.en;
  let template = dict[key] || translations.en?.[key] || defaultTranslations.en[key] || key;
  for (const [name, value] of Object.entries(vars)) {
    template = template.replaceAll(`{${name}}`, value);
  }
  return template;
}

async function loadLocale(locale) {
  const normalized = normalizeLocale(locale);
  const target = isSupportedLocale(normalized) ? normalized : 'en';
  if (translations[target]) return translations[target];

  const response = await fetch(`/locales/${target}.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Failed to load locale: ${target}`);
  const data = await response.json();
  translations[target] = data;
  return data;
}

function updateUrlLang(locale, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.set('lang', locale);
  if (replace) {
    window.history.replaceState({}, '', url);
  } else {
    window.history.pushState({}, '', url);
  }
}

function updateSelectedFile(file) {
  lastSelectedFile = file || null;
  if (!selectedFile) return;
  if (!file) {
    selectedFile.textContent = t('noFile');
    return;
  }
  selectedFile.textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
}

function hide(el) {
  el?.classList.add('hidden');
}

function show(el) {
  el?.classList.remove('hidden');
}

function resetFeedback() {
  hide(errorCard);
  hide(resultCard);
}

function setError(message) {
  if (!errorMessage) return;
  errorMessage.textContent = message;
  show(errorCard);
}

function setProgress(value, label, note) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  if (progressPercent) progressPercent.textContent = `${Math.round(safeValue)}%`;
  if (progressFill) progressFill.style.width = `${safeValue}%`;
  if (progressLabel && label) progressLabel.textContent = label;
  if (progressNote && note) progressNote.textContent = note;
}

function updateResultSummary() {
  if (!resultSummary || !lastResult) return;
  resultSummary.innerHTML = t('resultSummary', {
    size: `<span>${lastResult.compressedSize}</span>`,
    percent: `<span>${lastResult.savedPercent}%</span>`,
  });
}

function renderResult(result) {
  if (!result) return;
  const normalizedOriginalName = String(result.originalName || 'download.pdf').normalize('NFC');
  lastResult = { ...result, originalName: normalizedOriginalName };
  resultFileName.textContent = normalizedOriginalName;
  downloadLink.href = result._objectUrl || result.downloadUrl;
  downloadLink.download = result.fileName || normalizedOriginalName;
  updateResultSummary();
  show(resultCard);
}

function validateDpi() {
  const raw = Number.parseInt(dpiInput?.value || '150', 10);
  if (Number.isNaN(raw)) return 150;
  return Math.max(0, Math.min(300, raw));
}

function withLang(url) {
  const absolute = new URL(url, window.location.origin);
  absolute.searchParams.set('locale', currentLocale);
  absolute.searchParams.set('lang', currentLocale);
  return `${absolute.pathname}${absolute.search}`;
}

async function forceDownloadCurrentResult(event) {
  if (!lastResult || !downloadLink) return;
  event.preventDefault();

  const fileName = String(lastResult.originalName || 'download.pdf').normalize('NFC');
  if (isObjectUrl(downloadLink.href)) { window.location.href = downloadLink.href; return; }
  const response = await fetch(downloadLink.href, { credentials: 'same-origin' });

  if (!response.ok) {
    window.location.href = downloadLink.href;
    return;
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const tempLink = document.createElement('a');
  tempLink.href = objectUrl;
  tempLink.download = fileName;
  document.body.appendChild(tempLink);
  tempLink.click();
  tempLink.remove();

  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function applyTranslations() {
  document.documentElement.lang = currentLocale;
  document.title = t('metaTitle');
  if (metaDescription) metaDescription.setAttribute('content', t('metaDescription'));

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    node.textContent = t(key);
  });

  if (langSelect) {
    langSelect.value = currentLocale;
    langSelect.setAttribute('aria-label', t('languageLabel'));
  }

  updateSelectedFile(lastSelectedFile);
  updateResultSummary();
}

async function setLocale(locale, options = {}) {
  const nextLocale = normalizeLocale(locale);
  const target = isSupportedLocale(nextLocale) ? nextLocale : 'en';
  await loadLocale(target);
  currentLocale = target;
  localStorage.setItem('madpdf.locale', currentLocale);
  if (options.updateUrl !== false) {
    updateUrlLang(currentLocale, Boolean(options.replaceUrl));
  }
  applyTranslations();
}

if (langSelect) {
  langSelect.addEventListener('change', async () => {
    await setLocale(langSelect.value);
  });
}

if (downloadLink) {
  downloadLink.addEventListener('click', (event) => {
    void forceDownloadCurrentResult(event);
  });
}

if (input) {
  input.addEventListener('change', () => {
    updateSelectedFile(input.files?.[0]);
    resetFeedback();
  });
}

if (dpiInput) {
  dpiInput.addEventListener('change', () => {
    dpiInput.value = String(validateDpi());
  });
}

if (dropzone && input) {
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'dragend', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError(t('invalidFile'));
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    updateSelectedFile(file);
    resetFeedback();
  });
}

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    resetFeedback();

    if (!config.gsReady) {
      setError(t('gsMissing'));
      return;
    }

    const file = input?.files?.[0];
    if (!file) {
      setError(t('chooseFile'));
      return;
    }

    const dpi = validateDpi();
    if (dpiInput) dpiInput.value = String(dpi);

    if (file.size <= 0 || file.size > MAX_CLIENT_FILE_SIZE) {
      setError(`File must be > 0MB and <= 150MB. Current: ${formatBytes(file.size)}`);
      return;
    }

    show(progressCard);
    setProgress(0, t('uploading'), t('uploadPrepare'));

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add('is-loading');
    }

    (async () => {
      try {
        const result = await optimizePdfInBrowser(file, dpi);
        setProgress(100, t('completed'), t('completedNote'));
        renderResult(result);
      } catch (clientError) {
        if (file.size > SERVER_FALLBACK_LIMIT) {
          throw clientError;
        }
        setProgress(12, t('uploading'), 'Client engine failed. Trying Vercel API fallback...');
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('dpi', String(dpi));
        formData.append('locale', currentLocale);
        const response = await fetch('/api/compress', { method: 'POST', body: formData });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok) throw new Error(data?.error || t('failedNote'));
        setProgress(100, t('completed'), t('completedNote'));
        renderResult(data.result);
      }
    })().catch((error) => {
      hide(resultCard);
      setProgress(100, t('failed'), t('failedNote'));
      setError(error.message === 'CLIENT_ENGINE_MISSING' ? 'Client PDF engine failed to load. Refresh and try again.' : (error.message || t('connectionRetry')));
    }).finally(() => {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove('is-loading');
      }
    });
  });
}

window.addEventListener('popstate', async () => {
  const locale = getLangFromUrl() || detectInitialLocale();
  await setLocale(locale, { updateUrl: false });
});

(async () => {
  currentLocale = detectInitialLocale();
  await setLocale(currentLocale, { replaceUrl: true });
})();

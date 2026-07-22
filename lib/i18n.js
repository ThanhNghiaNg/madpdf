const SUPPORTED_LOCALES = ['vi', 'en', 'zh-TW', 'zh-CN', 'ko', 'ja'];

const SERVER_MESSAGES = {
  vi: {
    metaTitle: 'MadPDF v2 — Nén PDF serverless',
    metaDescription: 'Nén/tối ưu PDF trên Vercel Serverless, không cần Ghostscript hệ thống.',
    languageLabel: 'Ngôn ngữ', errorTitle: 'Lỗi', consoleKicker: 'Serverless PDF Console',
    consoleTitle: 'Tải lên & tối ưu', maxFile: 'File tối đa: 150MB', pdfOnly: 'Chỉ PDF',
    dropTitle: 'Thả file PDF vào đây', dropSubtitle: 'hoặc bấm để chọn file', noFile: 'Chưa chọn file nào',
    dpiLabel: 'DPI mục tiêu (0 - 300)', dpiHint: 'V3 chạy hoàn toàn trên Vercel: ưu tiên nén trong trình duyệt cho file lớn, API fallback khi được phép.',
    compressButton: 'Nén PDF', helper: 'Sau khi xử lý xong, file sẽ tải về qua data URL.', download: 'Tải về',
    resultSummary: 'File sau nén {size} • Tiết kiệm {percent}', fileRequired: 'Bạn chưa chọn file PDF.',
    compressFailed: 'Không thể tối ưu PDF.', uploadFailed: 'Upload thất bại. File tối đa 150MB, nhưng Vercel có thể chặn body lớn. Hãy thử chế độ client-side.', pdfOnlyError: 'Chỉ hỗ trợ file PDF.',
    expiredFile: 'File không tồn tại hoặc đã hết hạn.', unknownError: 'Đã có lỗi xảy ra.', gsMissing: 'V2 không cần Ghostscript; đang dùng serverless optimizer.'
  },
  en: {
    metaTitle: 'MadPDF v2 — Serverless PDF compressor',
    metaDescription: 'Optimize PDFs on Vercel Serverless without system Ghostscript.',
    languageLabel: 'Language', errorTitle: 'Error', consoleKicker: 'Serverless PDF Console',
    consoleTitle: 'Upload & optimize', maxFile: 'Max file: 150MB', pdfOnly: 'PDF only',
    dropTitle: 'Drop your PDF here', dropSubtitle: 'or click to choose a file', noFile: 'No file selected',
    dpiLabel: 'Target DPI (0 - 300)', dpiHint: 'V3 runs fully on Vercel: client-side first for large files, API fallback when allowed.',
    compressButton: 'Compress PDF', helper: 'After processing, the file downloads via a data URL.', download: 'Download',
    resultSummary: 'Compressed file {size} • Saved {percent}', fileRequired: 'Please choose a PDF file.',
    compressFailed: 'Unable to optimize the PDF.', uploadFailed: 'Upload failed. Max file is 150MB, but Vercel may reject large request bodies. Try client-side mode.', pdfOnlyError: 'Only PDF files are supported.',
    expiredFile: 'The file does not exist or has expired.', unknownError: 'Something went wrong.', gsMissing: 'V2 does not need Ghostscript; using serverless optimizer.'
  }
};
for (const lang of ['zh-TW', 'zh-CN', 'ko', 'ja']) SERVER_MESSAGES[lang] = SERVER_MESSAGES.en;

function normalizeLocale(value) {
  const input = String(value || '').trim().toLowerCase();
  if (input === 'zh-tw' || input === 'zh_tw' || input === 'zhtw' || input.startsWith('zh-hant')) return 'zh-TW';
  if (input === 'zh-cn' || input === 'zh_cn' || input === 'zhcn' || input.startsWith('zh-hans') || input.startsWith('zh')) return 'zh-CN';
  if (input.startsWith('ko')) return 'ko';
  if (input.startsWith('ja')) return 'ja';
  if (input.startsWith('vi')) return 'vi';
  return 'en';
}
function resolveLocale(value) { const v = normalizeLocale(value); return SUPPORTED_LOCALES.includes(v) ? v : 'en'; }
function serverText(locale, key) { const lang = resolveLocale(locale); return SERVER_MESSAGES[lang]?.[key] || SERVER_MESSAGES.en[key] || key; }
module.exports = { SUPPORTED_LOCALES, serverText, resolveLocale };

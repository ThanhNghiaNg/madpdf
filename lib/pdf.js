const { PDFDocument } = require('pdf-lib');

function clampDpi(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 150;
  return Math.max(0, Math.min(300, parsed));
}
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes, index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}
function normalizeUploadedFileName(value) {
  const input = String(value || '').trim();
  if (!input) return 'download.pdf';
  try {
    const repaired = Buffer.from(input, 'latin1').toString('utf8').trim();
    if (repaired && !repaired.includes('�')) return repaired;
  } catch (_) {}
  return input;
}
function sanitizeDownloadName(value) {
  const baseName = require('path').basename(String(value || 'download.pdf')).trim() || 'download.pdf';
  return baseName.normalize('NFC').replace(/[\r\n"]/g, '_');
}
async function optimizePdf(inputBuffer, { dpi, originalName }) {
  const targetDpi = clampDpi(dpi);
  const pdfDoc = await PDFDocument.load(inputBuffer, { ignoreEncryption: false, updateMetadata: false });
  pdfDoc.setTitle(''); pdfDoc.setAuthor(''); pdfDoc.setSubject(''); pdfDoc.setKeywords([]); pdfDoc.setProducer('MadPDF v2'); pdfDoc.setCreator('MadPDF v2');
  const outputBytes = await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 });
  const compressed = Buffer.from(outputBytes);
  const finalBuffer = compressed.length < inputBuffer.length ? compressed : inputBuffer;
  const savedBytes = Math.max(0, inputBuffer.length - finalBuffer.length);
  const savedPercent = inputBuffer.length > 0 ? Number(((savedBytes / inputBuffer.length) * 100).toFixed(1)) : 0;
  const cleanName = sanitizeDownloadName(normalizeUploadedFileName(originalName || 'download.pdf'));
  return {
    buffer: finalBuffer,
    fileName: cleanName.replace(/\.pdf$/i, '') + '-madpdf-v2.pdf',
    originalName: cleanName,
    dpi: targetDpi,
    originalBytes: inputBuffer.length,
    compressedBytes: finalBuffer.length,
    savedBytes,
    savedPercent,
    originalSize: formatBytes(inputBuffer.length),
    compressedSize: formatBytes(finalBuffer.length),
    savedSize: formatBytes(savedBytes)
  };
}
module.exports = { optimizePdf, formatBytes, sanitizeDownloadName, normalizeUploadedFileName, clampDpi };

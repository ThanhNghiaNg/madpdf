const { PDFDocument } = require('pdf-lib');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('@napi-rs/canvas');

function clampDpi(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 72;
  return Math.max(10, Math.min(300, parsed));
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

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
    const context = canvas.getContext('2d');
    return { canvas, context };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = Math.max(1, Math.floor(width));
    canvasAndContext.canvas.height = Math.max(1, Math.floor(height));
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function rasterCompressPdf(inputBuffer, rawDpi) {
  const dpi = clampDpi(rawDpi);
  const quality = jpegQualityForDpi(dpi);
  const data = inputBuffer instanceof Uint8Array
    ? new Uint8Array(inputBuffer.buffer.slice(inputBuffer.byteOffset, inputBuffer.byteOffset + inputBuffer.byteLength))
    : new Uint8Array(inputBuffer);
  const srcPdf = await pdfjsLib.getDocument({
    data,
    disableFontFace: false,
    useSystemFonts: true,
    isEvalSupported: false,
    stopAtErrors: false,
  }).promise;

  const outPdf = await PDFDocument.create();
  outPdf.setProducer('MadPDF API raster DPI compressor');
  outPdf.setCreator('MadPDF API');

  const canvasFactory = new NodeCanvasFactory();

  for (let pageNum = 1; pageNum <= srcPdf.numPages; pageNum += 1) {
    const page = await srcPdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
    const { canvas, context } = canvasAndContext;

    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport,
      canvasFactory,
      intent: 'print',
      background: 'white',
    }).promise;

    const jpegBuffer = await canvas.encode('jpeg', Math.round(quality * 100));
    if (!jpegBuffer || jpegBuffer.length < 100) throw new Error(`Failed to encode page ${pageNum}`);
    const jpg = await outPdf.embedJpg(jpegBuffer);
    const outPage = outPdf.addPage([baseViewport.width, baseViewport.height]);
    outPage.drawImage(jpg, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height });

    page.cleanup?.();
    canvasFactory.destroy(canvasAndContext);
  }

  const outputBytes = await outPdf.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 20 });
  if (!outputBytes || outputBytes.length < 1024) throw new Error('Compression produced an invalid PDF');
  return { buffer: Buffer.from(outputBytes), dpi };
}

module.exports = { rasterCompressPdf, clampDpi };

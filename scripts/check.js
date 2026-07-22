const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
console.log(JSON.stringify({ ok: true, ffmpegPath, exists: !!ffmpegPath && fs.existsSync(ffmpegPath) }, null, 2));

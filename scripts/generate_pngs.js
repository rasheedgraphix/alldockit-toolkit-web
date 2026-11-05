import fs from 'fs';
import zlib from 'zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCRC32Table();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function encodePNG(width, height, getPixelRGBA) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image scanlines
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelRGBA(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function renderAllDocKitIcon(width, height) {
  const radius = width * 0.22;
  const cx = width / 2;
  const cy = height / 2;

  return encodePNG(width, height, (x, y) => {
    // Normalised coordinates [0, 1]
    const nx = x / width;
    const ny = y / height;

    // Check rounded rectangle (squircle boundary)
    const padding = width * 0.04;
    const w = width - padding * 2;
    const h = height - padding * 2;
    const rx = padding + radius;
    const ry = padding + radius;
    const rw = width - padding - radius;
    const rh = height - padding - radius;

    let insideBox = false;
    if (x >= rx && x <= rw && y >= padding && y <= height - padding) insideBox = true;
    else if (x >= padding && x <= width - padding && y >= ry && y <= rh) insideBox = true;
    else {
      // Corners
      const corners = [
        [rx, ry],
        [rw, ry],
        [rx, rh],
        [rw, rh]
      ];
      for (const [cxCorner, cyCorner] of corners) {
        const dx = x - cxCorner;
        const dy = y - cyCorner;
        if (dx * dx + dy * dy <= radius * radius) {
          insideBox = true;
          break;
        }
      }
    }

    if (!insideBox) {
      return [0, 0, 0, 0]; // Transparent outside
    }

    // Border highlight (glow rim)
    const isBorder = (
      x < padding + 3 || x > width - padding - 3 ||
      y < padding + 3 || y > height - padding - 3
    );

    // Deep modern navy background gradient
    const bgT = (nx + ny) * 0.5;
    let r = Math.round(15 * (1 - bgT) + 3 * bgT);
    let g = Math.round(23 * (1 - bgT) + 7 * bgT);
    let b = Math.round(42 * (1 - bgT) + 18 * bgT);

    // Draw folded Document icon in center
    // Doc bounds: center 50% of the canvas
    const docX1 = width * 0.30;
    const docY1 = height * 0.25;
    const docX2 = width * 0.70;
    const docY2 = height * 0.75;
    const foldSize = width * 0.12;

    // Inside main doc?
    if (x >= docX1 && x <= docX2 && y >= docY1 && y <= docY2) {
      // Check top right fold
      if (x >= docX2 - foldSize && y <= docY1 + foldSize && (x - (docX2 - foldSize)) + ((docY1 + foldSize) - y) > foldSize) {
        // Fold corner area (bright teal / emerald)
        r = 110; g = 231; b = 183;
      } else {
        // Main emerald gradient document body
        const docT = (y - docY1) / (docY2 - docY1);
        r = Math.round(16 * (1 - docT) + 4 * docT);
        g = Math.round(185 * (1 - docT) + 120 * docT);
        b = Math.round(129 * (1 - docT) + 87 * docT);

        // Document text lines inside
        const lineStart = docX1 + width * 0.06;
        const lineEnd = docX2 - width * 0.06;
        const l1Y = docY1 + height * 0.22;
        const l2Y = docY1 + height * 0.30;
        const l3Y = docY1 + height * 0.38;
        const lh = Math.max(2, width * 0.018);

        if ((Math.abs(y - l1Y) < lh && x >= lineStart && x <= lineEnd - width * 0.08) ||
            (Math.abs(y - l2Y) < lh && x >= lineStart && x <= lineEnd) ||
            (Math.abs(y - l3Y) < lh && x >= lineStart && x <= lineEnd - width * 0.12)) {
          r = 255; g = 255; b = 255; // Crisp white lines
        }

        // Mini crimson badge in corner
        if (x >= docX2 - width * 0.16 && x <= docX2 + width * 0.02 &&
            y >= docY2 - height * 0.14 && y <= docY2 + height * 0.02) {
          r = 244; g = 63; b = 94; // Crimson PDF accent
        }
      }
    }

    if (isBorder) {
      r = Math.round(r * 0.5 + 56 * 0.5);
      g = Math.round(g * 0.5 + 189 * 0.5);
      b = Math.round(b * 0.5 + 248 * 0.5);
    }

    return [r, g, b, 255];
  });
}

const sizes = [
  { name: 'logo_300x300.png', w: 300, h: 300 },
  { name: 'logo_150x150.png', w: 150, h: 150 },
  { name: 'logo_71x71.png', w: 71, h: 71 },
  { name: 'logo_1080x1080.png', w: 1080, h: 1080 },
];

for (const { name, w, h } of sizes) {
  const png = renderAllDocKitIcon(w, h);
  fs.writeFileSync(`./public/${name}`, png);
  console.log(`Generated ./public/${name} (${w}x${h})`);
}

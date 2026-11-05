import sharp from 'sharp';
import fs from 'fs';

async function exportLogos() {
  const svgBuffer = fs.readFileSync('public/alldockit_logo.svg');

  const targets = [
    { name: 'public/logo_300x300.png', size: 300 },
    { name: 'public/logo_150x150.png', size: 150 },
    { name: 'public/logo_71x71.png', size: 71 },
    { name: 'public/logo_1080x1080.png', size: 1080 },
    { name: 'public/logo_512x512.png', size: 512 }
  ];

  for (const t of targets) {
    await sharp(svgBuffer)
      .resize(t.size, t.size)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(t.name);
    console.log(`Successfully generated exact logo: ${t.name}`);
  }
}

exportLogos().catch(console.error);

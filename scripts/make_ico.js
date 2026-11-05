import pngToIco from 'png-to-ico';
import fs from 'fs';

async function makeIco() {
  if (!fs.existsSync('build')) {
    fs.mkdirSync('build');
  }

  const icoBuffer = await pngToIco(['public/logo_71x71.png', 'public/logo_150x150.png', 'public/logo_300x300.png', 'public/logo_512x512.png']);
  
  fs.writeFileSync('public/icon.ico', icoBuffer);
  fs.writeFileSync('build/icon.ico', icoBuffer);
  fs.writeFileSync('public/favicon.ico', icoBuffer);
  console.log('Successfully generated icon.ico in public/ and build/!');
}

makeIco().catch(console.error);

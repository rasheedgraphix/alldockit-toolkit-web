import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

async function zipAssets() {
  const zip = new JSZip();

  function addFolderToZip(folderPath, zipFolder) {
    if (!fs.existsSync(folderPath)) return;
    const items = fs.readdirSync(folderPath);
    for (const item of items) {
      const fullPath = path.join(folderPath, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const sub = zipFolder.folder(item);
        addFolderToZip(fullPath, sub);
      } else {
        zipFolder.file(item, fs.readFileSync(fullPath));
      }
    }
  }

  // Add build directory (icon.ico, icon.png, appx tiles/logos)
  const buildFolder = zip.folder('build');
  addFolderToZip('build', buildFolder);

  // Add electron.cjs and package.json
  if (fs.existsSync('electron.cjs')) {
    zip.file('electron.cjs', fs.readFileSync('electron.cjs'));
  }
  if (fs.existsSync('package.json')) {
    zip.file('package.json', fs.readFileSync('package.json'));
  }

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync('public/AllDocKit-Store-Assets.zip', content);
  console.log('Successfully created public/AllDocKit-Store-Assets.zip');
}

zipAssets().catch(console.error);

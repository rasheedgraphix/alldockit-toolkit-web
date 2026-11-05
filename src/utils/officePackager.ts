import JSZip from 'jszip';

/**
 * Escapes XML special characters safely
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Strip invalid XML control chars
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * Converts a 0-based column index to Excel column letters (0 -> A, 25 -> Z, 26 -> AA)
 */
function colIndexToLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Generates a valid Microsoft Excel (.xlsx) OpenXML Blob from 2D string rows
 * Supports multiple sheets (e.g., per page or combined table).
 */
export async function generateXlsxBlob(
  sheets: { name: string; rows: string[][] }[]
): Promise<Blob> {
  const zip = new JSZip();

  const safeSheets = sheets.length > 0 ? sheets : [{ name: 'Sheet1', rows: [['No Data']] }];

  // [Content_Types].xml
  const sheetOverrides = safeSheets
    .map(
      (_, idx) =>
        `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('\n  ');

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`;

  zip.file('[Content_Types].xml', contentTypesXml);

  // _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  zip.file('_rels/.rels', rootRelsXml);

  // xl/workbook.xml
  const workbookSheetsXml = safeSheets
    .map((s, idx) => {
      const cleanSheetName = escapeXml(s.name.replace(/[:\\/?*\[\]]/g, ' ').slice(0, 31) || `Sheet${idx + 1}`);
      return `<sheet name="${cleanSheetName}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`;
    })
    .join('\n    ');

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${workbookSheetsXml}
  </sheets>
</workbook>`;
  zip.file('xl/workbook.xml', workbookXml);

  // xl/_rels/workbook.xml.rels
  const workbookRels = safeSheets
    .map(
      (_, idx) =>
        `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`
    )
    .join('\n  ');

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRels}
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  zip.file('xl/_rels/workbook.xml.rels', workbookRelsXml);

  // xl/styles.xml
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`;
  zip.file('xl/styles.xml', stylesXml);

  // Create each worksheet
  safeSheets.forEach((sheet, sheetIdx) => {
    const rowsXml = sheet.rows
      .map((row, rIdx) => {
        const rowNum = rIdx + 1;
        const cellsXml = row
          .map((cellValue, cIdx) => {
            const cellRef = `${colIndexToLetter(cIdx)}${rowNum}`;
            const trimmed = (cellValue ?? '').trim();
            // Check if pure number
            const numVal = Number(trimmed.replace(/,/g, ''));
            const isNumeric = trimmed !== '' && !isNaN(numVal) && /^-?\d+(\.\d+)?$/.test(trimmed.replace(/,/g, ''));
            const styleAttr = rIdx === 0 ? ' s="1"' : '';

            if (isNumeric) {
              return `<c r="${cellRef}"${styleAttr}><v>${numVal}</v></c>`;
            }
            return `<c r="${cellRef}" t="inlineStr"${styleAttr}><is><t>${escapeXml(trimmed)}</t></is></c>`;
          })
          .join('');
        return `<row r="${rowNum}">${cellsXml}</row>`;
      })
      .join('\n    ');

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rowsXml}
  </sheetData>
</worksheet>`;

    zip.file(`xl/worksheets/sheet${sheetIdx + 1}.xml`, sheetXml);
  });

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });
}

/**
 * Parses an uploaded .xlsx, .csv, or .tsv file into sheets of 2D rows
 */
export async function parseSpreadsheetFile(
  file: File
): Promise<{ name: string; rows: string[][] }[]> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
    const text = await file.text();
    const delimiter = lower.endsWith('.tsv') ? '\t' : ',';
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const rows = lines.map((line) => {
      // Simple CSV parser supporting quoted fields
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    });
    return [{ name: file.name.replace(/\.[^/.]+$/, ''), rows }];
  }

  // Otherwise parse .xlsx OpenXML container via JSZip
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();

  // Read sharedStrings.xml if present
  const sharedStrings: string[] = [];
  const sharedStringsFile = zip.file('xl/sharedStrings.xml');
  if (sharedStringsFile) {
    const ssXml = await sharedStringsFile.async('string');
    const ssDoc = parser.parseFromString(ssXml, 'application/xml');
    const siNodes = ssDoc.getElementsByTagName('si');
    for (let i = 0; i < siNodes.length; i++) {
      const tNodes = siNodes[i].getElementsByTagName('t');
      let combined = '';
      for (let j = 0; j < tNodes.length; j++) {
        combined += tNodes[j].textContent || '';
      }
      sharedStrings.push(combined);
    }
  }

  // Read sheet names from workbook.xml
  const sheetNames: string[] = [];
  const workbookFile = zip.file('xl/workbook.xml');
  if (workbookFile) {
    const wbXml = await workbookFile.async('string');
    const wbDoc = parser.parseFromString(wbXml, 'application/xml');
    const sheetEls = wbDoc.getElementsByTagName('sheet');
    for (let i = 0; i < sheetEls.length; i++) {
      sheetNames.push(sheetEls[i].getAttribute('name') || `Sheet ${i + 1}`);
    }
  }

  // Find worksheet files
  const worksheetFiles = Object.keys(zip.files)
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const numA = parseInt(a.match(/sheet(\d+)\.xml/i)?.[1] || '1', 10);
      const numB = parseInt(b.match(/sheet(\d+)\.xml/i)?.[1] || '1', 10);
      return numA - numB;
    });

  const parsedSheets: { name: string; rows: string[][] }[] = [];

  for (let idx = 0; idx < worksheetFiles.length; idx++) {
    const wsPath = worksheetFiles[idx];
    const wsXml = await zip.file(wsPath)!.async('string');
    const wsDoc = parser.parseFromString(wsXml, 'application/xml');
    const rowNodes = wsDoc.getElementsByTagName('row');
    const rows: string[][] = [];

    for (let r = 0; r < rowNodes.length; r++) {
      const cellNodes = rowNodes[r].getElementsByTagName('c');
      const rowValues: string[] = [];

      for (let c = 0; c < cellNodes.length; c++) {
        const cell = cellNodes[c];
        const cellType = cell.getAttribute('t');
        const vNode = cell.getElementsByTagName('v')[0];
        const isNode = cell.getElementsByTagName('is')[0];

        let val = '';
        if (cellType === 's' && vNode) {
          const sIdx = parseInt(vNode.textContent || '0', 10);
          val = sharedStrings[sIdx] ?? '';
        } else if (cellType === 'inlineStr' && isNode) {
          val = isNode.textContent || '';
        } else if (vNode) {
          val = vNode.textContent || '';
        }
        rowValues.push(val);
      }

      if (rowValues.some((v) => v.trim() !== '')) {
        rows.push(rowValues);
      }
    }

    parsedSheets.push({
      name: sheetNames[idx] || `Sheet ${idx + 1}`,
      rows: rows.length > 0 ? rows : [['Empty Sheet']],
    });
  }

  return parsedSheets.length > 0 ? parsedSheets : [{ name: 'Sheet 1', rows: [['Empty Workbook']] }];
}

/**
 * Generates a real Microsoft PowerPoint (.pptx) OpenXML presentation from rendered slide images + extracted text
 */
export async function generatePptxBlob(
  slides: { imageBytes: Uint8Array; textSummary: string; title: string }[]
): Promise<Blob> {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  const slideOverrides = slides
    .map(
      (_, i) =>
        `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join('\n  ');

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  ${slideOverrides}
</Types>`;
  zip.file('[Content_Types].xml', contentTypes);

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );

  // 3. ppt/presentation.xml (16:9 widescreen 9144000 x 5143500 EMUs)
  const slideIdList = slides
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rIdSlide${i + 1}"/>`)
    .join('\n    ');

  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rIdMaster1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    ${slideIdList}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="5143500" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
  zip.file('ppt/presentation.xml', presentationXml);

  // 4. ppt/_rels/presentation.xml.rels
  const presRels = slides
    .map(
      (_, i) =>
        `<Relationship Id="rIdSlide${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
    )
    .join('\n  ');

  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMaster1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${presRels}
</Relationships>`
  );

  // 5. Minimal slideMaster1 & slideLayout1
  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rIdLayout1"/></p:sldLayoutIdLst>
</p:sldMaster>`
  );

  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>`
  );

  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMaster1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`
  );

  // 6. Add each slide and its background image
  slides.forEach((slide, i) => {
    const slideNum = i + 1;
    const imgFileName = `slide_img_${slideNum}.jpg`;
    zip.file(`ppt/media/${imgFileName}`, slide.imageBytes);

    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="2" name="Slide Image ${slideNum}"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rIdImg1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="9144000" cy="5143500"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`;

    zip.file(`ppt/slides/slide${slideNum}.xml`, slideXml);

    const slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${imgFileName}"/>
</Relationships>`;

    zip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`, slideRelsXml);
  });

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    compression: 'DEFLATE',
  });
}

/**
 * Parses an uploaded .pptx file to extract slides (titles, bullet points, and embedded images)
 */
export interface ParsedSlide {
  slideNumber: number;
  title: string;
  paragraphs: string[];
  imageUrls: string[];
}

export async function parsePptxFile(file: File): Promise<ParsedSlide[]> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();

  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const nA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '1', 10);
      const nB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '1', 10);
      return nA - nB;
    });

  const slides: ParsedSlide[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const slidePath = slideFiles[i];
    const slideNum = i + 1;
    const xmlStr = await zip.file(slidePath)!.async('string');
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');

    // Extract paragraphs (<a:p>)
    const pNodes = xmlDoc.getElementsByTagName('a:p');
    const paragraphs: string[] = [];

    for (let p = 0; p < pNodes.length; p++) {
      const tNodes = pNodes[p].getElementsByTagName('a:t');
      let line = '';
      for (let t = 0; t < tNodes.length; t++) {
        line += tNodes[t].textContent || '';
      }
      if (line.trim()) {
        paragraphs.push(line.trim());
      }
    }

    // Check slide relationships for media images
    const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    const imageUrls: string[] = [];

    if (zip.file(relsPath)) {
      const relsXml = await zip.file(relsPath)!.async('string');
      const relsDoc = parser.parseFromString(relsXml, 'application/xml');
      const relNodes = relsDoc.getElementsByTagName('Relationship');
      for (let r = 0; r < relNodes.length; r++) {
        const target = relNodes[r].getAttribute('Target') || '';
        if (target.includes('media/')) {
          const mediaPath = 'ppt/' + target.replace(/^\.\.\//, '');
          const mediaFile = zip.file(mediaPath);
          if (mediaFile) {
            const blob = await mediaFile.async('blob');
            imageUrls.push(URL.createObjectURL(blob));
          }
        }
      }
    }

    const title = paragraphs[0] || `Slide ${slideNum}`;
    const bodyParagraphs = paragraphs.length > 1 ? paragraphs.slice(1) : [];

    slides.push({
      slideNumber: slideNum,
      title,
      paragraphs: bodyParagraphs,
      imageUrls,
    });
  }

  return slides;
}

/**
 * Parses an uploaded .docx or .txt/.rtf file into structured paragraphs and tables
 */
export interface ParsedWordBlock {
  type: 'heading' | 'paragraph' | 'table';
  text?: string;
  bold?: boolean;
  rows?: string[][];
}

export async function parseDocxFile(file: File): Promise<ParsedWordBlock[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    const raw = await file.text();
    return raw
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        if (line.startsWith('#')) {
          return { type: 'heading', text: line.replace(/^#+\s*/, ''), bold: true };
        }
        return { type: 'paragraph', text: line };
      });
  }

  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error('Invalid Word (.docx) document structure.');
  }

  const xmlStr = await docFile.async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');

  const body = xmlDoc.getElementsByTagName('w:body')[0] || xmlDoc.documentElement;
  const blocks: ParsedWordBlock[] = [];

  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i] as Element;
    if (!node || !node.nodeName) continue;

    if (node.nodeName === 'w:p') {
      const styleNode = node.getElementsByTagName('w:pStyle')[0];
      const styleVal = styleNode?.getAttribute('w:val') || '';
      const isHeading = /heading|title/i.test(styleVal);
      const hasBold = node.getElementsByTagName('w:b').length > 0;

      const tNodes = node.getElementsByTagName('w:t');
      let text = '';
      for (let t = 0; t < tNodes.length; t++) {
        text += tNodes[t].textContent || '';
      }

      if (text.trim()) {
        blocks.push({
          type: isHeading ? 'heading' : 'paragraph',
          text: text.trim(),
          bold: isHeading || hasBold,
        });
      }
    } else if (node.nodeName === 'w:tbl') {
      const trNodes = node.getElementsByTagName('w:tr');
      const rows: string[][] = [];
      for (let r = 0; r < trNodes.length; r++) {
        const tcNodes = trNodes[r].getElementsByTagName('w:tc');
        const rowCells: string[] = [];
        for (let c = 0; c < tcNodes.length; c++) {
          const tNodes = tcNodes[c].getElementsByTagName('w:t');
          let cellText = '';
          for (let t = 0; t < tNodes.length; t++) {
            cellText += tNodes[t].textContent || '';
          }
          rowCells.push(cellText.trim());
        }
        if (rowCells.length > 0) {
          rows.push(rowCells);
        }
      }
      if (rows.length > 0) {
        blocks.push({ type: 'table', rows });
      }
    }
  }

  return blocks.length > 0
    ? blocks
    : [{ type: 'paragraph', text: 'Document contains no extractable text blocks.' }];
}

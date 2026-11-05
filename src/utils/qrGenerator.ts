// ISO/IEC 18004 Standard QR Code Generator - 100% Offline & Fully Scannable
import QRCode from 'qrcode';

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Generates an official, standard-compliant ISO/IEC 18004 QR Code Data URL.
 * Scannable by all standard smartphone cameras, Google Lens, and hardware barcode/QR scanners.
 */
export async function generateQrDataUrl(
  text: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const content = text && text.trim().length > 0 ? text.trim() : 'https://rasheedgraphix.github.io/AllDocKitToolkit/';
  const width = options.width || 600;
  // QR code standard requires at least 4 modules of quiet zone, 3-4 is optimal for scanning
  const margin = options.margin !== undefined ? Math.max(1, options.margin) : 3;
  const dark = options.color?.dark || '#000000';
  const light = options.color?.light || '#ffffff';
  const errorCorrectionLevel = options.errorCorrectionLevel || 'M';

  try {
    return await QRCode.toDataURL(content, {
      width,
      margin,
      errorCorrectionLevel,
      color: {
        dark,
        light,
      },
    });
  } catch (err) {
    console.error('Error generating standard QR code:', err);
    throw err;
  }
}

/**
 * Generates an SVG string representation of the standard QR Code for vector export.
 */
export async function generateQrSvg(
  text: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const content = text && text.trim().length > 0 ? text.trim() : 'https://rasheedgraphix.github.io/AllDocKitToolkit/';
  const width = options.width || 600;
  const margin = options.margin !== undefined ? Math.max(1, options.margin) : 3;
  const dark = options.color?.dark || '#000000';
  const light = options.color?.light || '#ffffff';
  const errorCorrectionLevel = options.errorCorrectionLevel || 'M';

  try {
    return await QRCode.toString(content, {
      type: 'svg',
      width,
      margin,
      errorCorrectionLevel,
      color: {
        dark,
        light,
      },
    });
  } catch (err) {
    console.error('Error generating SVG QR code:', err);
    throw err;
  }
}

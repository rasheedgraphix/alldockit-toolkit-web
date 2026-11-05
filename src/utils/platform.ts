declare global {
  interface Window {
    __TAURI__?: {
      shell?: {
        open: (url: string) => Promise<void>;
      };
      [key: string]: any;
    };
    __TAURI_INTERNALS__?: Record<string, any>;
  }
}

/**
 * Returns true if running inside the Tauri native desktop wrapper.
 * Returns false when running in a standard web browser (e.g. GitHub Pages or local web preview).
 */
export function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__)
  );
}

/**
 * Opens an external web link safely:
 * - If running inside Tauri and window.__TAURI__ exists, attempts to invoke the native desktop opener / shell
 * - If running in a web browser (GitHub Pages), uses window.open(url, '_blank')
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    try {
      // Try Tauri v2 opener plugin
      const opener = await import('@tauri-apps/plugin-opener');
      if (opener && typeof opener.openUrl === 'function') {
        await opener.openUrl(url);
        return;
      }
    } catch {
      // Fallback to window.__TAURI__.shell.open if configured
      try {
        if (window.__TAURI__?.shell?.open) {
          await window.__TAURI__.shell.open(url);
          return;
        }
      } catch (err) {
        console.warn('Native shell.open failed:', err);
      }
    }
  }

  // Web fallback: use window.open
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

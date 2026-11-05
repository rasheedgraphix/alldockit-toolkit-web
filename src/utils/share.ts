/**
 * Utility functions for sharing, WhatsApp integration,
 * and rate-us triggers across AllDocKit.
 */

const ACTION_COUNTER_KEY = 'alldockit_action_counter';
const LAST_RATED_KEY = 'alldockit_has_rated_store';

/**
 * Trigger the Rate Us modal by dispatching a custom event
 */
export function triggerRateUsModal() {
  window.dispatchEvent(new CustomEvent('trigger-rate-us'));
}

/**
 * Increment the user action counter (called on any conversion / download)
 * and trigger the Rate Us popup repeatedly as requested by the user.
 * It triggers on the 2nd action, 4th, 6th, etc., ensuring it appears frequently
 * without breaking user workflow.
 */
export function trackActionAndCheckRatePrompt(): void {
  try {
    const raw = localStorage.getItem(ACTION_COUNTER_KEY);
    const count = raw ? parseInt(raw, 10) + 1 : 1;
    localStorage.setItem(ACTION_COUNTER_KEY, count.toString());

    // Prompt every 2 operations
    if (count % 2 === 0) {
      setTimeout(() => {
        triggerRateUsModal();
      }, 700);
    }
  } catch {
    // ignore local storage errors
  }
}

/**
 * Open Microsoft Store review dialog
 */
export function openMicrosoftStoreReview() {
  const isWindows = /windows/i.test(navigator.userAgent);
  const storeProtocol = 'ms-windows-store://review/?query=alldockit';
  const webStoreUrl = 'https://apps.microsoft.com/search?query=alldockit';

  try {
    if (isWindows) {
      window.location.href = storeProtocol;
      setTimeout(() => {
        window.open(webStoreUrl, '_blank', 'noopener,noreferrer');
      }, 1200);
      return;
    }
  } catch {
    // fallback
  }

  window.open(webStoreUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Share text or document update directly via WhatsApp Web / App
 */
export function shareViaWhatsApp(options: {
  title?: string;
  message: string;
  toolName?: string;
}) {
  const header = options.title ? `*${options.title}*\n\n` : '';
  const toolInfo = options.toolName ? `_Processed with AllDocKit (${options.toolName})_\n\n` : '';
  const footer = `\n\n⚡ Free & 100% Offline PDF & Document Suite by RasheedGraphix: https://apps.microsoft.com/search?query=alldockit`;
  
  const fullText = `${header}${toolInfo}${options.message}${footer}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`;
  
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Native System Share with fallback
 */
export async function shareFileOrText(options: {
  title: string;
  text: string;
  file?: File | Blob;
  fileName?: string;
}): Promise<boolean> {
  try {
    if (navigator.share) {
      const shareData: ShareData = {
        title: options.title,
        text: options.text,
      };

      if (options.file && navigator.canShare) {
        const fileObj =
          options.file instanceof File
            ? options.file
            : new File([options.file], options.fileName || 'document.pdf', {
                type: options.file.type || 'application/pdf',
              });

        if (navigator.canShare({ files: [fileObj] })) {
          shareData.files = [fileObj];
        }
      }

      await navigator.share(shareData);
      return true;
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.warn('System share error, falling back:', err);
    }
  }

  // Fallback to WhatsApp share
  shareViaWhatsApp({
    title: options.title,
    message: options.text,
  });
  return false;
}

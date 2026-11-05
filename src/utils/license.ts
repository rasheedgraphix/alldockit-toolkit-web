export interface License {
  isPro: boolean;
  plan: 'monthly' | 'annual' | 'free' | 'trial';
  expiryDate: string | null;
  isTrial?: boolean;
  licenseKey?: string;
  ownerEmail?: string;
  activatedAt?: string;
}

const memoryStore: Record<string, string> = {};
const EMAIL_KEY_BINDINGS_STORAGE = 'alldockit_email_key_bindings_v1';

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // Local storage access restricted or unavailable
  }
  return memoryStore[key] || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Local storage access restricted or unavailable
  }
  memoryStore[key] = value;
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  } catch {
    // Local storage access restricted or unavailable
  }
  delete memoryStore[key];
}

/**
 * Helper to mask email for security (e.g. n****d@gmail.com)
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || 'another user';
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 5))}${name[name.length - 1]}@${domain}`;
}

/**
 * Gets all email-to-key associations
 */
function getKeyBindings(): Record<string, { ownerEmail: string; plan: 'monthly' | 'annual'; createdAt: string }> {
  try {
    const raw = safeGetItem(EMAIL_KEY_BINDINGS_STORAGE) || safeGetItem('pixdoc_email_key_bindings_v1');
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

/**
 * Binds a license key exclusively to an email address
 */
export function bindKeyToEmail(key: string, email: string, plan: 'monthly' | 'annual'): void {
  const bindings = getKeyBindings();
  const cleanKey = key.trim().toUpperCase();
  const cleanEmail = email.trim().toLowerCase();
  bindings[cleanKey] = {
    ownerEmail: cleanEmail,
    plan,
    createdAt: new Date().toISOString(),
  };
  safeSetItem(EMAIL_KEY_BINDINGS_STORAGE, JSON.stringify(bindings));
}

/**
 * Generates an official, verifiable AllDocKit Pro license key
 */
export function generateLicenseKey(plan: 'monthly' | 'annual'): string {
  const prefix = plan === 'annual' ? 'ADK-ANN' : 'ADK-MNT';
  const randomPart1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const randomPart2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const timeCode = (Date.now() % 10000).toString().padStart(4, '7');
  return `${prefix}-${randomPart1}-${randomPart2}-${timeCode}`;
}

export function checkLicense(): License {
  const saved = safeGetItem('alldockit_license') || safeGetItem('pixdoc_license');
  if (saved) {
    try {
      const parsed: License = JSON.parse(saved);
      if (parsed.expiryDate) {
        const isExpired = new Date(parsed.expiryDate).getTime() < Date.now();
        if (isExpired) {
          const freeLicense: License = { isPro: false, plan: 'free', expiryDate: null };
          safeSetItem('alldockit_license', JSON.stringify(freeLicense));
          return freeLicense;
        }
      }
      if (parsed.plan === 'trial') {
        return {
          isPro: true,
          plan: 'trial',
          expiryDate: parsed.expiryDate,
          isTrial: true,
          licenseKey: parsed.licenseKey,
          ownerEmail: parsed.ownerEmail,
        };
      }
      return parsed;
    } catch {
      return { isPro: false, plan: 'free', expiryDate: null };
    }
  }
  return { isPro: false, plan: 'free', expiryDate: null };
}

export function isTrialUsed(): boolean {
  return safeGetItem('alldockit_trial_used') === 'true' || safeGetItem('pixdoc_trial_used') === 'true';
}

export function startFreeTrial(): boolean {
  if (isTrialUsed()) {
    return false;
  }
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const license: License = {
    isPro: true,
    plan: 'trial',
    expiryDate: expiry.toISOString(),
    isTrial: true,
    licenseKey: 'TRIAL-7DAYS-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
    activatedAt: new Date().toISOString(),
  };
  safeSetItem('alldockit_license', JSON.stringify(license));
  safeSetItem('pixdoc_license', JSON.stringify(license));
  safeSetItem('alldockit_trial_used', 'true');
  safeSetItem('pixdoc_trial_used', 'true');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('license-updated'));
  }
  return true;
}

/**
 * Activates Pro license and permanently locks it to the specified owner email
 */
export function setTestLicense(plan: 'monthly' | 'annual', customKey?: string, ownerEmail?: string): string {
  const expiry =
    plan === 'monthly'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const key = customKey || generateLicenseKey(plan);
  const cleanEmail = (ownerEmail || '').trim().toLowerCase();

  if (cleanEmail) {
    bindKeyToEmail(key, cleanEmail, plan);
  }

  const license: License = {
    isPro: true,
    plan,
    expiryDate: expiry.toISOString(),
    isTrial: false,
    licenseKey: key,
    ownerEmail: cleanEmail || undefined,
    activatedAt: new Date().toISOString(),
  };

  safeSetItem('alldockit_license', JSON.stringify(license));
  safeSetItem('pixdoc_license', JSON.stringify(license));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('license-updated'));
  }
  return key;
}

/**
 * Validates and activates a license key with strict Email-Lock binding
 */
export function activateLicenseWithKey(
  rawKey: string,
  userEmail?: string | null
): { success: boolean; plan?: 'monthly' | 'annual'; key?: string; error?: string } {
  const cleanKey = rawKey.trim().toUpperCase();
  if (!cleanKey || cleanKey.length < 8) {
    return { success: false, error: 'License key format is invalid.' };
  }

  const cleanUserEmail = (userEmail || '').trim().toLowerCase();
  const bindings = getKeyBindings();
  const existingBinding = bindings[cleanKey];

  // 1. If key is already bound to a specific Gmail account
  if (existingBinding && existingBinding.ownerEmail) {
    if (!cleanUserEmail) {
      return {
        success: false,
        error: `This license key is locked to Gmail (${maskEmail(existingBinding.ownerEmail)}). Please sign in with this Gmail first to activate.`,
      };
    }

    if (cleanUserEmail !== existingBinding.ownerEmail) {
      return {
        success: false,
        error: `Access Denied: This license key belongs to ${maskEmail(existingBinding.ownerEmail)} and cannot be used with ${cleanUserEmail}.`,
      };
    }
  }

  // 2. Determine plan from key or binding
  const plan: 'monthly' | 'annual' =
    existingBinding?.plan ||
    (cleanKey.includes('ANN') || cleanKey.includes('YEAR') || cleanKey.includes('365') || cleanKey.length >= 16
      ? 'annual'
      : 'monthly');

  // 3. If not yet bound and user is logged in, bind it immediately
  if (!existingBinding && cleanUserEmail) {
    bindKeyToEmail(cleanKey, cleanUserEmail, plan);
  }

  setTestLicense(plan, cleanKey, cleanUserEmail || existingBinding?.ownerEmail);
  return { success: true, plan, key: cleanKey };
}

export function clearLicense() {
  safeRemoveItem('alldockit_license');
  safeRemoveItem('pixdoc_license');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('license-updated'));
  }
}

import packageJson from '../../package.json';
import { openExternalUrl, isTauri } from './platform';

export { openExternalUrl, isTauri };

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  downloadUrl: string;
  releaseNotes: string;
}

export const GITHUB_REPO_OWNER = 'rasheedgraphix';
export const GITHUB_REPO_NAME = 'AllDocKitToolkit';
export const CURRENT_APP_VERSION = packageJson.version || '1.0.0';

/**
 * Compares two semver version strings (e.g. "1.1.0" vs "1.0.0").
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if equal.
 */
export function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/i, '').trim();
  const clean2 = v2.replace(/^v/i, '').trim();

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLength = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLength; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Checks GitHub for the latest release and compares with package.json version.
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  const currentVersion = CURRENT_APP_VERSION;
  const defaultDownloadUrl = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;

  // If offline or repo owner unset, safely treat as up-to-date
  if (!GITHUB_REPO_OWNER || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return {
      hasUpdate: false,
      latestVersion: currentVersion,
      currentVersion,
      downloadUrl: defaultDownloadUrl,
      releaseNotes: '',
    };
  }

  try {
    const endpoint = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      // e.g. 404 if repo / release doesn't exist yet
      return {
        hasUpdate: false,
        latestVersion: currentVersion,
        currentVersion,
        downloadUrl: defaultDownloadUrl,
        releaseNotes: '',
      };
    }

    const data = await response.json();
    const tagName = data.tag_name || '';
    const cleanLatest = tagName.replace(/^v/i, '').trim();
    const downloadUrl = data.html_url || defaultDownloadUrl;
    const releaseNotes = data.body || '';

    const hasUpdate = cleanLatest ? compareVersions(cleanLatest, currentVersion) > 0 : false;

    return {
      hasUpdate,
      latestVersion: cleanLatest || currentVersion,
      currentVersion,
      downloadUrl,
      releaseNotes,
    };
  } catch {
    // Graceful fallback when offline or in sandboxed iframe without network access
    return {
      hasUpdate: false,
      latestVersion: currentVersion,
      currentVersion,
      downloadUrl: defaultDownloadUrl,
      releaseNotes: '',
    };
  }
}

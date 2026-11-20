// Encode/decode a Profile for GET query strings (no personal data in it: answers only).
import type { Profile } from './session';
export function encodeProfile(p: Profile): string {
  const json = JSON.stringify(p);
  const b64 = typeof window === 'undefined' ? Buffer.from(json, 'utf8').toString('base64') : btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeProfile(s: string | null): Profile {
  if (!s) return {};
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof window === 'undefined' ? Buffer.from(b64, 'base64').toString('utf8') : decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch { return {}; }
}

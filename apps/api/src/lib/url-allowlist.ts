import { URL } from 'node:url';

const PRIVATE_IPV4 = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

export function assertUrlAllowed(
  rawUrl: string,
  /** null = do not restrict by hostname (still applies SSRF rules below). */
  allowlist: Set<string> | null,
): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only http/https URLs are allowed');
  }
  if (url.protocol === 'http:' && url.hostname !== 'localhost') {
    throw new Error('http is only allowed for localhost');
  }
  if (PRIVATE_IPV4.test(url.hostname)) {
    throw new Error('Private network hosts are blocked');
  }
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) {
    throw new Error('Local hosts are blocked');
  }
  const host = url.hostname.toLowerCase();
  if (allowlist !== null && allowlist.size > 0 && !allowlist.has(host)) {
    throw new Error(
      `Host ${host} is not in HTTP_ALLOWLIST_HOSTS. Set HTTP_ALLOWLIST_HOSTS=* (or leave empty), or add this host to the comma-separated list, or set HTTP_ALLOWLIST_DISABLED=true`,
    );
  }
  return url;
}

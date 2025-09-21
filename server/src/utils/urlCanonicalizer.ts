export interface CanonicalizeOptions {
  enforceHttps?: boolean; // default true
  stripTrailingSlash?: boolean; // default true
  addWww?: boolean; // default false
  preserveMailto?: boolean; // default true
}

function isAbsoluteHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u);
}

function isBareHostname(u: string): boolean {
  // Match domain-like strings without protocol: example.com, sub.domain.co.uk, etc.
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(\/.*)?$/.test(u);
}

export function canonicalizeUrl(url: string, options: CanonicalizeOptions = {}): string {
  if (!url || typeof url !== 'string') return url;
  const opts: CanonicalizeOptions = {
    enforceHttps: options.enforceHttps !== false,
    stripTrailingSlash: options.stripTrailingSlash !== false,
    addWww: !!options.addWww,
    preserveMailto: options.preserveMailto !== false
  };

  // Preserve mailto links (unless explicitly disabled)
  if (opts.preserveMailto && url.toLowerCase().startsWith('mailto:')) return url;

  // If it's a bare hostname/domain, prepend https://
  if (!isAbsoluteHttpUrl(url) && isBareHostname(url)) {
    url = `https://${url}`;
  }

  // Only operate on absolute HTTP/HTTPS URLs
  if (!isAbsoluteHttpUrl(url)) return url;

  try {
    const parsed = new URL(url);

    // Enforce HTTPS if enabled
    if (opts.enforceHttps) parsed.protocol = 'https:';

    // Optionally add www
    if (opts.addWww && !parsed.hostname.startsWith('www.')) {
      parsed.hostname = `www.${parsed.hostname}`;
    }

    // Optionally strip trailing slash from pathname (but keep single '/')
    if (opts.stripTrailingSlash && parsed.pathname && parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/+$|\/$/g, '').replace(/\/+/g, '/');
    }

    // Reconstruct without altering search or hash
    return parsed.toString();
  } catch (err) {
    // If URL parsing fails, return original
    return url;
  }
}

const URL_REGEX = /(?:https?:\/\/[^"\s]+|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:\/[^"\s]*)?)/gi;

export function canonicalizeUrlsInText(text: string, options?: CanonicalizeOptions): string {
  if (!text || typeof text !== 'string') return text;
  return text.replace(URL_REGEX, (match) => canonicalizeUrl(match, options));
}

export default { canonicalizeUrl, canonicalizeUrlsInText };

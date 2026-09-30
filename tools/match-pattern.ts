/**
 * WebExtension match patterns ("https://*.example.com/*"), the way
 * metadata.json lists the pages an Activity is for. Only web pages: the
 * scheme is `http`, `https`, or `*` (both), and the host is a name, optionally
 * with every subdomain (`*.`), never every site.
 */
const PATTERN = /^(\*|https?):\/\/(\*\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*)(\/.*)$/;

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function compileMatchPattern(pattern: string): ((url: URL) => boolean) | null {
  const parts = PATTERN.exec(pattern);
  if (!parts) return null;
  const [, scheme, subdomains, host, path = "/"] = parts;
  const pathPattern = new RegExp(`^${path.split("*").map(escape).join(".*")}$`);
  return (url) =>
    (scheme === "*"
      ? url.protocol === "https:" || url.protocol === "http:"
      : url.protocol === `${scheme}:`) &&
    (url.hostname === host || (subdomains !== undefined && url.hostname.endsWith(`.${host}`))) &&
    pathPattern.test(url.pathname + url.search);
}

/** Whether `url` matches any of `patterns`. */
export function matchesAny(patterns: readonly string[], url: URL): boolean {
  return patterns.some((pattern) => compileMatchPattern(pattern)?.(url) ?? false);
}

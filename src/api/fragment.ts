/**
 * The `#a=b&c=d` half of a redirect URL.
 *
 * Both browser round-trips in this app — the Google sign-in and the payment
 * sheet — bring their result back in a fragment rather than a query, and for the
 * same reason: a fragment is never sent to a server, so a one-time code or a
 * payment signature stays out of access logs and proxies on the way home.
 *
 * `URL` in Hermes does not parse a custom scheme reliably, so this reads the
 * string directly rather than going through it.
 */
export function fragmentParams(url: string): URLSearchParams {
  const hash = url.indexOf('#');
  return new URLSearchParams(hash === -1 ? '' : url.slice(hash + 1));
}

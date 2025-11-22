// content.js - runs at document_start
// Inject an in-page script so we can safely override window timers and other page-level behaviors.
(function(){
  const injectedCode = `(() => {
    // Protect real functions in case pages try to detect overrides
    try {
      // No-op out timers to prevent forced waits
      const _setTimeout = window.setTimeout;
      const _setInterval = window.setInterval;
      window.setTimeout = function(fn, t) {
        // execute immediately (or schedule with minimal delay)
        return _setTimeout(fn, 0);
      };
      window.setInterval = function(fn, t) {
        // call fn immediately once, then no repeated intervals to avoid infinite loops
        _setTimeout(fn, 0);
        return 0;
      };

      // Remove meta refresh tags that force waits/redirects
      const metas = document.getElementsByTagName('meta');
      for (let i = metas.length - 1; i >= 0; i--) {
        const m = metas[i];
        const eq = (m.httpEquiv || '').toLowerCase();
        if (eq === 'refresh') {
          m.remove();
        }
      }

      // Intercept certain common redirect helper functions to prevent script-based delays
      const originalAssign = Location.prototype.assign;
      const originalReplace = Location.prototype.replace;
      // We'll leave these alone but the content script will perform direct replace when needed.

    } catch (e) {
      // ignore
    }
  })();`;

  const s = document.createElement('script');
  s.textContent = injectedCode;
  (document.documentElement || document.head || document.body).appendChild(s);
  s.remove();

  // Now run our decode + immediate redirect logic in the content script context.
  try {
    function decodeBase64UrlSafe(encoded) {
      if (!encoded) return null;
      try {
        encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');
        while (encoded.length % 4) encoded += '=';
        return atob(encoded);
      } catch (e) {
        return null;
      }
    }

    const url = new URL(window.location.href);
    const candidates = ["id","url","u","link","target","r","next"];

    for (const key of candidates) {
      if (url.searchParams.has(key)) {
        const val = url.searchParams.get(key);
        if (val && val.length > 8) {
          const decoded = decodeBase64UrlSafe(val);
          if (decoded && /^https?:\/\//i.test(decoded)) {
            // Use replace so the ad page won't remain in history
            try {
              window.location.replace(decoded);
            } catch (e) {
              window.location.href = decoded;
            }
            // stop further processing
            return;
          }
        }
      }
    }

    // Additional heuristic: sometimes pages embed base64 in JavaScript variables or inline tags.
    // Try to find common patterns in the HTML (only if small)
    try {
      const html = document.documentElement && document.documentElement.innerHTML;
      if (html && html.length < 200000) { // avoid huge pages
        const b64match = html.match(/[A-Za-z0-9-_]{20,}={0,2}/);
        if (b64match) {
          const candidate = b64match[0];
          const maybe = decodeBase64UrlSafe(candidate);
          if (maybe && /^https?:\/\//i.test(maybe)) {
            window.location.replace(maybe);
            return;
          }
        }
      }
    } catch (e) {}

  } catch (e) {
    // content script errors should not break page
    console.error('AdBypass content error', e);
  }
})();
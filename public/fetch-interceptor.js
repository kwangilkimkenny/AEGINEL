// Aegis Personal – Fetch Interceptor (MAIN world)
// Wraps window.fetch so that when data-aegis-proxy-text is set on <html>,
// the outgoing request body's query text is replaced with the proxied version.
// This handles sites where setInputText cannot update the framework's
// internal state (e.g. React-controlled contenteditable).
(function () {
  var _origFetch = window.fetch;

  window.fetch = function (url, opts) {
    var proxy = document.documentElement.getAttribute('data-aegis-proxy-text');
    if (proxy && opts && opts.body && typeof opts.body === 'string') {
      try {
        var body = JSON.parse(opts.body);
        var keys = ['query_str', 'query', 'prompt', 'content', 'message', 'text'];
        var replaced = false;

        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          if (!replaced && typeof body[k] === 'string') {
            body[k] = proxy;
            replaced = true;
          }
          if (!replaced && body.params && typeof body.params[k] === 'string') {
            body.params[k] = proxy;
            replaced = true;
          }
        }

        if (replaced) {
          document.documentElement.removeAttribute('data-aegis-proxy-text');
          return _origFetch.call(this, url, Object.assign({}, opts, { body: JSON.stringify(body) }));
        }
      } catch (_e) { /* not JSON, pass through */ }
    }
    return _origFetch.call(this, url, opts);
  };
})();

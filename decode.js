// decode.js — shared, pure decode/detect logic. NO chrome APIs, NO DOM.
// Loaded by BOTH the background service worker (importScripts) and the
// content script (manifest content_scripts). Exposes a global `Decoder`.

(function (global) {
  "use strict";

  // ---- bytes / encoding helpers -------------------------------------------

  function b64ToBytes(s) {
    s = s.trim().replace(/\s+/g, "");
    s = s.replace(/-/g, "+").replace(/_/g, "/"); // URL-safe base64
    const pad = s.length % 4;
    if (pad === 2) s += "==";
    else if (pad === 3) s += "=";
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function bytesToUtf8(bytes) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (e) {
      return null; // not valid UTF-8 → binary
    }
  }

  function bytesToHex(bytes, max = 512) {
    let out = "";
    for (let i = 0; i < Math.min(bytes.length, max); i++) {
      out += bytes[i].toString(16).padStart(2, "0") + " ";
      if ((i + 1) % 16 === 0) out += "\n";
    }
    if (bytes.length > max) out += "\n… (" + (bytes.length - max) + " more bytes)";
    return out.trim();
  }

  // ---- per-format decoders -------------------------------------------------

  function decodeBase64(s) {
    try {
      const bytes = b64ToBytes(s);
      const text = bytesToUtf8(bytes);
      return { ok: true, kind: "base64", text: text, bytes: bytes, binary: text === null };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  function decodeUrl(s) {
    try {
      const text = decodeURIComponent(s);
      return { ok: true, kind: "url", text: text, bytes: new TextEncoder().encode(text), binary: false };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  // Compact HTML entity decoder (numeric + common named) — no DOM needed.
  const HTML_ENTITIES = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    nbsp: " ", copy: "©", reg: "®", trade: "™", hellip: "…",
    mdash: "—", ndash: "–", laquo: "«", raquo: "»", middot: "·",
  };

  function safeChr(code) {
    if (!isFinite(code) || code <= 0) return "\uFFFD";
    if (code >= 0xd800 && code <= 0xdfff) return "\uFFFD";
    try {
      return String.fromCodePoint(code);
    } catch (e) {
      return "\uFFFD";
    }
  }

  function decodeHtml(s) {
    const text = s.replace(/&(#x[0-9a-fA-F]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,31});/gi, function (m, e) {
      const low = e.toLowerCase();
      if (low.charAt(0) === "#") {
        if (low.charAt(1) === "x") return safeChr(parseInt(low.slice(2), 16));
        return safeChr(parseInt(low.slice(1), 10));
      }
      return Object.prototype.hasOwnProperty.call(HTML_ENTITIES, low) ? HTML_ENTITIES[low] : m;
    });
    return { ok: true, kind: "html", text: text, bytes: new TextEncoder().encode(text), binary: false };
  }

  function decodeHex(s) {
    const clean = s.replace(/\s+/g, "").replace(/0x/gi, "");
    if (clean.length === 0) return { ok: false, error: "empty hex" };
    if (clean.length % 2 !== 0) return { ok: false, error: "odd hex length" };
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    const text = bytesToUtf8(bytes);
    return { ok: true, kind: "hex", text: text, bytes: bytes, binary: text === null };
  }

  // ---- detection -------------------------------------------------------------

  const URL_RE = /%(?:[0-9A-Fa-f]{2})/;
  const HTML_RE = /&(?:[a-z][a-z0-9]{1,31}|#\d+|#x[0-9a-fA-F]+);/;
  const HEX_RE = /^[0-9a-fA-F\s]+$/;
  const B64_RE = /^[A-Za-z0-9+/=\-_\s]+$/;

  function cleanedLen(s) {
    return s.replace(/\s+/g, "").length;
  }

  // Detect the most likely encoding. Returns "base64" | "url" | "html" | "hex" | null.
  // preferText: when true (tooltip auto-detect), require base64 to decode to
  // readable UTF-8 to avoid showing junk on ordinary text selections.
  function detect(s, preferText) {
    const t = (s || "").trim();
    if (!t) return null;

    if (URL_RE.test(t)) return "url";
    if (HTML_RE.test(t)) return "html";

    const hexClean = t.replace(/\s+/g, "").replace(/0x/gi, "");
    if (HEX_RE.test(t) && hexClean.length >= 4 && hexClean.length % 2 === 0) return "hex";

    if (B64_RE.test(t)) {
      const len = cleanedLen(t);
      // A valid base64 (with optional padding) never has length % 4 === 1.
      if (len % 4 === 1) return null;
      if (preferText) {
        if (len < 8) return null; // too short to be meaningful auto-detect
        const r = decodeBase64(t);
        if (!r.ok || r.binary) return null; // junk on plain text → skip
      }
      return "base64";
    }

    return null;
  }

  // Decode with auto-detection.
  function autoDecode(s, preferText) {
    const kind = detect(s, preferText);
    if (!kind) return { ok: false, error: "Could not detect the format", detected: null };
    let r;
    switch (kind) {
      case "base64": r = decodeBase64(s); break;
      case "url": r = decodeUrl(s); break;
      case "html": r = decodeHtml(s); break;
      case "hex": r = decodeHex(s); break;
    }
    r.detected = kind;
    return r;
  }

  // A decoded result that should be treated as a clickable URL.
  function looksLikeUrl(text) {
    if (!text) return false;
    return /^https?:\/\/\S+$/i.test(text) ||
      /^www\.\S+$/i.test(text) ||
      /^data:image\//i.test(text) ||
      /^mailto:\S+$/i.test(text);
  }

  // data:image/... returns true → render inline preview.
  function looksLikeImage(text) {
    return !!text && /^data:image\//i.test(text);
  }

  global.Decoder = {
    decodeBase64: decodeBase64,
    decodeUrl: decodeUrl,
    decodeHtml: decodeHtml,
    decodeHex: decodeHex,
    detect: detect,
    autoDecode: autoDecode,
    bytesToHex: bytesToHex,
    bytesToUtf8: bytesToUtf8,
    looksLikeUrl: looksLikeUrl,
    looksLikeImage: looksLikeImage,
  };
})(typeof self !== "undefined" ? self : this);

if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof self !== "undefined" ? self : this).Decoder;
}

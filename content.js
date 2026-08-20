// content.js — selection tooltip + in-page overlay renderer (v2)
// Runs on all pages (see manifest content_scripts). Relies on `Decoder`
// (decode.js) being loaded first.
(() => {
  "use strict";
  if (window.__b64dInjected) return;
  window.__b64dInjected = true;

  const TOOLTIP_MAX = 200; // max selected chars to auto-decode

  // ---------- overlay (shared renderer reused by content flow) ----------
  function renderOverlayInto(host, payload) {
    const ov = document.createElement("div");
    ov.id = "b64d-overlay";
    ov.style.cssText =
      "position:fixed;top:80px;right:20px;z-index:2147483647;max-width:440px;" +
      "max-height:75vh;overflow:auto;background:#1f2430;color:#e6e6e6;" +
      "border:1px solid #3a4160;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5);" +
      "font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:14px 16px;";

    const title = document.createElement("div");
    title.textContent = payload.icon + " " + payload.title + " · " + payload.kind;
    title.style.cssText = "font-weight:700;margin-bottom:8px;";

    const body = document.createElement("div");
    body.style.cssText =
      "word-break:break-all;white-space:pre-wrap;background:#0e1117;border-radius:6px;" +
      "padding:10px;margin-bottom:10px;max-height:45vh;overflow:auto;";

    if (payload.imageUrl) {
      const img = document.createElement("img");
      img.src = payload.imageUrl;
      img.style.cssText =
        "display:block;max-width:100%;max-height:240px;margin:0 auto 8px;border-radius:6px;";
      body.appendChild(img);
    }
    const textNode = document.createElement("div");
    textNode.textContent = payload.displayText || "(binary data — see hex below)";
    body.appendChild(textNode);

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
    const mkBtn = (label, fn) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText =
        "flex:1;cursor:pointer;border:0;border-radius:6px;padding:7px 10px;" +
        "background:#4f8cff;color:#fff;font-weight:600;";
      b.onclick = fn;
      return b;
    };
    const copyBtn = mkBtn("복사", () => {
      navigator.clipboard.writeText(payload.copyText).then(() => {
        copyBtn.textContent = "복사됨 ✓";
      }).catch(() => { copyBtn.textContent = "복사 실패"; });
    });
    const openBtn = mkBtn("링크 열기", () => window.open(payload.urlToOpen, "_blank"));
    const closeBtn = mkBtn("닫기", () => ov.remove());
    closeBtn.style.background = "#3a4160";

    row.appendChild(copyBtn);
    if (payload.urlToOpen) row.appendChild(openBtn);
    row.appendChild(closeBtn);

    ov.appendChild(title);
    ov.appendChild(body);
    ov.appendChild(row);
    if (payload.hex) {
      const hexLabel = document.createElement("div");
      hexLabel.textContent = "HEX 덤프:";
      hexLabel.style.cssText = "font-weight:700;margin:10px 0 4px;";
      const hexBody = document.createElement("div");
      hexBody.style.cssText =
        "word-break:break-all;white-space:pre-wrap;background:#0e1117;border-radius:6px;" +
        "padding:10px;max-height:30vh;overflow:auto;font-family:monospace;";
      hexBody.textContent = payload.hex;
      ov.appendChild(hexLabel);
      ov.appendChild(hexBody);
    }
    document.documentElement.appendChild(ov);
  }

  function buildPayload(src, kind) {
    const isImage = Decoder.looksLikeImage(src.text);
    const isUrl = isImage || Decoder.looksLikeUrl(src.text);
    return {
      title: isImage ? "이미지 미리보기" : "디코드 결과",
      icon: "🔓",
      kind: kind,
      displayText: isImage ? "" : (src.binary ? null : src.text),
      imageUrl: isImage ? src.text : null,
      copyText: src.binary ? Decoder.bytesToHex(src.bytes) : src.text,
      urlToOpen: isUrl && !isImage ? src.text : null,
      hex: src.binary ? Decoder.bytesToHex(src.bytes) : null,
    };
  }

  // ---------- tooltip ----------
  let tooltip = null;

  function ensureTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.id = "b64d-tooltip";
    tooltip.style.cssText =
      "position:fixed;z-index:2147483647;min-width:200px;max-width:320px;" +
      "background:#1f2430;color:#e6e6e6;border:1px solid #3a4160;border-radius:8px;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.45);font:12px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;" +
      "padding:10px 12px;display:none;";
    document.documentElement.appendChild(tooltip);
    return tooltip;
  }

  function hideTooltip() {
    if (tooltip) tooltip.style.display = "none";
  }

  function insideOurUi(node) {
    while (node) {
      if (node.id === "b64d-tooltip" || node.id === "b64d-overlay") return true;
      node = node.parentElement;
    }
    return false;
  }

  function showTooltip(x, y, res, raw) {
    const tt = ensureTooltip();
    tt.textContent = "";

    const head = document.createElement("div");
    head.textContent = "🔓 " + res.detected + " 디코드";
    head.style.cssText = "font-weight:700;margin-bottom:6px;";

    const pre = document.createElement("div");
    pre.style.cssText = "word-break:break-all;white-space:pre-wrap;background:#0e1117;" +
      "border-radius:4px;padding:6px;max-height:180px;overflow:auto;margin-bottom:8px;";
    const snippet = res.binary
      ? Decoder.bytesToHex(res.bytes, 96)
      : (res.text.length > 600 ? res.text.slice(0, 600) + "…" : res.text);
    pre.textContent = snippet;

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
    const mkBtn = (label, fn, accent) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = "cursor:pointer;border:0;border-radius:5px;padding:5px 9px;" +
        "font-weight:600;background:" + (accent ? "#4f8cff" : "#3a4160") + ";color:#fff;";
      b.onclick = fn;
      return b;
    };

    const isUrl = Decoder.looksLikeUrl(res.text);
    const isImage = Decoder.looksLikeImage(res.text);

    const openBtn = mkBtn("열기", () => {
      let u = res.text.trim();
      if (/^www\./i.test(u)) u = "http://" + u;
      window.open(u, "_blank");
    }, true);
    const copyBtn = mkBtn("복사", () => {
      navigator.clipboard.writeText(res.binary ? Decoder.bytesToHex(res.bytes) : res.text).then(() => {
        copyBtn.textContent = "복사됨 ✓";
      });
    }, true);
    const moreBtn = mkBtn("자세히", () => {
      renderOverlayInto(document.documentElement, buildPayload(res, res.detected));
      hideTooltip();
    });
    const closeBtn = mkBtn("닫기", hideTooltip);

    if (isUrl && !isImage) row.appendChild(openBtn);
    row.appendChild(copyBtn);
    row.appendChild(moreBtn);
    row.appendChild(closeBtn);

    tt.appendChild(head);
    tt.appendChild(pre);
    tt.appendChild(row);

    // position near cursor, clamp to viewport
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    let left = x + 12;
    if (left + 320 > vw) left = Math.max(4, x - 332);
    let top = y + 12;
    if (top + 300 > vh) top = Math.max(4, y - 312);
    tt.style.left = left + "px";
    tt.style.top = top + "px";
    tt.style.display = "block";
  }

  // Auto-detect on selection.
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { hideTooltip(); return; }
    if (insideOurUi(sel.anchorNode)) { hideTooltip(); return; }
    const s = sel.toString().trim();
    if (!s || s.length > TOOLTIP_MAX) { hideTooltip(); return; }

    const res = Decoder.autoDecode(s, true);
    if (!res || !res.ok) { hideTooltip(); return; }

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    showTooltip(rect.right, rect.top, res, s);
  });

  document.addEventListener("mousedown", (e) => {
    if (!insideOurUi(e.target)) hideTooltip();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideTooltip();
  });
})();

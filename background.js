// Base64 Right-Click Decoder — MV3 service worker (v2)
// Right-click a selected string -> auto-detect base64/URL/HTML/hex -> decode
// -> open URL, preview image, or show result (text or hex dump).

importScripts("decode.js");

const MENU_OPEN = "dec-open";
const MENU_COPY = "dec-copy";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_OPEN,
      title: "Decode → Open Link",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU_COPY,
      title: "Decode → Copy Result",
      contexts: ["selection"],
    });
  });
});

function alertInTab(tabId, message) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (msg) => {
      alert("[Base64 Decoder]\n\n" + msg);
    },
    args: [message],
  });
}

// Render the result overlay in the page. Passed as a self-contained function
// to chrome.scripting.executeScript (works even if the content script isn't there).
function renderOverlay(payload) {
  const old = document.getElementById("b64d-overlay");
  if (old) old.remove();

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

  const copyBtn = mkBtn("Copy", () => {
    navigator.clipboard.writeText(payload.copyText).then(() => {
      copyBtn.textContent = "Copied ✓";
    }).catch(() => {
      copyBtn.textContent = "Copy failed";
    });
  });

  const row2 = document.createElement("div");
  row2.style.cssText = "display:flex;gap:8px;";
  const openBtn = mkBtn("Open Link", () => {
    window.open(payload.urlToOpen, "_blank");
  });
  const closeBtn = mkBtn("Close", () => ov.remove());
  closeBtn.style.background = "#3a4160";

  row.appendChild(copyBtn);
  if (payload.urlToOpen) row.appendChild(openBtn);
  row.appendChild(closeBtn);

  ov.appendChild(title);
  ov.appendChild(body);
  ov.appendChild(row);
  if (payload.hex) {
    const hexLabel = document.createElement("div");
    hexLabel.textContent = "HEX dump:";
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

function openUrl(tab, url) {
  let u = url.trim();
  if (/^www\./i.test(u)) u = "http://" + u;
  chrome.tabs.create({ url: u });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_OPEN && info.menuItemId !== MENU_COPY) return;

  const res = Decoder.autoDecode(info.selectionText, false);
  if (!res.ok) {
    alertInTab(tab.id, "Decode failed — could not detect or decode the encoding (base64/URL/HTML/hex) of the selected text.\n\n" + (res.error || ""));
    return;
  }

  const decodedText = res.binary ? null : res.text;
  const isImage = Decoder.looksLikeImage(decodedText);
  const isUrl = isImage || Decoder.looksLikeUrl(decodedText);

  // "Open link" immediately when it's a URL (and not something we should preview).
  if (info.menuItemId === MENU_OPEN && isUrl && !isImage) {
    openUrl(tab, decodedText);
    return;
  }

  const payload = {
    title: isImage ? "Image Preview" : "Decoded Result",
    icon: "🔓",
    kind: res.detected,
    displayText: isImage ? "" : decodedText,
    imageUrl: isImage ? decodedText : null,
    copyText: isImage ? decodedText : (decodedText || Decoder.bytesToHex(res.bytes)),
    urlToOpen: isUrl && !isImage ? decodedText : null,
    hex: res.binary ? Decoder.bytesToHex(res.bytes) : null,
  };

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: renderOverlay,
    args: [payload],
  });
});

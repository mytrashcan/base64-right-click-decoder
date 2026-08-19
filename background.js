// Base64 Link Decoder — MV3 service worker
// Right-click a selected base64 string -> decode -> open URL or show result.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "b64-decode-open",
    title: "Base64 디코드 → 링크 열기",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "b64-copy-text",
    title: "Base64 디코드 → 결과 복사",
    contexts: ["selection"]
  });
});

// Tolerant base64 decoder: handles whitespace, URL-safe (- _) and missing padding.
function decodeB64(s) {
  try {
    s = s.trim().replace(/\s+/g, "");
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad === 2) s += "==";
    else if (pad === 3) s += "=";
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function looksLikeUrl(s) {
  return /^https?:\/\/\S+$/i.test(s) || /^www\.\S+$/i.test(s);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Content script asks for decoded result when user clicks the in-page button case.
  return false;
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "b64-decode-open" && info.menuItemId !== "b64-copy-text") return;

  const res = decodeB64(info.selectionText);

  if (!res.ok) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (err) => {
        alert("[Base64 Decoder]\n\n디코드 실패 — 선택한 텍스트가 유효한 base64가 아닙니다.\n" + err);
      },
      args: [res.error]
    });
    return;
  }

  const decoded = res.text;

  if (info.menuItemId === "b64-decode-open" && looksLikeUrl(decoded)) {
    let url = decoded.trim();
    if (!/^https?:\/\//i.test(url)) url = "http://" + url;
    chrome.tabs.create({ url });
    return;
  }

  // Show result in an in-page overlay with a copy button.
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (text, isUrl) => {
      // Clean up any previous overlay
      const old = document.getElementById("b64d-overlay");
      if (old) old.remove();

      const ov = document.createElement("div");
      ov.id = "b64d-overlay";
      ov.style.cssText =
        "position:fixed;top:80px;right:20px;z-index:2147483647;max-width:420px;" +
        "max-height:70vh;overflow:auto;background:#1f2430;color:#e6e6e6;" +
        "border:1px solid #3a4160;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5);" +
        "font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:14px 16px;";

      const title = document.createElement("div");
      title.textContent = isUrl ? "🔗 디코드된 링크" : "🔓 Base64 디코드 결과";
      title.style.cssText = "font-weight:700;margin-bottom:8px;";

      const body = document.createElement("div");
      body.textContent = text;
      body.style.cssText =
        "word-break:break-all;white-space:pre-wrap;background:#0e1117;border-radius:6px;" +
        "padding:10px;margin-bottom:10px;max-height:45vh;overflow:auto;";

      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;";

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
        navigator.clipboard.writeText(text);
        copyBtn.textContent = "복사됨 ✓";
      });

      const closeBtn = mkBtn("닫기", () => ov.remove());
      closeBtn.style.background = "#3a4160";

      const openBtn = mkBtn("링크 열기", () => {
        window.open(/^https?:\/\//i.test(text) ? text : "http://" + text, "_blank");
      });

      row.appendChild(copyBtn);
      if (isUrl) row.appendChild(openBtn);
      row.appendChild(closeBtn);

      ov.appendChild(title);
      ov.appendChild(body);
      ov.appendChild(row);
      document.documentElement.appendChild(ov);
    },
    args: [decoded, looksLikeUrl(decoded)]
  });
});

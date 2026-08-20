# Base64 Right-Click Decoder

Decode a base64 string you see on any webpage **right on the page** and open the resulting link directly — no need to visit an external decoder site.

## Features

- **Right-click → "Base64 디코드 → 링크 열기"**: selects base64 text, decodes it, and if the result is a URL it opens in a new tab immediately.
- **Right-click → "Base64 디코드 → 결과 복사"**: shows the decoded result in a small in-page overlay with a one-click copy button.
- Handles line breaks / whitespace, URL-safe characters (`-` `_`), and missing padding.
- Everything runs locally. **No data collection, no analytics, no remote code.**

## Install (Developer Mode)

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select this folder
5. Done — your extension is loaded locally.

## Usage

On any page, **drag-select a base64 string** (e.g. `aHR0cHM6Ly93d3cuZ29vZ2xlLmNvbQ==`), **right-click**, and choose:

- **Base64 디코드 → 링크 열기** — opens `https://www.google.com` in a new tab
- **Base64 디코드 → 결과 복사** — shows the decoded text with a copy button

## Project Layout

```
manifest.json   # MV3 manifest — permissions: contextMenus, activeTab, scripting
background.js   # Service worker — context menu + decode logic + result overlay
icons/          # 16 / 48 / 128 px icons
```

## Permissions & Privacy

| Permission | Why |
|------------|-----|
| `contextMenus` | Adds the right-click decode menu |
| `activeTab` | Temporary access to the active tab only when the user invokes the extension |
| `scripting` | Injects the small result overlay into the active page |

No background browsing, no data collection, no remote code — every action is triggered by an explicit user right-click.

## License

[MIT](LICENSE)

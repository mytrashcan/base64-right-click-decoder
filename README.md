# Base64 Right-Click Decoder

Decode a base64 / URL / HTML / hex string you see on any webpage **right on the page**, and open the result as a link, preview an image, or copy it — no need to visit an external decoder site.

## Features

- **Right-click → "Decode → Open Link"**: auto-detects the format of the selected text and, if the decoded result is a URL, opens it in a new tab immediately.
- **Right-click → "Decode → Copy Result"**: shows the decoded result in a small in-page overlay with a one-click copy button.
- **Multi-format auto-detection**: base64, URL encoding (`%20`), HTML entities (`&amp;`), and hex — no need to pick the format yourself.
- **Binary safe**: if base64/hex decodes to binary (not readable text), it shows a **hex dump** instead of a decode error.
- **Image preview**: if the decoded result is a `data:image/...` URL, it renders the image inline.
- **Selection tooltip**: drag-select encoded text and a tooltip appears instantly with the decoded result, open/copy/details buttons.
- Handles line breaks / whitespace, URL-safe base64 (`-` `_`), and missing padding.
- Everything runs locally. **No data collection, no analytics, no remote code.**

## Install (Developer Mode)

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select this folder
5. Done — your extension is loaded locally.

## Usage

On any page:

- **Drag-select** an encoded string (e.g. `aHR0cHM6Ly93d3cuZ29vZ2xlLmNvbQ==`) → a **tooltip** shows the decoded result automatically.
- Or **right-click** a selection and choose:
  - **Decode → Open Link** — opens `https://www.google.com` in a new tab
  - **Decode → Copy Result** — shows the decoded text with a copy button

## Project Layout

```
manifest.json   # MV3 manifest — permissions + content_scripts
decode.js       # Shared, pure decode/detect logic (base64/URL/HTML/hex, binary->hex)
background.js   # Service worker — context menus + result overlay injection
content.js      # Content script — selection tooltip + overlay
icons/          # 16 / 48 / 128 px icons
```

## Permissions & Privacy

| Permission | Why |
|------------|-----|
| `contextMenus` | Adds the right-click decode menu |
| `activeTab` | Temporary access to the active tab only when the user invokes the extension |
| `scripting` | Injects the result overlay into the active page |
| `content_scripts` (all pages) | Shows the selection tooltip; require access to every page's text selection |

Chrome will show a **"Read and change all your data on all websites"** warning because `content_scripts` runs on all pages to power the tooltip. No background browsing, no data collection, no remote code — the tooltip only reads the text you actively drag-select, and every action is triggered by an explicit user gesture.

## License

[MIT](LICENSE)

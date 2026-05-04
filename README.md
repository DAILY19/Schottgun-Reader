# SchottGun Reader — RSVP Speed Reading PWA

> Paste text or drop a PDF/TXT file, then read at 100–1000 WPM with one word at a time flashing on screen. Installable as a Progressive Web App — no app store required.

![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)
![PDF.js](https://img.shields.io/badge/PDF.js-3.11-FF0000)
![License](https://img.shields.io/badge/License-MIT-green)

---

## The Problem

Most people read at 200–250 WPM. RSVP (Rapid Serial Visual Presentation) — flashing one word at a time in a fixed position — eliminates saccadic eye movement and can push comfortable reading speed to 400–600 WPM. Most RSVP tools are paywalled, require a native install, or only accept plain text. SchottGun Reader is free, installable from a browser URL, and handles PDFs natively.

---

## Features

- **PDF & TXT support** — drag-and-drop a file or paste text directly; PDF text is extracted in-browser via PDF.js (no upload to a server)
- **Adjustable WPM** — slider from 100 to 1000 WPM; updates live during playback
- **Progress scrubbing** — click or drag the progress bar to jump to any word
- **Back / Forward controls** — step one word at a time for review
- **Word + time counters** — always shows current word number, total, and estimated time remaining
- **Offline-capable PWA** — Service Worker caches the app shell; works without internet after first visit
- **Installable** — add to iOS/Android/Windows home screen via the browser "Add to Home Screen" prompt
- **Zero dependencies** — pure vanilla JavaScript, no build step required

---

## Demo

Open `index.html` directly in a browser, or serve it locally:

```bash
npx serve .
# → http://localhost:3000
```

On iOS/Android, open the URL in Safari/Chrome and tap **Add to Home Screen** to install as a native-feeling app.

---

## How It Works

```
User drops PDF → FileReader → PDF.js extracts text → word array
User drops TXT → FileReader.readAsText → word array
User pastes text → textarea → word array

word array → interval timer (60000 / wpm ms per word) → flash current word
```

Words are tokenized by whitespace. The interval timer is cleared and restarted when WPM changes, preserving the current index.

---

## Project Structure

```
SchottGun Reader/
├── index.html      # App shell and all markup
├── app.js          # Core reader logic (state machine, file loading, playback)
├── style.css       # UI styles (dark theme, responsive)
├── server.js       # Optional minimal Node server for local dev
├── manifest.json   # PWA manifest (icons, name, theme color)
├── sw.js           # Service Worker (cache-first strategy for offline support)
└── icons/          # App icons (192px, 512px) for PWA install
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Vanilla JavaScript (ES5 strict mode) |
| PDF parsing | [PDF.js](https://mozilla.github.io/pdf.js/) 3.11 via CDN |
| Offline | Service Worker (Cache API, cache-first) |
| Installable | Web App Manifest (PWA) |
| Hosting | Any static host — GitHub Pages, Netlify, local file |

---

## Challenges & Solutions

**Challenge:** PDF text extraction varies wildly across PDF types (scanned images, columnar layouts, mixed encodings).  
**Solution:** Used PDF.js `getTextContent()` per page, concatenated text items with whitespace normalization. Scanned/image-only PDFs display a clear error rather than silently producing garbage words.

**Challenge:** Keeping WPM changes smooth without restarting the word position.  
**Solution:** On slider input, `clearInterval` the active timer and immediately `setInterval` with the new delay from the *current* index — no position reset.

**Challenge:** Making the PWA feel native on iOS (which requires specific `<meta>` tags separate from the manifest).  
**Solution:** Added Apple-specific `apple-mobile-web-app-*` meta tags and `apple-touch-icon` links alongside the standard W3C manifest entries.

---

## Accessibility

- All interactive elements are keyboard-navigable
- Progress bar uses `role="progressbar"` with `aria-valuenow`
- High-contrast dark theme (WCAG AA contrast ratios)
- File drop zone announces state changes via `aria-live`

---

## License

MIT — see [LICENSE](LICENSE) for details.
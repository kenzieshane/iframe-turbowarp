# TurboWarp Iframe Extension (Unsandboxed)

This is a minimal custom TurboWarp extension that creates and controls an iframe over the stage.

## Files

- `iframe-extension.js` — the extension source

## How to load it in TurboWarp

1. Open TurboWarp editor.
2. Open **Extensions**.
3. Choose **Custom Extension**.
4. Paste this file URL or host it locally and provide its URL:
   - `iframe-extension.js`
5. Enable unsandboxed execution when prompted.

## Blocks included

- `create iframe url [URL] at x [X] y [Y] width [W] height [H]`
- `set iframe url [URL]`
- `set iframe position x [X] y [Y]`
- `set iframe size width [W] height [H]`
- `show iframe`
- `hide iframe`
- `remove iframe`
- `set iframe target origin [ORIGIN]`
- `send message [MESSAGE] to iframe`
- `when iframe message received`
- `iframe url`
- `iframe target origin`
- `last iframe message`
- `last iframe message origin`
- `iframe is visible?`

## Notes

- Only `http://` and `https://` URLs are allowed.
- Many websites block embedding via `X-Frame-Options` or CSP `frame-ancestors`.
- On stop-all, the extension hides the iframe.
- `iframe target origin` defaults to `auto` (derived from iframe URL origin).

## Messaging flow (launcher ↔ game)

In launcher (TurboWarp), use:

- `set iframe target origin [ORIGIN]` (or keep `auto`)
- `send message [MESSAGE] to iframe`
- `when iframe message received` + `last iframe message`

In the embedded game page, use browser JavaScript:

```js
window.addEventListener('message', (event) => {
   if (event.origin !== 'https://your-launcher-origin.example') return;
   // Handle message from launcher
});

window.parent.postMessage({ type: 'GAME_READY' }, 'https://your-launcher-origin.example');
```

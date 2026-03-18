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
- `iframe url`
- `iframe is visible?`

## Notes

- Only `http://` and `https://` URLs are allowed.
- Many websites block embedding via `X-Frame-Options` or CSP `frame-ancestors`.
- On stop-all, the extension hides the iframe.

# Screenshot Fonts

Use the **Font** menu in the toolbar to change the typeface used on the screenshot canvas and in exported images. It does not change the editor's controls.

## Included choices

- **Editorial Serif** uses Georgia.
- **Modern Sans** uses the device's clean system sans-serif font.
- **Classic Serif** uses Georgia.
- **Avenir Next**, **Helvetica Neue**, **American Typewriter**, **Baskerville**, **Optima**, **Palatino**, and **Futura** use their macOS-native versions when available, with sensible fallbacks elsewhere.
- **Import a font** accepts your WOFF2, WOFF, TTF, or OTF file directly.

## Adding your own font

1. Choose **Import a font** in the toolbar, then select **Import font**.
2. Choose a licensed WOFF2, WOFF, TTF, or OTF file. Its bytes are sniffed server-side (not trusted from its declared type), then it's copied to `public/fonts/imported/<hash>.<extension>` and used immediately in previews and exports.

The selected font is saved in `app-store-screenshots.json` as `fontId`, and the imported font's path/format is saved as `importedFont`.

## Relevant code

- `src/lib/constants.ts` defines the available screenshot fonts.
- `src/components/editor/toolbar.tsx` provides the font selector.
- `src/components/editor/font-importer.tsx` uploads the font file as a JSON+base64 payload (not multipart, to preserve the app's CSRF/origin guard).
- `src/routes/api/upload-font.ts` validates and stores the uploaded font.
- `src/components/editor/slide-canvas.tsx` applies the font (and injects its `@font-face` rule) to previews and exports.

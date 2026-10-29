# Hero frames

The landing page hero is a low-poly three.js classroom, rendered here ahead of
time into WebP frames (`apps/web/public/hero/`) and scroll-scrubbed on a canvas
by `src/site/HeroFrames.tsx`. Pre-rendering means every device gets the same 3D
look at 60fps, even with WebGL or GPU acceleration off.

1. `npm install` here, and copy any Inter `woff2` to `inter.woff2`.
2. Laptop screen texture: run the web dev server, then
   `DEV_URL=http://127.0.0.1:5173/screen.html node screen-shot.cjs`
   (screenshots `src/site/DesktopDemo.tsx` at 2x into `screen.png`).
3. `python3 -m http.server 8765` in this folder.
4. Desktop: `node render.cjs ../public/hero/d 1600 900 0.78 seq 150 24`
   Phone: `node render.cjs ../public/hero/m 720 1400 0.74 seq 120 48`
   (`FROM`/`TO` env vars split a run across processes; each writes a `quads-<from>.json`.
   Merge them into one `quads.json` per folder: it holds the laptop screen corners for
   every frame, which the page uses to lay the live app exactly onto the screen.)

If you change frame counts or sizes, update `DESKTOP` / `MOBILE` in `HeroFrames.tsx`.

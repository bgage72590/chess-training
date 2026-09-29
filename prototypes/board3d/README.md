# 3D board prototype

A look at Tempo on a real 3D board, in the spirit of Apple's Chess: the app's turned-wood Staunton
pieces (from `scripts/pieces/staunton3d.js`) standing on a lacquered board you can orbit, with shadows,
a studio or lamp light, walnut or marble squares, satin or gloss finish, trays for captured pieces and a
computer opponent. It is a standalone page, not part of the app build.

Published copy: https://claude.ai/artifact/BGRdbhBwhjQE4yuev17v27

- `page.html`: the page (controls and styles), with no document skeleton.
- `main.js`: the scene, the pieces, moving and picking, the looks.
- `ai/search.mjs`: the computer, a small alpha-beta search (material and piece-square tables, captures
  followed to the end), iterative deepening within about 0.6 s.
- `pieces-baked.json`: the pieces, built at full detail, simplified with meshoptimizer and quantized
  (the full-detail knight alone is over 500k triangles and takes a minute to build).
- `walnut.webp`, `marble.webp`: square textures.

## Commands

    npx vite -c prototypes/board3d/vite.config.mjs      # dev server on http://localhost:4901
    node prototypes/board3d/build.mjs                    # one-file page in prototypes/board3d/dist/

To bake the pieces again after changing `scripts/pieces/staunton3d.js`: `npm i --no-save meshoptimizer`,
start the dev server, then `node prototypes/board3d/bake.cjs` (opens `bake.html` in Chromium and writes
`pieces-baked.json`; targets per piece are in `TARGET` in `bake.html`).

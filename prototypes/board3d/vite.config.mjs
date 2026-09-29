// Dev server for the 3D board prototype: `npx vite -c prototypes/board3d/vite.config.mjs` (port 4901).
// The page lives in page.html without a document skeleton (claude.ai adds one when it publishes);
// here it is wrapped in one and served at /.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
export const wrap = (body, script) =>
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' +
  body + '\n' + script + '\n</body></html>';

export default {
  root: here,
  server: { port: 4901, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
  plugins: [
    {
      name: 'board3d-page',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== '/' && req.url !== '/index.html') return next();
          const html = wrap(readFileSync(here + 'page.html', 'utf8'), '<script type="module" src="./main.js"></script>');
          res.setHeader('Content-Type', 'text/html');
          res.end(await server.transformIndexHtml(req.url, html));
        });
      },
    },
  ],
};

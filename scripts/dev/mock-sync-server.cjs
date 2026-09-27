// A local stand-in for the sync database functions in docs/sync.sql (same RPC contract),
// for end-to-end tests: node scripts/dev/mock-sync-server.cjs [port]
const http = require('http');
const crypto = require('crypto');
const port = Number(process.argv[2] || 4300);
const slots = new Map();
const id = (code) => crypto.createHash('sha256').update(String(code).toUpperCase()).digest('hex');
const valid = (code) => /^[0-9A-HJKMNP-TV-Z]{20}$/.test(code ?? '');

http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'apikey, authorization, content-type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const fn = req.url.split('/').pop();
      const args = body ? JSON.parse(body) : {};
      const send = (v) => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(v));
      if (fn === 'sync_get') {
        const s = valid(args.code) ? slots.get(id(args.code)) : undefined;
        return send(s ? { data: s.data, version: s.version } : null);
      }
      if (fn === 'sync_put') {
        if (!valid(args.code)) return res.writeHead(400).end('invalid sync code');
        const key = id(args.code);
        const cur = slots.get(key);
        if ((cur?.version ?? 0) !== args.base_version) return send({ ok: false });
        const version = args.base_version + 1;
        slots.set(key, { data: args.data, version });
        return send({ ok: true, version });
      }
      if (fn === 'sync_delete') {
        slots.delete(id(args.code));
        return send(null);
      }
      res.writeHead(404).end();
    });
  })
  .listen(port, () => console.log(`mock sync server on http://localhost:${port}`));

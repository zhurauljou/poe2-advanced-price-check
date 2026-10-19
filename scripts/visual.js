// Window snapshots: a set of demo screens (price, demand, craft, unique, tablet…) is compared with references pixel by pixel — this
// catches layout breakage (runes into columns, a shifted table). No network needed: responses are recorded (--tape, see demo.js).
//   npm run visual -- --record   record network responses and references (first time and after intentional visual changes)
//   npm run visual               take screens and compare; differences — in test/visual/out/*-diff.png
//   npm run visual -- --update   accept the current snapshots as references (after checking by eye)
// Recordings and references are local (test/visual/tape, test/visual/base — not in git): RePoE / poe.ninja recordings weigh megabytes.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'test', 'visual');
const TAPE = path.join(DIR, 'tape');
const BASE = path.join(DIR, 'base');
const OUT = path.join(DIR, 'out');
const record = process.argv.includes('--record');
const update = process.argv.includes('--update');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);

const fx = (f) => path.join(ROOT, 'test', 'fixtures', f);
const tab = (name, extra = '') => `new Promise(r=>setTimeout(r,2000)).then(()=>setTab('${name}')).then(()=>new Promise(r=>setTimeout(r,4000)))${extra}`;
const SCENES = [
  ['price-boots', fx('rare-boots-advanced.txt')],
  ['demand-boots', fx('rare-boots-advanced.txt'), tab('demand')],
  ['craft-wand', fx('craft/wand-open-prefixes.txt'), tab('craft')],
  ['craft-wand-all', fx('craft/wand-open-prefixes.txt'), tab('craft', ".then(()=>{document.querySelector('#craft .more-ways').open=true; document.querySelector('#craft .more-ways').scrollIntoView();})")],
  ['craft-sceptre', fx('craft/sceptre-minion.txt'), tab('craft', ".then(()=>{document.querySelector('#craft .more-ways').open=true; document.querySelector('.craft-foot').scrollIntoView();})")],
  ['craft-magic', fx('magic-helmet.txt'), tab('craft')],
  ['craft-white', fx('normal-boots.txt'), tab('craft')],
  ['unique-mageblood', fx('unique-mageblood.txt')],
  ['unique-craft', fx('unique-mageblood.txt'), tab('craft')],
  ['jewel', fx('rare-jewel-full.txt')],
  ['tablet', fx('tablet-rare.txt')],
  ['ru-armour', fx('ru-rare-armour-advanced.txt')],
].filter(([n]) => !only || n.includes(only));

// PNG → { width, height, data: RGBA } (Electron snapshots: 8-bit, RGBA, non-interlaced).
function readPng(file) {
  const buf = fs.readFileSync(file);
  let pos = 8, width = 0, height = 0, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8);
    const chunk = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(chunk);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = width * bpp, data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? data[y * stride + x - bpp] : 0, b = y ? data[(y - 1) * stride + x] : 0, c = y && x >= bpp ? data[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      data[y * stride + x] = (src[x] + pred) & 255;
    }
  }
  return { width, height, data };
}
// RGBA → PNG (for the diff map).
function writePng(file, { width, height, data }) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, body) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const tb = Buffer.concat([Buffer.from(type), body]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(tb)); return Buffer.concat([len, tb, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// Share of differing pixels (per-channel threshold — font antialiasing) and a diff map: differences in red over grey.
function compare(a, b, diffFile) {
  if (a.width !== b.width || a.height !== b.height) return { size: `${b.width}×${b.height} → ${a.width}×${a.height}` };
  let bad = 0;
  const out = Buffer.alloc(a.data.length);
  for (let i = 0; i < a.data.length; i += 4) {
    const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
    const g = (a.data[i] + a.data[i + 1] + a.data[i + 2]) / 9;
    if (d > 40) { bad++; out[i] = 255; out[i + 1] = 0; out[i + 2] = 0; } else { out[i] = out[i + 1] = out[i + 2] = g; }
    out[i + 3] = 255;
  }
  if (bad) writePng(diffFile, { width: a.width, height: a.height, data: out });
  return { share: bad / (a.width * a.height) };
}

const demoData = path.join(process.env.APPDATA || '', 'PoE 2 Price Checker-demo');
for (const d of [TAPE, BASE, OUT]) fs.mkdirSync(d, { recursive: true });
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
// Screen snapshot: a clean demo profile (references — from the recording, history and settings — from scratch).
function shoot(file, evalJs, shot, rec) {
  // Snapshot goes to a temp file: if it fails, the previous one (the reference) isn't lost. If it fails — one more attempt
  // (Electron sometimes doesn't manage to start while the previous run is closing), the reason — the tail of the output.
  const tmp = `${shot}.tmp.png`;
  let err = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const f of ['data-cache', 'history.json', 'settings.json']) fs.rmSync(path.join(demoData, f), { recursive: true, force: true });
    fs.rmSync(tmp, { force: true });
    const args = ['.', `--demo=${file}`, '--mock-trade', `--tape=${TAPE}`, ...(rec ? ['--record'] : []), `--shot=${tmp}`, ...(evalJs ? [`--eval=${evalJs}`] : [])];
    const r = spawnSync(require('electron'), args, { cwd: ROOT, env, timeout: 150e3, encoding: 'utf8' });
    if (fs.existsSync(tmp)) { fs.renameSync(tmp, shot); return true; }
    err = `${r.error ? r.error.message : ''} ${(r.stderr || '').trim().split(/\r?\n/).slice(-3).join(' | ')}`.trim();
  }
  if (err) console.log(`    ${err.slice(0, 300)}`);
  return false;
}
// Recording: network responses first (a snapshot on the live network isn't fit as a reference — demand may not load in time),
// references after, already from the recording, as during a check.
if (record) {
  fs.rmSync(TAPE, { recursive: true, force: true });
  fs.mkdirSync(TAPE, { recursive: true });
  for (const [name, file, evalJs] of SCENES) console.log(`  ${name}: ${shoot(file, evalJs, path.join(OUT, `${name}.png`), true) ? 'записан' : 'не получился'}`);
}
let failed = 0;
for (const [name, file, evalJs] of SCENES) {
  const shot = path.join(record || update ? BASE : OUT, `${name}.png`);
  if (!shoot(file, evalJs, shot, false)) { console.log(`✖ ${name}: снимок не получился`); failed++; continue; }
  if (record || update) { console.log(`  ${name}: эталон записан`); continue; }
  const base = path.join(BASE, `${name}.png`);
  if (!fs.existsSync(base)) { console.log(`? ${name}: эталона нет — npm run visual -- --update`); continue; }
  const r = compare(readPng(shot), readPng(base), path.join(OUT, `${name}-diff.png`));
  if (r.size) { console.log(`✖ ${name}: размер ${r.size}`); failed++; } else if (r.share > 0.002) { console.log(`✖ ${name}: отличается ${(r.share * 100).toFixed(2)}% пикселей — ${path.join('test', 'visual', 'out', `${name}-diff.png`)}`); failed++; } else console.log(`✓ ${name}`);
}
process.exit(failed ? 1 : 0);

// Packages the built extension (dist/) into release/applypilot-ai-v<version>.zip for the Chrome Web Store.
// - stamps manifest.version from package.json
// - points host_permissions at your production backend (VITE_API_URL) instead of localhost
// - refuses to package if required files are missing or secrets slipped in
// No dependencies: a tiny ZIP writer using Node's built-in zlib.
import { deflateRawSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { loadEnv } from 'vite';

const root = process.cwd();
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const mode = process.env.MODE || 'production';
const env = { ...loadEnv(mode, root, 'VITE_'), ...process.env };

const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

if (!existsSync(dist)) fail('dist/ not found. Run "npm run build" first.');
for (const f of ['manifest.json', 'background.js', 'content.js', 'popup.html', 'index.html', 'icons/icon128.png']) {
  if (!existsSync(join(dist, f))) fail(`dist/${f} is missing. Run "npm run build".`);
}

// ---- manifest -------------------------------------------------------------
const manifestPath = join(dist, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
manifest.version = pkg.version;

const apiUrl = (env.VITE_API_URL || '').trim().replace(/\/+$/, '');
if (apiUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(apiUrl)) {
  let origin;
  try {
    origin = new URL(apiUrl).origin;
  } catch {
    fail(`VITE_API_URL is not a valid URL: ${apiUrl}`);
  }
  if (!origin.startsWith('https://')) fail(`VITE_API_URL must use https:// in production (got ${origin}).`);
  manifest.host_permissions = [`${origin}/*`];
  console.log(`• Backend: ${origin}`);
} else {
  console.warn('• WARNING: VITE_API_URL is not set to a production https URL; the package will talk to http://localhost:8787.');
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// ---- collect files --------------------------------------------------------
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(dist);

const forbidden = files.filter((f) => /(^|[\\/])\.env|\.map$/i.test(f));
if (forbidden.length) fail(`Refusing to package secrets/source maps:\n  ${forbidden.map((f) => relative(root, f)).join('\n  ')}`);
const secretHit = files.find((f) => /\.(js|html|json)$/.test(f) && /gsk_[A-Za-z0-9]{20,}/.test(readFileSync(f, 'utf8')));
if (secretHit) fail(`A Groq API key was found in ${relative(root, secretHit)}. Keys belong on the server only.`);

// ---- zip ------------------------------------------------------------------
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

const locals = [];
const centrals = [];
let offset = 0;
for (const file of files.sort()) {
  const name = Buffer.from(relative(dist, file).split(sep).join('/'));
  const data = readFileSync(file);
  const comp = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  locals.push(local, name, comp);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(dosTime, 12);
  central.writeUInt16LE(dosDate, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, name);

  offset += local.length + name.length + comp.length;
}
const centralSize = centrals.reduce((s, b) => s + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

const outDir = join(root, 'release');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `applypilot-ai-v${pkg.version}.zip`);
const zip = Buffer.concat([...locals, ...centrals, end]);
writeFileSync(out, zip);
console.log(`✔ Packaged ${files.length} files → ${relative(root, out)} (${(zip.length / 1024 / 1024).toFixed(2)} MB)`);

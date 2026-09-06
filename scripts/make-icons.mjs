// Genera le icone PNG dell'app (quadrato blu con la lettera E) senza dipendenze esterne.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

// tabella CRC standard
const TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TABLE[n] = c; }
function crc(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}
// Lettera "E" su griglia 7x9 (1 = bianco)
const E = [
  "1111111", "1111111", "1100000", "1100000", "1111110", "1111110", "1100000", "1100000", "1111111",
];
function pixel(size) {
  const radius = size * 0.2;
  const gx0 = size * 0.28, gy0 = size * 0.22, cw = (size * 0.44) / 7, ch = (size * 0.56) / 9;
  return (x, y) => {
    // angoli arrotondati
    const dx = Math.max(radius - x, 0, x - (size - 1 - radius));
    const dy = Math.max(radius - y, 0, y - (size - 1 - radius));
    if (dx * dx + dy * dy > radius * radius) return [0, 0, 0, 0];
    const cx = Math.floor((x - gx0) / cw), cy = Math.floor((y - gy0) / ch);
    if (cx >= 0 && cx < 7 && cy >= 0 && cy < 9 && E[cy][cx] === "1") return [255, 255, 255, 255];
    return [30, 64, 175, 255]; // #1e40af
  };
}
mkdirSync("public/icons", { recursive: true });
for (const s of [192, 512]) writeFileSync(`public/icons/icon-${s}.png`, png(s, pixel(s)));
console.log("Icone generate in public/icons/");

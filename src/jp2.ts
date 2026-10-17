// Show the Aadhaar photo that comes inside the Aadhaar Secure QR. UIDAI stores it as a raw
// JPEG 2000 codestream, which browsers can't display, so decode it here and hand back a PNG data URL.
// Files are named "<user>/qrphoto_<n>.j2k" by the kyc-aadhaar-qr service.
import { JpxImage } from 'jpeg2000';

// The decoder expects Node's Buffer read helpers; a Uint8Array subclass is enough.
class Bytes extends Uint8Array {
  readUInt16BE(o: number) { return (this[o] << 8) | this[o + 1]; }
  readUInt32BE(o: number) { return ((this[o] << 24) >>> 0) + (this[o + 1] << 16) + (this[o + 2] << 8) + this[o + 3]; }
  readInt8(o: number) { const v = this[o]; return v > 127 ? v - 256 : v; }
}

export const isJ2k = (url?: string | null) => !!url && /\/qrphoto_[^/?]+\.j2k(\?|$)/.test(url);

export async function j2kToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const raw = new Uint8Array(await res.arrayBuffer());
    const bytes = new Bytes(raw.length);
    bytes.set(raw);
    const jpx: any = new JpxImage();
    jpx.parse(bytes);
    const tiles = jpx.tiles ?? [];
    if (!tiles.length) return null;
    const w = jpx.width, h = jpx.height, n = jpx.componentsCount;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(w, h);
    for (const t of tiles) {
      const src = t.items as Uint8ClampedArray;
      for (let y = 0; y < t.height; y++) for (let x = 0; x < t.width; x++) {
        const p = (y * t.width + x) * n, d = ((t.top + y) * w + (t.left + x)) * 4;
        const r = src[p], g = n >= 3 ? src[p + 1] : r, b = n >= 3 ? src[p + 2] : r;
        img.data[d] = r; img.data[d + 1] = g; img.data[d + 2] = b; img.data[d + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Signed URL → something an <img> can show (decodes the QR photo, passes normal photos through). */
export async function displayUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  return isJ2k(url) ? j2kToDataUrl(url) : url;
}

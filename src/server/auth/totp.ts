// Zwei-Faktor-Anmeldung nach RFC 6238 (TOTP, SHA-1, 6 Stellen, 30 s) – nur mit node:crypto, ohne Zusatzpaket.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('Ungültiges Base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newSecret = () => base32Encode(randomBytes(20));

/** Code für einen Zeitschritt (Anzahl 30-s-Abschnitte seit 1970). */
export function totpAt(secret: string, step: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

export const currentStep = (now = Date.now()) => Math.floor(now / 30_000);

/**
 * Prüft einen Code (±1 Zeitschritt Toleranz). Gibt den benutzten Schritt zurück oder null.
 * Schritte bis einschließlich lastStep sind verbraucht (kein zweites Mal mit demselben Code).
 */
export function verifyTotp(secret: string, code: string, lastStep = 0, now = Date.now()): number | null {
  const c = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const s0 = currentStep(now);
  for (const step of [s0, s0 - 1, s0 + 1]) {
    if (step <= lastStep) continue;
    const a = Buffer.from(totpAt(secret, step));
    if (timingSafeEqual(a, Buffer.from(c))) return step;
  }
  return null;
}

export const otpauthUrl = (secret: string, account: string, issuer = 'Pitstop') =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

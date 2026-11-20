// API-Test für 0.5 (Zwei-Faktor, Discord-Anmeldung mit Attrappe, Fotos, Spielserver-API) gegen einen Pitstop im Demo-Modus.
//   node tests/api/anbindungen.mjs [http://localhost:3100]
// Der Server muss mit DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET und DISCORD_API=http://localhost:3199/api laufen;
// die Discord-Attrappe startet dieses Skript selbst auf Port 3199. ADMIN_PASSWORD = Startpasswort des Admins.
import { createHmac } from 'node:crypto';
import http from 'node:http';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const ADMIN_PW = process.env.ADMIN_PASSWORD ?? 'admin-passwort-123';
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails++; };

// --- kleine Helfer ---------------------------------------------------------------
const jar = () => {
  let cookie = '';
  const call = async (method, path, body, extra = {}) => {
    const res = await fetch(`${BASE}/api${path}`, {
      method, redirect: 'manual',
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}), ...extra },
      body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const ct = res.headers.get('content-type') ?? '';
    const data = ct.includes('json') ? await res.json() : ct.startsWith('image/') ? new Uint8Array(await res.arrayBuffer()) : await res.text();
    return { status: res.status, data, location: res.headers.get('location') ?? '' };
  };
  return { call, c: (cid) => (m, p, b, e) => call(m, `/c/${cid}${p}`, b, e) };
};
async function demo(persona) {
  const j = jar();
  await j.call('POST', '/demo/login', { persona });
  const me = (await j.call('GET', '/me')).data;
  return { ...j, me, cid: me.companies[0]?.id, co: j.c(me.companies[0]?.id) };
}
const b32 = (s) => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, v = 0; const out = []; for (const ch of s) { v = (v << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret, offset = 0) => { const step = Math.floor(Date.now() / 30000) + offset; const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(step)); const h = createHmac('sha1', b32(secret)).update(m).digest(); const o = h[19] & 15; return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0'); };

// --- Discord-Attrappe --------------------------------------------------------------
let discordUser = { id: '987654321012345678', username: 'derrik_w' };
const mock = http.createServer((req, res) => {
  if (req.url === '/api/oauth2/token' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const p = new URLSearchParams(body);
      const good = p.get('client_secret') === 'attrappe' && p.get('code') === 'gueltig';
      res.writeHead(good ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(good ? { access_token: 'tok', token_type: 'Bearer' } : { error: 'invalid_grant' }));
    });
    return;
  }
  if (req.url === '/api/users/@me') {
    res.writeHead(req.headers.authorization === 'Bearer tok' ? 200 : 401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(discordUser));
    return;
  }
  res.writeHead(404).end();
});
await new Promise((r) => mock.listen(3199, r));

try {
  // Frischer Demo-Stand (legt auch den Admin mit Startpasswort neu an)
  await (await demo('inhaber')).call('POST', '/demo/reset');
  const chef = await demo('inhaber');
  const mech = await demo('mechanik');
  const office = await demo('buero');

  // --- Zwei-Faktor ------------------------------------------------------------------
  const adm = jar();
  ok((await adm.call('POST', '/auth/login', { email: 'admin@demo.pitstop', password: ADMIN_PW })).status === 200, 'Admin-Anmeldung');
  await adm.call('POST', '/auth/password', { currentPassword: ADMIN_PW, newPassword: 'admin-zweifaktor-789' });
  const su = await adm.call('POST', '/me/totp/setup');
  ok(su.status === 200 && /^[A-Z2-7]{32}$/.test(su.data.secret) && su.data.url.startsWith('otpauth://totp/'), 'Zwei-Faktor einrichten: Schlüssel und otpauth-Link');
  ok((await adm.call('POST', '/me/totp/enable', { code: '000000' })).status === 400, 'Falscher Code beim Einschalten → 400');
  ok((await adm.call('POST', '/me/totp/enable', { code: totp(su.data.secret) })).status === 200, 'Richtiger Code schaltet ein');
  ok((await adm.call('GET', '/me')).data.user.totpEnabled === true, 'Konto zeigt totpEnabled');
  const l1 = await jar().call('POST', '/auth/login', { email: 'admin@demo.pitstop', password: 'admin-zweifaktor-789' });
  ok(l1.status === 401 && l1.data.error.code === 'TOTP_REQUIRED', 'Anmeldung ohne Code → TOTP_REQUIRED');
  ok((await jar().call('POST', '/auth/login', { email: 'admin@demo.pitstop', password: 'admin-zweifaktor-789', code: '123456' })).status === 401, 'Falscher Code → 401');
  // Neuer Zeitschritt nötig (der Code beim Einschalten ist verbraucht): nächster Schritt wird mit Toleranz akzeptiert
  const c2 = totp(su.data.secret, 1);
  const adm2 = jar();
  ok((await adm2.call('POST', '/auth/login', { email: 'admin@demo.pitstop', password: 'admin-zweifaktor-789', code: c2 })).status === 200, 'Anmeldung mit Code → 200');
  ok((await jar().call('POST', '/auth/login', { email: 'admin@demo.pitstop', password: 'admin-zweifaktor-789', code: c2 })).status === 401, 'Derselbe Code zweimal → 401 (kein Wiederverwenden)');
  ok((await adm2.call('GET', '/server/accounts')).data.accounts.find((a) => a.email === 'admin@demo.pitstop').totpEnabled, 'Konten-Liste zeigt 2FA');
  ok((await adm2.call('POST', '/me/totp/disable', { password: 'falsch', code: totp(su.data.secret, 1) })).status === 400, 'Ausschalten mit falschem Passwort → 400');

  // --- Discord ----------------------------------------------------------------------
  const legal = (await jar().call('GET', '/public/legal')).data;
  ok(legal.discordLogin === true, 'Anmeldeseite kennt Discord');
  const st = await chef.call('GET', '/auth/discord/start?mode=link');
  const state = new URL(st.location).searchParams.get('state');
  ok(st.status === 302 && st.location.startsWith('http://localhost:3199/api/oauth2/authorize') && state, 'Verknüpfen leitet zu Discord weiter (mit state)');
  ok((await chef.call('GET', `/auth/discord/callback?code=gueltig&state=falsch`)).location.includes('discord=ungueltig'), 'Falscher state → abgelehnt');
  const cb = await chef.call('GET', `/auth/discord/callback?code=gueltig&state=${state}`);
  ok(cb.location.includes('discord=verknuepft'), 'Discord verknüpft');
  ok((await chef.call('GET', '/me')).data.user.discordLinked, 'Konto zeigt Discord verknüpft');
  ok((await chef.call('GET', `/auth/discord/callback?code=gueltig&state=${state}`)).location.includes('discord=ungueltig'), 'state ist nur einmal gültig');
  // Anmelden mit Discord (ohne Sitzung)
  const anon = jar();
  const s2 = await anon.call('GET', '/auth/discord/start?mode=login');
  const cb2 = await anon.call('GET', `/auth/discord/callback?code=gueltig&state=${new URL(s2.location).searchParams.get('state')}`);
  ok(cb2.status === 302 && cb2.location === '/', 'Anmeldung mit Discord → Weiterleitung in die App');
  ok((await anon.call('GET', '/me')).data.user?.email === chef.me.user.email, 'Mit Discord als Inhaber angemeldet');
  discordUser = { id: '111111111111111111', username: 'fremd' };
  const anon2 = jar();
  const s3 = await anon2.call('GET', '/auth/discord/start?mode=login');
  ok((await anon2.call('GET', `/auth/discord/callback?code=gueltig&state=${new URL(s3.location).searchParams.get('state')}`)).location.includes('discord=unbekannt'), 'Unverknüpftes Discord-Konto → kein Zugang, kein neues Konto');
  const s4 = await anon2.call('GET', '/auth/discord/start?mode=login');
  ok((await anon2.call('GET', `/auth/discord/callback?code=kaputt&state=${new URL(s4.location).searchParams.get('state')}`)).location.includes('discord=fehler'), 'Discord lehnt Code ab → Fehlermeldung');
  ok((await jar().call('GET', '/auth/discord/start?mode=link')).status === 401, 'Verknüpfen ohne Anmeldung → 401');
  ok((await chef.call('POST', '/me/discord/unlink', {})).status === 200 && !(await chef.call('GET', '/me')).data.user.discordLinked, 'Discord trennen');

  // --- Fotos ------------------------------------------------------------------------
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  const B = (await chef.co('GET', '/bootstrap')).data;
  const mine = (await mech.co('GET', '/bootstrap')).data.orders.find((o) => o.assigneeId === mech.me.user.id);
  const up = await mech.co('PUT', `/orders/${mine.id}/photos`, png, { 'Content-Type': 'image/png' });
  ok(up.status === 200 && up.data.id, 'Mechanik lädt Foto zum eigenen Auftrag hoch');
  ok((await mech.co('PUT', `/orders/${mine.id}/photos`, Uint8Array.from([1, 2, 3]), { 'Content-Type': 'text/plain' })).status >= 400, 'Kein Bild → abgelehnt');
  const img = await chef.co('GET', `/photos/${up.data.id}`);
  ok(img.status === 200 && img.data.length === png.length, 'Inhaber sieht das Foto');
  const tow = await demo('abschlepp');
  ok((await tow.co('GET', `/photos/${up.data.id}`)).status === 403, 'Abschlepp ohne Auftragstafel → 403');
  ok((await chef.co('GET', '/bootstrap')).data.photos.some((p) => p.id === up.data.id), 'Foto im Bootstrap');
  ok((await mech.co('DELETE', `/photos/${up.data.id}`)).status === 200 && (await chef.co('GET', `/photos/${up.data.id}`)).status === 404, 'Eigenes Foto löschen');

  // --- Spielserver ------------------------------------------------------------------
  ok((await mech.co('POST', '/game-keys', { name: 'x' })).status === 403, 'Mechanik: Spielserver-Schlüssel → 403');
  const gk = await chef.co('POST', '/game-keys', { name: 'FiveM Test' });
  ok(gk.status === 200 && gk.data.key.startsWith('pg_'), 'Spielserver-Schlüssel erstellt');
  const game = (m, p, body) => fetch(`${BASE}/api/game${p}`, { method: m, headers: { Authorization: `Bearer ${gk.data.key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, data: await r.json() }));
  ok((await fetch(`${BASE}/api/game/status`)).status === 401, 'Ohne Schlüssel → 401');
  const st0 = await game('GET', '/status');
  ok(st0.status === 200 && st0.data.company === 'Demo Motorsport', 'Status: Firma erkannt');
  ok((await chef.co('PATCH', `/members/${mech.me.user.id}`, { gameId: 'license:abc123' })).status === 200, 'Spiel-ID beim Mitglied eingetragen');
  ok((await game('POST', '/duty', { player: 'license:unbekannt' })).status === 404, 'Unbekannte Spiel-ID → 404');
  const wasOn = (await chef.co('GET', '/bootstrap')).data.members.find((m) => m.userId === mech.me.user.id).onDutySince !== null;
  const d1 = await game('POST', '/duty', { player: 'license:abc123', on: !wasOn });
  ok(d1.status === 200 && d1.data.changed && d1.data.onDuty === !wasOn, 'Dienst aus dem Spiel umgeschaltet');
  const d2 = await game('POST', '/duty', { player: 'license:abc123' });
  ok(d2.data.onDuty === wasOn, 'Ohne „on“ wird umgeschaltet');
  const nr = await game('POST', '/callouts', { location: 'Grove Street, Unfall', x: 100, y: -1800, requester: 'Spieler 12' });
  ok(nr.status === 200 && nr.data.label.startsWith('E-'), `Notruf → Einsatz ${nr.data.label}`);
  ok((await chef.co('GET', '/bootstrap')).data.callouts.some((c) => c.id === nr.data.id && c.status === 'offen'), 'Einsatz ist in der Leitstelle');
  const open = B.bills.find((x) => x.status === 'offen' && x.kind === 'rechnung');
  ok((await game('POST', '/payments', { bill: `R-${open.number}`, amountCents: open.amountCents - 1 })).status === 400, 'Zahlung mit falschem Betrag → 400');
  ok((await game('POST', '/payments', { bill: open.number, amountCents: open.amountCents, account: 'kasse', payer: 'Lamar' })).status === 200, 'Zahlung aus dem Spiel');
  ok((await game('POST', '/payments', { bill: open.number, amountCents: open.amountCents })).status === 409, 'Doppelte Zahlung → 409');
  ok((await chef.co('GET', '/bootstrap')).data.bills.find((x) => x.id === open.id).status === 'bezahlt', 'Rechnung ist bezahlt');
  const bal = await game('GET', '/balance');
  ok(bal.status === 200 && Number.isInteger(bal.data.firma), 'Kontostand');
  const lap = await game('POST', '/laps', { track: 'Stadtkurs Vinewood', driver: 'Jamal Carter', car: '7', s1: 40900, s2: 46500, s3: 42800, session: 'Rennen' });
  ok(lap.status === 200 && lap.data.lapMs === 130200, 'Rundenzeit aus dem Spiel');
  const v = await game('GET', '/vehicles/LSPD%2012');
  ok(v.status === 200 && v.data.known && v.data.owner === 'LSPD Fuhrpark', 'Kennzeichen abfragen');
  ok((await game('POST', '/vehicles/ZZ%20999/stolen', { stolen: true, by: 'LSPD' })).status === 200, 'Fahndung für unbekanntes Kennzeichen');
  ok((await mech.co('POST', '/intake', { plate: 'ZZ 999', title: 'x' })).status === 409, 'Annahme warnt bei Fahndung aus dem Spiel');
  const rv = await chef.co('POST', `/game-keys/${(await chef.co('GET', '/game-keys')).data.keys[0].id}/revoke`);
  ok(rv.status === 200 && (await game('GET', '/status')).status === 401, 'Widerrufener Schlüssel → 401');
  void office;
} finally {
  mock.close();
}
console.log(fails ? `\n${fails} Fehler` : '\nAlles grün');
process.exit(fails ? 1 : 0);

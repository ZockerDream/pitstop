// Tuning-Preisliste (Mockup „Pakete & Preise“): Teile mit Stufen, Fahrzeugklassen mit Faktor, Pakete mit Rabatt.
// Jede Firma kann die Liste ändern (companies.tuning); leer = diese Vorgabe. Server und Konfigurator rechnen gleich.

export interface TuningPart {
  key: string;
  name: string;
  /** Stufen, Index 0 = Serie/ohne */
  levels: string[];
  /** Preis je Stufe in ganzen Dollar */
  prices: number[];
}
export interface TuningPackage {
  name: string;
  /** Rabatt in Prozent */
  discount: number;
  items: Record<string, number>;
  note: string;
}
export interface TuningConfig {
  parts: TuningPart[];
  classes: Record<string, number>;
  packages: TuningPackage[];
}

export const DEFAULT_TUNING: TuningConfig = {
  parts: [
    { key: 'motor', name: 'Motor', levels: ['Serie', 'Stufe 1', 'Stufe 2', 'Stufe 3', 'Stufe 4'], prices: [0, 1800, 3600, 6200, 9500] },
    { key: 'turbo', name: 'Turbo', levels: ['Ohne', 'Turbo'], prices: [0, 7500] },
    { key: 'getriebe', name: 'Getriebe', levels: ['Serie', 'Straße', 'Sport', 'Renn'], prices: [0, 1400, 2800, 4600] },
    { key: 'bremsen', name: 'Bremsen', levels: ['Serie', 'Straße', 'Sport', 'Renn'], prices: [0, 900, 1900, 3400] },
    { key: 'fahrwerk', name: 'Fahrwerk', levels: ['Serie', 'Tiefer', 'Straße', 'Sport', 'Renn'], prices: [0, 600, 1300, 2200, 3600] },
    { key: 'panzerung', name: 'Panzerung', levels: ['Ohne', '20 %', '40 %', '60 %', '80 %', '100 %'], prices: [0, 2500, 5000, 8500, 12500, 18000] },
    { key: 'reifen', name: 'Reifen', levels: ['Serie', 'Sport', 'Kugelsicher', 'Drift'], prices: [0, 1100, 2400, 1600] },
    { key: 'optik', name: 'Optik', levels: ['Keine', 'Lack', 'Folie', 'Folie + Neon'], prices: [0, 1200, 4800, 6200] },
  ],
  classes: { Kompakt: 0.8, Limousine: 1, SUV: 1.1, Sport: 1.25, Super: 1.6, Motorrad: 0.7 },
  packages: [
    { name: 'Street', discount: 10, items: { motor: 1, bremsen: 1, fahrwerk: 2, reifen: 1 }, note: 'Alltag mit mehr Biss' },
    { name: 'Track', discount: 12, items: { motor: 3, turbo: 1, getriebe: 2, bremsen: 2, fahrwerk: 3 }, note: 'Rennstrecke, voller Turbo' },
    { name: 'Drift', discount: 10, items: { motor: 2, getriebe: 2, fahrwerk: 3, reifen: 3 }, note: 'Für Meets und Drift-Events' },
    { name: 'Behörde', discount: 15, items: { motor: 2, bremsen: 2, panzerung: 2, reifen: 2 }, note: 'Nur LSPD und EMS' },
  ],
};

export const tuningOf = (raw: Partial<TuningConfig> | null | undefined): TuningConfig =>
  raw && Array.isArray(raw.parts) && raw.parts.length ? { ...DEFAULT_TUNING, ...raw } as TuningConfig : DEFAULT_TUNING;

export interface TuningQuote {
  lines: { part: string; level: string; usd: number }[];
  subtotalUsd: number;
  factor: number;
  discount: number;
  totalCents: number;
}

/** Preis eines Umbaus: Summe der Stufen × Klassenfaktor, minus Paket- oder Kundenrabatt (der größere zählt). */
export function quoteTuning(cfg: TuningConfig, cls: string, sel: Record<string, number>, discount = 0): TuningQuote {
  const lines: TuningQuote['lines'] = [];
  for (const p of cfg.parts) {
    const i = Math.max(0, Math.min(p.levels.length - 1, Math.floor(sel[p.key] ?? 0)));
    if (i > 0) lines.push({ part: p.name, level: p.levels[i], usd: p.prices[i] ?? 0 });
  }
  const subtotalUsd = lines.reduce((a, l) => a + l.usd, 0);
  const factor = cfg.classes[cls] ?? 1;
  const d = Math.max(0, Math.min(100, discount));
  const totalCents = Math.round(subtotalUsd * factor * (100 - d)) ;
  return { lines, subtotalUsd, factor, discount: d, totalCents };
}

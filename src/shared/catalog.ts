import type { Unit } from './types';

/** Positionsvorlagen für neue Rechnungen (Vorlagen-Dropdown) – typische Werkstatt- und Tuningleistungen. */
export interface PositionTemplate {
  key: string;
  label: string;
  description: string;
  unit: Unit;
  unitPriceCents: number;
}

export const POSITION_TEMPLATES: PositionTemplate[] = [
  { key: 'labor', label: 'Arbeitszeit Kfz-Mechatroniker', description: 'Arbeitszeit Kfz-Mechatroniker', unit: 'hours', unitPriceCents: 11200 },
  { key: 'labor-master', label: 'Arbeitszeit Kfz-Meister', description: 'Arbeitszeit Kfz-Meister', unit: 'hours', unitPriceCents: 12800 },
  { key: 'diagnosis', label: 'Fehlerdiagnose', description: 'Fehlerdiagnose mit Systemtester', unit: 'flat', unitPriceCents: 8900 },
  { key: 'inspection', label: 'Inspektion', description: 'Inspektion nach Herstellervorgabe', unit: 'flat', unitPriceCents: 22900 },
  { key: 'oil', label: 'Motoröl 5W-30', description: 'Motoröl 5W-30 Longlife', unit: 'liter', unitPriceCents: 1690 },
  { key: 'oilfilter', label: 'Ölfilter', description: 'Ölfilter', unit: 'piece', unitPriceCents: 1490 },
  { key: 'tires', label: 'Räderwechsel', description: 'Räderwechsel inkl. Wuchten', unit: 'flat', unitPriceCents: 5900 },
  { key: 'storage', label: 'Reifeneinlagerung', description: 'Reifeneinlagerung (eine Saison)', unit: 'flat', unitPriceCents: 4900 },
  { key: 'hu', label: 'HU/AU-Vorbereitung', description: 'HU/AU-Vorbereitung und Vorführung', unit: 'flat', unitPriceCents: 15900 },
  { key: 'ac', label: 'Klimaservice', description: 'Klimaservice inkl. Desinfektion', unit: 'flat', unitPriceCents: 12900 },
  { key: 'alignment', label: 'Achsvermessung', description: 'Achsvermessung und Spureinstellung', unit: 'flat', unitPriceCents: 11900 },
  { key: 'dyno', label: 'Leistungsmessung Prüfstand', description: 'Leistungsmessung auf dem Prüfstand', unit: 'flat', unitPriceCents: 19900 },
  { key: 'stage1', label: 'Softwareoptimierung Stage 1', description: 'Softwareoptimierung Stage 1 inkl. Prüfstandslauf', unit: 'flat', unitPriceCents: 99000 },
  { key: 'registration', label: 'Eintragung vorbereiten', description: 'Teilegutachten prüfen und Eintragung vorbereiten', unit: 'flat', unitPriceCents: 14900 },
  { key: 'disposal', label: 'Altöl- und Altteileentsorgung', description: 'Altöl- und Altteileentsorgung', unit: 'flat', unitPriceCents: 850 },
];

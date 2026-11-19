import { Plus, Trash2 } from 'lucide-react';
import { POSITION_TEMPLATES } from '../../../shared/catalog';
import { formatEuro } from '../../../shared/format';
import { unitLabel } from '../../../shared/labels';
import { centsToInput, lineTotal, parseDecimalInput, parseEuroInput } from '../../../shared/money';
import { UNITS, type Unit } from '../../../shared/types';
import { cx } from '../../lib/cx';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Field';

/** Eine Zeile im Editor; Mengen und Preise als Text (deutsche Schreibweise mit Komma). */
export interface ItemDraft {
  key: string;
  description: string;
  quantity: string;
  unit: Unit;
  price: string;
}

let counter = 0;
export function newItem(partial: Partial<ItemDraft> = {}): ItemDraft {
  counter += 1;
  return { key: `item-${Date.now()}-${counter}`, description: '', quantity: '1', unit: 'hours', price: '', ...partial };
}

export interface ParsedItem {
  description: string;
  quantity: number | null;
  unit: Unit;
  unitPriceCents: number | null;
}

export function parseItem(d: ItemDraft): ParsedItem {
  return { description: d.description.trim(), quantity: parseDecimalInput(d.quantity), unit: d.unit, unitPriceCents: parseEuroInput(d.price) };
}

export function itemErrors(p: ParsedItem): { description?: string; quantity?: string; price?: string } {
  return {
    description: p.description ? undefined : 'Beschreibung fehlt',
    quantity: p.quantity === null ? 'Menge ungültig' : p.quantity <= 0 ? 'Menge > 0' : undefined,
    price: p.unitPriceCents === null ? 'Preis ungültig' : p.unitPriceCents < 0 ? 'Preis ≥ 0' : undefined,
  };
}

export function LineItemsEditor({
  items,
  onChange,
  showErrors,
  serverErrors,
}: {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  showErrors: boolean;
  serverErrors: Record<string, string>;
}) {
  const update = (key: string, patch: Partial<ItemDraft>) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const addTemplate = (templateKey: string) => {
    const t = POSITION_TEMPLATES.find((p) => p.key === templateKey);
    if (!t) return;
    const empty = items.length === 1 && !items[0].description && !items[0].price;
    const item = newItem({ description: t.description, unit: t.unit, quantity: '1', price: centsToInput(t.unitPriceCents) });
    onChange(empty ? [item] : [...items, item]);
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-zinc-50">
            <tr className="text-left text-xs font-medium text-zinc-500">
              <th className="w-8 px-3 py-2">#</th>
              <th className="px-2 py-2">Beschreibung</th>
              <th className="w-24 px-2 py-2">Menge</th>
              <th className="w-32 px-2 py-2">Einheit</th>
              <th className="w-32 px-2 py-2">Einzelpreis netto</th>
              <th className="w-28 px-3 py-2 text-right">Summe</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((d, index) => {
              const p = parseItem(d);
              const errs = showErrors ? itemErrors(p) : {};
              const sErr = (field: string) => serverErrors[`items.${index}.${field}`];
              const total = p.quantity !== null && p.unitPriceCents !== null ? lineTotal({ quantity: p.quantity, unitPriceCents: p.unitPriceCents }) : null;
              return (
                <tr key={d.key} className="border-t border-zinc-100 align-top">
                  <td className="px-3 py-2.5 text-xs text-zinc-400 tabular-nums">{index + 1}</td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={d.description}
                      onChange={(e) => update(d.key, { description: e.target.value })}
                      invalid={Boolean(errs.description || sErr('description'))}
                      placeholder="Leistung oder Material"
                      aria-label={`Beschreibung Position ${index + 1}`}
                      maxLength={300}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={d.quantity}
                      onChange={(e) => update(d.key, { quantity: e.target.value })}
                      invalid={Boolean(errs.quantity || sErr('quantity'))}
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      aria-label={`Menge Position ${index + 1}`}
                      title={errs.quantity ?? sErr('quantity')}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Select value={d.unit} onChange={(e) => update(d.key, { unit: e.target.value as Unit })} aria-label={`Einheit Position ${index + 1}`}>
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {unitLabel[u]}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <Input
                        value={d.price}
                        onChange={(e) => update(d.key, { price: e.target.value })}
                        invalid={Boolean(errs.price || sErr('unitPriceCents'))}
                        inputMode="decimal"
                        placeholder="0,00"
                        className="pr-7 text-right tabular-nums"
                        aria-label={`Einzelpreis Position ${index + 1}`}
                        title={errs.price ?? sErr('unitPriceCents')}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-zinc-400">€</span>
                    </div>
                  </td>
                  <td className={cx('px-3 py-2.5 text-right whitespace-nowrap tabular-nums', total === null ? 'text-zinc-400' : 'text-zinc-900')}>
                    {total === null ? '–' : formatEuro(total)}
                  </td>
                  <td className="py-1.5 pr-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      disabled={items.length === 1}
                      onClick={() => onChange(items.filter((i) => i.key !== d.key))}
                      aria-label={`Position ${index + 1} entfernen`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" icon={Plus} onClick={() => onChange([...items, newItem()])}>
          Position hinzufügen
        </Button>
        <Select
          value=""
          onChange={(e) => {
            addTemplate(e.target.value);
            e.target.value = '';
          }}
          className="h-8 w-auto text-[13px]"
          aria-label="Vorlage einfügen"
        >
          <option value="">Vorlage einfügen …</option>
          {POSITION_TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label} ({formatEuro(t.unitPriceCents)} / {unitLabel[t.unit]})
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

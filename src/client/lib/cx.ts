/** Klassen zusammenfügen, falsy-Werte auslassen. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

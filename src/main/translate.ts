export type Table = Record<string, string>;

// The base language, "pt" from "pt-BR", when the app has it; otherwise null.
export const supportedLanguage = (code: unknown, tables: Record<string, Table>): string | null => {
  if (typeof code !== "string") return null;
  const base = code.toLowerCase().split(/[-_]/)[0];
  return Object.prototype.hasOwnProperty.call(tables, base) ? base : null;
};

// Looks the key up in the language's table, then in the fallback table, and
// fills in {{name}} placeholders.
export const translate = (
  tables: Record<string, Table>,
  language: string,
  fallback: string,
  key: string,
  vars: Record<string, string> = {}
): string => {
  const text = tables[language]?.[key] ?? tables[fallback]?.[key] ?? key;
  return text.replace(/\{\{(\w+)\}\}/g, (match, name) => vars[name] ?? match);
};

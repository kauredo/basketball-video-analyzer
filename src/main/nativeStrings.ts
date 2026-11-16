import en from "../i18n/locales/en.json";
import pt from "../i18n/locales/pt.json";
import es from "../i18n/locales/es.json";
import fr from "../i18n/locales/fr.json";
import de from "../i18n/locales/de.json";
import it from "../i18n/locales/it.json";
import sl from "../i18n/locales/sl.json";
import sr from "../i18n/locales/sr.json";
import lt from "../i18n/locales/lt.json";
import tr from "../i18n/locales/tr.json";
import el from "../i18n/locales/el.json";
import { supportedLanguage, translate, Table } from "./translate";

// Menus and dialogs are drawn by the main process, which cannot reach the
// renderer's i18next. The renderer reports its language over IPC.
const TABLES: Record<string, Table> = Object.fromEntries(
  Object.entries({ en, pt, es, fr, de, it, sl, sr, lt, tr, el }).map(
    ([code, file]) => [code, file.app.native]
  )
);

type Key = keyof typeof en.app.native;

let language = "en";

export const setNativeLanguage = (code: unknown): boolean => {
  const supported = supportedLanguage(code, TABLES);
  if (!supported) return false;
  language = supported;
  return true;
};

export const nt = (key: Key, vars?: Record<string, string>): string =>
  translate(TABLES, language, "en", key, vars);

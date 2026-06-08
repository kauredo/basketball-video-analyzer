import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import pt from "./locales/pt.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import it from "./locales/it.json";
import sl from "./locales/sl.json";
import sr from "./locales/sr.json";
import lt from "./locales/lt.json";
import tr from "./locales/tr.json";
import el from "./locales/el.json";

// Single source of truth for supported languages. Both the i18next `resources`
// and the LanguageSelector dropdown derive from this, so adding a locale is a
// one-line change here.
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", translation: en },
  { code: "pt", name: "Português (Portugal)", translation: pt },
  { code: "es", name: "Español", translation: es },
  { code: "fr", name: "Français", translation: fr },
  { code: "de", name: "Deutsch", translation: de },
  { code: "it", name: "Italiano", translation: it },
  { code: "sl", name: "Slovenščina", translation: sl },
  { code: "sr", name: "Srpski", translation: sr },
  { code: "lt", name: "Lietuvių", translation: lt },
  { code: "tr", name: "Türkçe", translation: tr },
  { code: "el", name: "Ελληνικά", translation: el },
] as const;

const resources = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((lang) => [lang.code, { translation: lang.translation }]),
);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "pt",
    load: "languageOnly",
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;

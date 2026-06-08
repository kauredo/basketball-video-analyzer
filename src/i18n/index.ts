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

const resources = {
  en: {
    translation: en,
  },
  pt: {
    translation: pt,
  },
  es: {
    translation: es,
  },
  fr: {
    translation: fr,
  },
  de: {
    translation: de,
  },
  it: {
    translation: it,
  },
  sl: {
    translation: sl,
  },
  sr: {
    translation: sr,
  },
  lt: {
    translation: lt,
  },
  tr: {
    translation: tr,
  },
  el: {
    translation: el,
  },
};

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

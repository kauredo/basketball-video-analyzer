import { test } from "node:test";
import assert from "node:assert/strict";
import { supportedLanguage, translate } from "./translate.ts";

const tables = {
  en: { ok: "OK", ready: "Version {{version}} is ready." },
  pt: { ready: "A versão {{version}} está pronta." },
};

test("supportedLanguage takes the base language", () => {
  assert.equal(supportedLanguage("pt-BR", tables), "pt");
  assert.equal(supportedLanguage("EN_us", tables), "en");
});

test("supportedLanguage refuses unknown codes and non-strings", () => {
  assert.equal(supportedLanguage("ja", tables), null);
  assert.equal(supportedLanguage("constructor", tables), null);
  assert.equal(supportedLanguage(42, tables), null);
});

test("translate fills placeholders in the chosen language", () => {
  assert.equal(translate(tables, "pt", "en", "ready", { version: "1.14.0" }), "A versão 1.14.0 está pronta.");
});

test("translate falls back to the fallback language, then the key", () => {
  assert.equal(translate(tables, "pt", "en", "ok"), "OK");
  assert.equal(translate(tables, "pt", "en", "missing"), "missing");
});

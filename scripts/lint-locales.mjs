#!/usr/bin/env node
/**
 * Structural checks on the eleven locale files.
 *
 * This exists because no native speaker will ever read the ten translations.
 * Every check here found a real bug on 2026-09-08, and every one of them works
 * without knowing a word of the language:
 *
 *   - nine locales had no app.startup block, so a failed launch spoke English
 *   - the onboarding named I and O when the keys are Z and M, in all eleven
 *   - pt and tr translated the product name, which overflowed the header
 *   - stripping "!" merged two sentences in nine locales
 *   - pt spoke two registers, voce in 26 strings and tu in 2
 *
 * Run with `npm run lint:locales`. Exit code 1 on any error.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const DIR = new URL("../src/i18n/locales/", import.meta.url).pathname;
const BASE = "en";

/** Strings that are meant to be identical across every locale. */
const DO_NOT_TRANSLATE = {
  "app.title": "Basketball Video Analyzer",
};

/**
 * Register markers per language: [informal, formal]. A file should be
 * consistently one or the other. Only languages with a clear T-V distinction
 * we can pattern-match are listed; the rest skip this check.
 */
const REGISTER = {
  pt: [/\b(o teu|a tua|os teus|as tuas|Seleciona|Introduz|Marca|Guarda|Clica|Prime|Tenta)\b/g,
       /\b(o seu|a sua|os seus|as suas|Selecione|Introduza|Marque|Guarde|Clique|Prima|Tente)\b/g],
  // Spanish su/sus is deliberately absent: it means both "your (formal)" and
  // "its", so "cargar su estructura" is about the preset, not the reader.
  es: [/\b(tú|Selecciona|Pulsa|Guarda|Carga|Elige)\b/g, /\b(usted|Seleccione|Pulse|Guarde|Cargue|Elija)\b/g],
  fr: [/\b(ton |ta |tes |Sélectionne|Appuie)\b/g, /\b(vous|votre|vos|Sélectionnez|Appuyez)\b/g],
  it: [/\b(tuo|tua|tuoi|tue|Seleziona|Premi)\b/g, /\b(suo|sua|vostro|Selezioni|Prema)\b/g],
  de: [/\b(dein|deine|deinen|deinem|Wähle|Drücke)\b/g, /\b(Ihr|Ihre|Ihren|Ihrem|Wählen Sie|Drücken Sie)\b/g],
};

const flat = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    k.startsWith("_") ? []
      : typeof v === "object" && v !== null ? flat(v, `${prefix}${k}.`)
      : typeof v === "string" ? [[`${prefix}${k}`, v]]
      : []);

/** A label like "Show Bottom Panel": most words capitalised, no sentence. */
const TITLE_CASE = /^(?:[A-ZÀ-ÞΑ-Ω0-9][^\s]*)(?:\s+(?:[A-ZÀ-ÞΑ-Ω0-9&/-][^\s]*|de|do|da|the|of|and|in|to|a|e|y|et|und|ve|na|za|v|i))*$/;
/** Names that keep their capital mid-sentence in every language. */
const PROPER_NOUN = /\b(YouTube|GitHub|Basketball Video Analyzer|Sportscode|Google Drive|Documents|MP4|MOV|AVI|MKV|WebM|WMV|FLV|M4V|CSV|JSON|XML|GB|Esc|Alt|Cmd|Ctrl|Shift)\b/;

const placeholders = s => [...s.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).sort().join(",");

const files = readdirSync(DIR).filter(f => f.endsWith(".json")).sort();
const parsed = Object.fromEntries(files.map(f =>
  [basename(f, ".json"), Object.fromEntries(flat(JSON.parse(readFileSync(join(DIR, f), "utf8"))))]));
const base = parsed[BASE];
if (!base) { console.error(`no ${BASE}.json`); process.exit(1); }

const errors = [];
const fail = (loc, key, msg) => errors.push(`${loc}  ${key}\n      ${msg}`);

for (const [loc, strings] of Object.entries(parsed)) {
  // Key parity. A missing key falls back to English at runtime.
  if (loc !== BASE) {
    for (const k of Object.keys(base)) if (!(k in strings)) fail(loc, k, "missing");
    for (const k of Object.keys(strings)) if (!(k in base)) fail(loc, k, "not in en.json");
  }

  for (const [key, value] of Object.entries(strings)) {
    const en = base[key];

    if (!value.trim()) fail(loc, key, "empty");

    // Placeholders. A dropped {{count}} renders as literal text.
    if (en && placeholders(en) !== placeholders(value))
      fail(loc, key, `placeholders differ: en has {${placeholders(en)}}, this has {${placeholders(value)}}`);

    // Newlines carry list formatting.
    if (en && (en.match(/\n/g) || []).length !== (value.match(/\n/g) || []).length)
      fail(loc, key, "newline count differs from en.json");

    // Style rules from ~/.claude/writing-style.md.
    if (value.includes("!")) fail(loc, key, "exclamation mark");
    const dashes = [...value.matchAll(/[—–]/g)];
    // An en dash between digits is a numeric range and correct typography.
    if (dashes.length && !/^\D*\(?\d+[—–]\d+\)?\D*$/.test(value))
      fail(loc, key, "dash joining clauses (a numeric range is fine)");

    // Two sentences run together, which is what stripping "!" left behind:
    // "Danke! Dein Feedback wurde ubermittelt." became "Danke Dein Feedback
    // wurde ubermittelt.".
    //
    // Counting sentence terminators against the English is the reliable test.
    // The capital-letter heuristic this replaces could not tell a run-on from
    // a Title Case label, a German noun, or the Z and M keycaps printed into
    // the shortcut strings. A translation may merge two English sentences into
    // one, so only a shortfall is worth flagging, and only by more than one.
    if (en) {
      // Count only real sentence ends. An ellipsis in a placeholder is not
      // three sentences; "e.g." is not two; a decimal point is not one; and
      // Greek writes its question mark as a semicolon, so el needs it counted
      // and no other language does.
      const stops = s =>
        (s
          .replace(/\.\.\.|…/g, "")
          .replace(/\b(?:e\.g|i\.e|etc|approx|avg|max|min|vs|Sr|Sra|Dr)\./gi, "")
          .replace(/\d[.,]\d/g, "")
          .match(loc === "el" ? /[.!?。;]/g : /[.!?。]/g) || []).length;
      // Two weak signals make one strong one. A shortfall alone fires on
      // legitimate merging; a mid-string capital alone fires on every Title
      // Case label and every German noun. Together they are the run-on and
      // almost nothing else.
      const lost = stops(en) - stops(value);
      const capitalMidString =
        !TITLE_CASE.test(value) &&
        /[a-zà-ÿα-ωčćšžđı] [A-ZÀ-ÞΑ-Ω]/.test(value) &&
        !/[.,:;?!»)\]] [A-ZÀ-ÞΑ-Ω]/.test(value) &&
        !PROPER_NOUN.test(value);
      if (lost > 1 || (lost === 1 && capitalMidString))
        fail(loc, key, `${stops(value)} sentence terminator(s) against ${stops(en)} in en.json, so a full stop may have been lost`);
    }

    // Product names and format lists are the same in every language.
    if (key in DO_NOT_TRANSLATE && value !== DO_NOT_TRANSLATE[key])
      fail(loc, key, `must read "${DO_NOT_TRANSLATE[key]}", not "${value}"`);
  }

  // Register. A file that mixes tu and voce reads as two people wrote it.
  const rx = REGISTER[loc];
  if (rx) {
    const all = Object.values(strings).join(" ");
    const informal = (all.match(rx[0]) || []).length;
    const formal = (all.match(rx[1]) || []).length;
    const minority = Math.min(informal, formal);
    if (minority > 0 && minority < Math.max(informal, formal) * 0.2)
      errors.push(`${loc}  <register>\n      mixes registers: ${informal} informal against ${formal} formal. Pick one.`);
  }
}

const shortcutKeys = base["app.welcome.steps.markClips.description"] ?? "";
if (!/\bZ\b/.test(shortcutKeys) || !/\bM\b/.test(shortcutKeys))
  errors.push(`en  app.welcome.steps.markClips.description\n      onboarding must name the real keys, Z and M`);

if (errors.length) {
  console.error(`\n${errors.length} locale problem(s):\n`);
  for (const e of errors) console.error(`  ${e}`);
  console.error("");
  process.exit(1);
}
console.log(`${files.length} locale files, ${Object.keys(base).length} keys each: clean`);

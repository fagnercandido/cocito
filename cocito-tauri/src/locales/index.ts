/**
 * Babele · i18n simples sem deps externas.
 *
 * Chaves em dot-notation ("prefs.title" etc). Interpolação com {name}.
 * Locale persistido em appearance.locale (config.json), aplicável runtime.
 *
 * Cobertura ~95% dos idiomas mais falados do mundo (L1+L2): 28 idiomas
 * cobrindo Mandarim, Hindi, Espanhol, Inglês, Árabe, Bengali, Português,
 * Russo, Japonês, Alemão, Coreano, Francês, Turco, Vietnamita, Indonésio,
 * Urdu, Persa, Suaíli, Italiano, Tailandês, Holandês, Polaco, Tâmil,
 * Telugu, Marathi, Punjabi.
 *
 * Línguas RTL marcadas em RTL_LOCALES — o `<html dir>` é actualizado
 * automaticamente quando se troca o locale.
 */

import { create } from "zustand";
import ptPT from "./pt-PT.json";
import ptBR from "./pt-BR.json";
import en from "./en.json";
import es from "./es.json";
import it from "./it.json";
import fr from "./fr.json";
import de from "./de.json";
import nl from "./nl.json";
import pl from "./pl.json";
import tr from "./tr.json";
import ru from "./ru.json";
import ar from "./ar.json";
import fa from "./fa.json";
import ur from "./ur.json";
import hi from "./hi.json";
import bn from "./bn.json";
import mr from "./mr.json";
import pa from "./pa.json";
import ta from "./ta.json";
import te from "./te.json";
import zhCN from "./zh-CN.json";
import zhTW from "./zh-TW.json";
import ja from "./ja.json";
import ko from "./ko.json";
import vi from "./vi.json";
import th from "./th.json";
import id from "./id.json";
import sw from "./sw.json";

export type Locale =
  | "pt-PT"
  | "pt-BR"
  | "en"
  | "es"
  | "fr"
  | "it"
  | "de"
  | "nl"
  | "pl"
  | "tr"
  | "ru"
  | "ar"
  | "fa"
  | "ur"
  | "hi"
  | "bn"
  | "mr"
  | "pa"
  | "ta"
  | "te"
  | "zh-CN"
  | "zh-TW"
  | "ja"
  | "ko"
  | "vi"
  | "th"
  | "id"
  | "sw";

const DICTS: Record<Locale, Record<string, string>> = {
  "pt-PT": ptPT as Record<string, string>,
  "pt-BR": ptBR as Record<string, string>,
  en: en as Record<string, string>,
  es: es as Record<string, string>,
  fr: fr as Record<string, string>,
  it: it as Record<string, string>,
  de: de as Record<string, string>,
  nl: nl as Record<string, string>,
  pl: pl as Record<string, string>,
  tr: tr as Record<string, string>,
  ru: ru as Record<string, string>,
  ar: ar as Record<string, string>,
  fa: fa as Record<string, string>,
  ur: ur as Record<string, string>,
  hi: hi as Record<string, string>,
  bn: bn as Record<string, string>,
  mr: mr as Record<string, string>,
  pa: pa as Record<string, string>,
  ta: ta as Record<string, string>,
  te: te as Record<string, string>,
  "zh-CN": zhCN as Record<string, string>,
  "zh-TW": zhTW as Record<string, string>,
  ja: ja as Record<string, string>,
  ko: ko as Record<string, string>,
  vi: vi as Record<string, string>,
  th: th as Record<string, string>,
  id: id as Record<string, string>,
  sw: sw as Record<string, string>,
};

/**
 * Línguas que escrevem da direita para a esquerda — afecta `<html dir>`.
 */
export const RTL_LOCALES: ReadonlySet<Locale> = new Set(["ar", "fa", "ur"]);

/**
 * Lista canónica para o `LanguagePanel`.
 * Cada item: code · label nativo · região (texto secundário) · familia.
 *
 * Ordem: defaults (PT) → europeias ocidentais → europeias eslavas → médio
 * oriente (RTL) → indianas → asiáticas (CJK + sudeste) → africanas. Critério:
 * usabilidade (PT primeiro porque o app fala PT-PT por defeito), depois
 * famílias agrupadas para o utilizador encontrar a sua sem scroll caótico.
 */
export const LOCALES: { code: Locale; label: string; region: string }[] = [
  { code: "pt-PT", label: "Português", region: "Portugal" },
  { code: "pt-BR", label: "Português", region: "Brasil" },
  { code: "en", label: "English", region: "Worldwide" },
  { code: "es", label: "Español", region: "Mundo" },
  { code: "fr", label: "Français", region: "Monde" },
  { code: "it", label: "Italiano", region: "Italia" },
  { code: "de", label: "Deutsch", region: "DACH" },
  { code: "nl", label: "Nederlands", region: "Nederland" },
  { code: "pl", label: "Polski", region: "Polska" },
  { code: "tr", label: "Türkçe", region: "Türkiye" },
  { code: "ru", label: "Русский", region: "Россия" },
  { code: "ar", label: "العربية", region: "العالم العربي" },
  { code: "fa", label: "فارسی", region: "ایران" },
  { code: "ur", label: "اردو", region: "پاکستان · بھارت" },
  { code: "hi", label: "हिन्दी", region: "भारत" },
  { code: "bn", label: "বাংলা", region: "বাংলাদেশ · ভারত" },
  { code: "mr", label: "मराठी", region: "महाराष्ट्र" },
  { code: "pa", label: "ਪੰਜਾਬੀ", region: "ਪੰਜਾਬ" },
  { code: "ta", label: "தமிழ்", region: "தமிழ்நாடு · இலங்கை" },
  { code: "te", label: "తెలుగు", region: "ఆంధ్ర · తెలంగాణ" },
  { code: "zh-CN", label: "简体中文", region: "中国大陆" },
  { code: "zh-TW", label: "繁體中文", region: "台灣 · 香港" },
  { code: "ja", label: "日本語", region: "日本" },
  { code: "ko", label: "한국어", region: "대한민국" },
  { code: "vi", label: "Tiếng Việt", region: "Việt Nam" },
  { code: "th", label: "ไทย", region: "ประเทศไทย" },
  { code: "id", label: "Bahasa Indonesia", region: "Indonesia" },
  { code: "sw", label: "Kiswahili", region: "Afrika Mashariki" },
];

interface BabeleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export const useBabele = create<BabeleState>((set, get) => ({
  locale: detectDefault(),
  setLocale(l) {
    set({ locale: l });
    try {
      localStorage.setItem("cocito.locale", l);
    } catch {}
    applyHtmlAttrs(l);
  },
  t(key, vars) {
    const dict = DICTS[get().locale] ?? DICTS["pt-PT"];
    let raw = dict[key] ?? DICTS["pt-PT"][key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        raw = raw.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return raw;
  },
}));

function detectDefault(): Locale {
  try {
    const stored = localStorage.getItem("cocito.locale");
    if (stored && stored in DICTS) return stored as Locale;
  } catch {}
  const sys = (typeof navigator !== "undefined" ? navigator.language : "pt-PT") as string;
  // Match exato primeiro (pt-PT, pt-BR, zh-CN, zh-TW)
  if (sys in DICTS) return sys as Locale;
  // Match por prefixo (en-US → en, pt-AO → pt-PT, zh-HK → zh-TW)
  if (sys.startsWith("pt-BR")) return "pt-BR";
  if (sys.startsWith("pt")) return "pt-PT";
  if (sys.startsWith("zh-TW") || sys.startsWith("zh-HK") || sys.startsWith("zh-Hant")) return "zh-TW";
  if (sys.startsWith("zh")) return "zh-CN";
  const prefix = sys.split("-")[0] as Locale;
  if (prefix in DICTS) return prefix;
  return "pt-PT";
}

/**
 * Actualiza `<html lang>` e `<html dir>` para línguas RTL — chamado
 * sempre que o locale muda. No arranque é chamado pelo App via efeito.
 */
export function applyHtmlAttrs(l: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = l;
  document.documentElement.dir = RTL_LOCALES.has(l) ? "rtl" : "ltr";
}

// Aplicar atributos no arranque (uma única vez por carga do módulo).
if (typeof document !== "undefined") {
  applyHtmlAttrs(useBabele.getState().locale);
}

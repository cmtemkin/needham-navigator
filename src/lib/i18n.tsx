"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

export type LanguageCode = "en" | "es" | "zh";

const LANGUAGE_STORAGE_KEY = "needham-navigator-language";

const DICTIONARIES: Record<LanguageCode, Record<string, string>> = {
  en: {
    "language.label": "Language",
    "language.english": "English",
    "language.spanish": "Spanish",
    "language.chinese": "Chinese",
    "header.tagline": "Your AI Town Guide",
    "header.home": "Home",
    "header.ask_question": "Ask a Question",
    "hero.badge": "AI-Powered · Always Up to Date",
    "hero.title_prefix": "Your guide to everything",
    "hero.subtitle":
      "Ask questions about town services, permits, schools, zoning, and more. Get instant answers with official sources.",
    "hero.search_placeholder": "Try: \"What permits do I need for a deck?\"",
    "hero.ask_navigator": "Ask Navigator",
    "hero.powered_by": "Powered by AI · Sourced from official {town} documents",
    "home.help_title": "What can we help you with?",
    "home.help_subtitle": "Click a topic or question to start chatting",
    "home.most_asked": "Most asked questions",
    "home.departments": "Departments",
    "home.departments_subtitle": "Click to ask about a department",
    "chat.back_home": "Back to Home",
    "chat.welcome_title": "Hi! I'm {app_name}",
    "chat.welcome_description":
      "Ask me anything about {town} town services, permits, schools, zoning, and more.",
    "chat.input_placeholder": "Ask anything about {town}...",
    "chat.input_disclaimer":
      "AI-generated responses may be inaccurate. Always verify with official sources. Not affiliated with the Town of {town}.",
    "chat.error_response": "Unable to load a response right now.",
    "confidence.high": "High confidence",
    "confidence.medium": "Medium confidence",
    "confidence.low": "Low confidence",
    "footer.disclaimer":
      "{app_name} is an independent community tool. Not affiliated with, endorsed by, or operated by the Town of {town}. AI responses may contain errors. Always verify with official sources at {website} or call {phone}.",
    "footer.terms_privacy": "Terms · Privacy",
  },
  es: {
    "language.label": "Idioma",
    "language.english": "Ingles",
    "language.spanish": "Espanol",
    "language.chinese": "Chino",
    "header.tagline": "Tu guia municipal con IA",
    "header.home": "Inicio",
    "header.ask_question": "Hacer una pregunta",
    "hero.badge": "Impulsado por IA · Siempre actualizado",
    "hero.title_prefix": "Tu guia para todo en",
    "hero.subtitle":
      "Haz preguntas sobre servicios municipales, permisos, escuelas, zonificacion y mas. Obten respuestas instantaneas con fuentes oficiales.",
    "hero.search_placeholder": "Prueba: \"Que permisos necesito para una terraza?\"",
    "hero.ask_navigator": "Preguntar",
    "hero.powered_by": "Con IA · Basado en documentos oficiales de {town}",
    "home.help_title": "En que podemos ayudarte?",
    "home.help_subtitle": "Haz clic en un tema o pregunta para empezar",
    "home.most_asked": "Preguntas frecuentes",
    "home.departments": "Departamentos",
    "home.departments_subtitle": "Haz clic para preguntar sobre un departamento",
    "chat.back_home": "Volver al inicio",
    "chat.welcome_title": "Hola, soy {app_name}",
    "chat.welcome_description":
      "Preguntame sobre servicios de {town}, permisos, escuelas, zonificacion y mas.",
    "chat.input_placeholder": "Pregunta cualquier cosa sobre {town}...",
    "chat.input_disclaimer":
      "Las respuestas generadas por IA pueden contener errores. Verifica siempre con fuentes oficiales. No esta afiliado al Municipio de {town}.",
    "chat.error_response": "No se puede cargar una respuesta en este momento.",
    "confidence.high": "Alta confianza",
    "confidence.medium": "Confianza media",
    "confidence.low": "Baja confianza",
    "footer.disclaimer":
      "{app_name} es una herramienta comunitaria independiente. No esta afiliada, respaldada ni operada por el Municipio de {town}. Las respuestas de IA pueden contener errores. Verifica siempre con fuentes oficiales en {website} o llama al {phone}.",
    "footer.terms_privacy": "Terminos · Privacidad",
  },
  zh: {
    "language.label": "语言",
    "language.english": "英语",
    "language.spanish": "西班牙语",
    "language.chinese": "中文",
    "header.tagline": "您的城镇 AI 助手",
    "header.home": "首页",
    "header.ask_question": "提问",
    "hero.badge": "AI 驱动 · 实时更新",
    "hero.title_prefix": "您的城镇指南",
    "hero.subtitle":
      "可咨询城镇服务、许可、学校、分区等问题。基于官方来源快速获得答案。",
    "hero.search_placeholder": "例如：\"建露台需要什么许可？\"",
    "hero.ask_navigator": "开始提问",
    "hero.powered_by": "由 AI 提供支持 · 基于 {town} 官方文件",
    "home.help_title": "我们可以帮您什么？",
    "home.help_subtitle": "点击主题或问题开始聊天",
    "home.most_asked": "常见问题",
    "home.departments": "部门",
    "home.departments_subtitle": "点击咨询相关部门",
    "chat.back_home": "返回首页",
    "chat.welcome_title": "你好，我是 {app_name}",
    "chat.welcome_description":
      "欢迎咨询 {town} 的城镇服务、许可、学校和分区等问题。",
    "chat.input_placeholder": "请输入关于 {town} 的问题...",
    "chat.input_disclaimer":
      "AI 生成的回答可能不完全准确，请务必以官方来源为准。本工具与 {town} 市政机构无隶属关系。",
    "chat.error_response": "当前无法加载回复。",
    "confidence.high": "高置信度",
    "confidence.medium": "中等置信度",
    "confidence.low": "低置信度",
    "footer.disclaimer":
      "{app_name} 是独立社区工具，与 {town} 市政机构无隶属、背书或运营关系。AI 回答可能有误，请通过 {website} 或致电 {phone} 进行核实。",
    "footer.terms_privacy": "条款 · 隐私",
  },
};

type I18nContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  availableLanguages: LanguageCode[];
  isEnabled: boolean;
  t: (key: string, replacements?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(
  template: string,
  replacements?: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_match, token: string) => {
    return replacements?.[token] ?? `{${token}}`;
  });
}

function readStoredLanguage(): LanguageCode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (value === "en" || value === "es" || value === "zh") {
    return value;
  }

  return null;
}

export function I18nProvider({
  children,
  enabled,
}: PropsWithChildren<{ enabled: boolean }>) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    if (!enabled) {
      setLanguageState("en");
      return;
    }

    const storedLanguage = readStoredLanguage();
    if (storedLanguage) {
      setLanguageState(storedLanguage);
      return;
    }

    const browserLanguage =
      typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
    if (browserLanguage.startsWith("es")) {
      setLanguageState("es");
      return;
    }
    if (browserLanguage.startsWith("zh")) {
      setLanguageState("zh");
    }
  }, [enabled]);

  const setLanguage = useCallback(
    (nextLanguage: LanguageCode) => {
      if (!enabled) {
        return;
      }
      setLanguageState(nextLanguage);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      }
    },
    [enabled]
  );

  const t = useCallback(
    (key: string, replacements?: Record<string, string>) => {
      const dictionary = DICTIONARIES[language] ?? DICTIONARIES.en;
      const template = dictionary[key] ?? DICTIONARIES.en[key] ?? key;
      return interpolate(template, replacements);
    },
    [language]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      availableLanguages: enabled
        ? (["en", "es", "zh"] as LanguageCode[])
        : ["en"],
      isEnabled: enabled,
      t,
    }),
    [enabled, language, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider.");
  }
  return context;
}

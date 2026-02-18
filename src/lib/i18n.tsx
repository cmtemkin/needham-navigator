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
    "header.about": "About",
    "header.permits": "Permits",
    "header.ask_question": "Ask a Question",
    "header.events": "Events",
    "header.weather": "Weather",
    "header.safety": "Safety",
    "header.transit": "Transit",
    "header.dining": "Dining",
    "header.zoning": "Zoning",
    "header.community": "Community",
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
    "confidence.high": "Verified from official sources",
    "confidence.medium": "Based on town documents",
    "confidence.low": "Limited info — call the department",
    "footer.disclaimer":
      "{app_name} is an independent community tool. Not affiliated with, endorsed by, or operated by the Town of {town}. AI responses may contain errors. Always verify with official sources at {website} or call {phone}.",
    "footer.terms_privacy": "Terms · Privacy",
    "permits.title": "Permit Wizard",
    "permits.subtitle": "Find out which permits, fees, and documents you need for your project in {town}.",
    "permits.select_project": "What type of project are you planning?",
    "permits.select_description": "Select your project type and we'll walk you through the permits, fees, and documents you'll need.",
    "permits.summary_title": "Your Permit Summary",
    "permits.start_over": "Start Over",
    "permits.permits_needed": "Permits Needed",
    "permits.estimated_fees": "Estimated Fees",
    "permits.required_docs": "Required Documents",
    "permits.timeline": "Estimated Timeline",
    "permits.contact": "Contact",
    "permits.tips": "Helpful Tips",
    "permits.ask_more": "Ask Navigator for More Details",
    "permits.new_project": "New Project",
    "permits.back": "Back",
    "permits.disclaimer": "This is an estimate based on common scenarios. Actual requirements may vary based on your specific property, zoning district, and project details. Always verify with the {town} Building Department at {phone} before starting your project.",
    "permits.page_disclaimer": "This tool provides general guidance. Always verify requirements with the {town} Building Department at {phone}. This is not legal or professional advice.",
  },
  es: {
    "language.label": "Idioma",
    "language.english": "Ingles",
    "language.spanish": "Espanol",
    "language.chinese": "Chino",
    "header.tagline": "Tu guia municipal con IA",
    "header.home": "Inicio",
    "header.about": "Acerca de",
    "header.permits": "Permisos",
    "header.ask_question": "Hacer una pregunta",
    "header.events": "Eventos",
    "header.weather": "Clima",
    "header.safety": "Seguridad",
    "header.transit": "Transporte",
    "header.dining": "Restaurantes",
    "header.zoning": "Zonificacion",
    "header.community": "Comunidad",
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
    "confidence.high": "Verificado de fuentes oficiales",
    "confidence.medium": "Basado en documentos municipales",
    "confidence.low": "Info limitada — llame al departamento",
    "footer.disclaimer":
      "{app_name} es una herramienta comunitaria independiente. No esta afiliada, respaldada ni operada por el Municipio de {town}. Las respuestas de IA pueden contener errores. Verifica siempre con fuentes oficiales en {website} o llama al {phone}.",
    "footer.terms_privacy": "Terminos · Privacidad",
    "permits.title": "Asistente de Permisos",
    "permits.subtitle": "Descubre que permisos, tarifas y documentos necesitas para tu proyecto en {town}.",
    "permits.select_project": "Que tipo de proyecto estas planificando?",
    "permits.select_description": "Selecciona tu tipo de proyecto y te guiaremos con los permisos, tarifas y documentos necesarios.",
    "permits.summary_title": "Resumen de Permisos",
    "permits.start_over": "Empezar de nuevo",
    "permits.permits_needed": "Permisos Necesarios",
    "permits.estimated_fees": "Tarifas Estimadas",
    "permits.required_docs": "Documentos Requeridos",
    "permits.timeline": "Plazo Estimado",
    "permits.contact": "Contacto",
    "permits.tips": "Consejos Utiles",
    "permits.ask_more": "Preguntar mas al Navegador",
    "permits.new_project": "Nuevo Proyecto",
    "permits.back": "Atras",
    "permits.disclaimer": "Esta es una estimacion basada en escenarios comunes. Los requisitos reales pueden variar. Verifica siempre con el Departamento de Construccion de {town} al {phone} antes de comenzar tu proyecto.",
    "permits.page_disclaimer": "Esta herramienta proporciona orientacion general. Verifica siempre los requisitos con el Departamento de Construccion de {town} al {phone}. Esto no es asesoramiento legal ni profesional.",
  },
  zh: {
    "language.label": "语言",
    "language.english": "英语",
    "language.spanish": "西班牙语",
    "language.chinese": "中文",
    "header.tagline": "您的城镇 AI 助手",
    "header.home": "首页",
    "header.about": "关于",
    "header.permits": "许可证",
    "header.ask_question": "提问",
    "header.events": "活动",
    "header.weather": "天气",
    "header.safety": "安全",
    "header.transit": "交通",
    "header.dining": "餐饮",
    "header.zoning": "分区",
    "header.community": "社区",
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
    "confidence.high": "已从官方来源核实",
    "confidence.medium": "基于市政文件",
    "confidence.low": "信息有限 — 请致电相关部门",
    "footer.disclaimer":
      "{app_name} 是独立社区工具，与 {town} 市政机构无隶属、背书或运营关系。AI 回答可能有误，请通过 {website} 或致电 {phone} 进行核实。",
    "footer.terms_privacy": "条款 · 隐私",
    "permits.title": "许可证向导",
    "permits.subtitle": "了解您在 {town} 的项目需要哪些许可证、费用和文件。",
    "permits.select_project": "您计划什么类型的项目？",
    "permits.select_description": "选择项目类型，我们将引导您了解所需的许可证、费用和文件。",
    "permits.summary_title": "许可证摘要",
    "permits.start_over": "重新开始",
    "permits.permits_needed": "所需许可证",
    "permits.estimated_fees": "预估费用",
    "permits.required_docs": "所需文件",
    "permits.timeline": "预估时间",
    "permits.contact": "联系方式",
    "permits.tips": "实用提示",
    "permits.ask_more": "向导航器询问更多详情",
    "permits.new_project": "新项目",
    "permits.back": "返回",
    "permits.disclaimer": "这是基于常见情况的估算。实际要求可能因具体房产、分区和项目细节而异。在开始项目前，请务必致电 {phone} 向 {town} 建筑部门确认。",
    "permits.page_disclaimer": "本工具仅提供一般性指导。请务必致电 {phone} 向 {town} 建筑部门确认要求。本工具不构成法律或专业建议。",
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

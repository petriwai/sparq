'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, Language, TranslationKey } from '@/lib/i18n'

interface LanguageContextType {
  lang: Language
  t: (key: TranslationKey) => string
  setLang: (lang: Language) => void
  availableLanguages: { code: Language; name: string; flag: string }[]
}

const LanguageContext = createContext<LanguageContextType | null>(null)

const LANGUAGE_OPTIONS: { code: Language; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
]

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage or browser preference
  const [lang, setLangState] = useState<Language>('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check localStorage first
    const saved = localStorage.getItem('inoka-language') as Language | null
    if (saved && translations[saved]) {
      setLangState(saved)
      return
    }
    
    // Fall back to browser language
    const browserLang = navigator.language.split('-')[0] as Language
    if (translations[browserLang]) {
      setLangState(browserLang)
    }
  }, [])

  const setLang = (newLang: Language) => {
    setLangState(newLang)
    localStorage.setItem('inoka-language', newLang)
  }

  const t = (key: TranslationKey): string => {
    return translations[lang]?.[key] || translations['en'][key] || key
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <LanguageContext.Provider value={{ 
        lang: 'en', 
        t: (key) => translations['en'][key] || key,
        setLang: () => {},
        availableLanguages: LANGUAGE_OPTIONS
      }}>
        {children}
      </LanguageContext.Provider>
    )
  }

  return (
    <LanguageContext.Provider value={{ lang, t, setLang, availableLanguages: LANGUAGE_OPTIONS }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider')
  }
  return context
}

// Language selector component
export function LanguageSelector({ className = '' }: { className?: string }) {
  const { lang, setLang, availableLanguages } = useTranslation()
  
  return (
    <select 
      value={lang}
      onChange={(e) => setLang(e.target.value as Language)}
      className={`bg-slate-700 text-white px-3 py-2 rounded-xl border border-slate-600 focus:border-amber-500 focus:outline-none ${className}`}
    >
      {availableLanguages.map(({ code, name, flag }) => (
        <option key={code} value={code}>
          {flag} {name}
        </option>
      ))}
    </select>
  )
}

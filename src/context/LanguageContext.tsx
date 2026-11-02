import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LanguageCode,
  LanguageOption,
  SUPPORTED_LANGUAGES,
  translations,
  TranslationKey,
} from '../i18n/translations';

const STORAGE_KEY = 'vigil_driver_language';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  languages: LanguageOption[];
  currentLanguageOption: LanguageOption;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: async () => {},
  t: (key: TranslationKey) => key,
  languages: SUPPORTED_LANGUAGES,
  currentLanguageOption: SUPPORTED_LANGUAGES[0],
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>('en');

  useEffect(() => {
    // Load stored language preference
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && (stored in translations)) {
        setLanguageState(stored as LanguageCode);
      }
    });
  }, []);

  const setLanguage = useCallback(async (lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      console.warn('[LanguageContext] Failed to persist language:', e);
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const langDict = translations[language] || translations.en;
      let text = (langDict as any)[key] || (translations.en as any)[key] || key;

      if (params) {
        Object.keys(params).forEach((paramKey) => {
          text = text.replace(new RegExp(`{${paramKey}}`, 'g'), String(params[paramKey]));
        });
      }

      return text;
    },
    [language]
  );

  const currentLanguageOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languages: SUPPORTED_LANGUAGES,
        currentLanguageOption,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

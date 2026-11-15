import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';

const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
const FALLBACK_LANGUAGE = 'fr';

function resolveDeviceLanguage(): string {
  const deviceLanguageTag = Localization.getLocales()[0]?.languageCode ?? FALLBACK_LANGUAGE;
  return SUPPORTED_LANGUAGES.includes(deviceLanguageTag as (typeof SUPPORTED_LANGUAGES)[number])
    ? deviceLanguageTag
    : FALLBACK_LANGUAGE;
}

// eslint-disable-next-line import/no-named-as-default-member -- `i18n.use` is the real instance method, not the named `use` export.
void i18n.use(initReactI18next).init({
  resources: { fr, en },
  lng: resolveDeviceLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false },
});

export default i18n;

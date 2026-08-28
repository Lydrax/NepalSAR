import { en, TranslationKey } from './en';
import { ne } from './ne';

export type Language = 'en' | 'ne';

export const translations: Record<Language, TranslationKey> = {
  en,
  ne,
};

export function getTranslations(lang: Language = 'en'): TranslationKey {
  return translations[lang] || en;
}

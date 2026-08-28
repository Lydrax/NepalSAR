import React from 'react';
import { AlertTriangle, PhoneCall } from 'lucide-react';
import { TranslationKey } from '@/lib/i18n/en';
import { Language } from '@/lib/i18n';
import { getVerifiedEmergencyContacts } from '@/lib/constants/emergencyContacts';

interface DisclaimerBannerProps {
  t: TranslationKey;
  lang?: Language;
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({ t, lang = 'en' }) => {
  const verifiedContacts = getVerifiedEmergencyContacts();

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-amber-950 text-xs sm:text-sm">
      <div className="max-w-4xl mx-auto flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1 w-full">
          <p className="font-semibold text-amber-900 leading-snug">
            {t.disclaimer}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-900/90 pt-1 border-t border-amber-200/80">
            <span className="flex items-center gap-1 font-bold text-amber-950 shrink-0">
              <PhoneCall className="w-3.5 h-3.5 text-amber-800" />
              {t.officialNumbersHeading}:
            </span>
            {verifiedContacts.map((contact) => (
              <a
                key={contact.id}
                href={contact.dialUrl}
                className="inline-flex items-center gap-1 font-semibold text-amber-950 hover:text-red-700 bg-amber-100/70 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors"
                title={`${contact.nameEn} - ${contact.agency}`}
              >
                <span>{lang === 'ne' ? contact.nameNe : contact.nameEn}</span>
                <span className="font-mono font-bold text-red-700">({contact.number})</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

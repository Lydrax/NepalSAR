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
    <div className="bg-amber-950/70 border-b border-amber-600/40 px-4 py-3 text-amber-200 text-xs sm:text-sm">
      <div className="max-w-3xl mx-auto flex items-start gap-2.5">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1.5 w-full">
          <p className="font-semibold text-amber-300">
            {t.disclaimer}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-amber-300/80 pt-1 border-t border-amber-800/40">
            <span className="flex items-center gap-1 font-medium text-amber-200 shrink-0">
              <PhoneCall className="w-3.5 h-3.5" />
              {t.officialNumbersHeading}
            </span>
            {verifiedContacts.map((contact) => (
              <a
                key={contact.id}
                href={contact.dialUrl}
                className="underline font-bold hover:text-white inline-flex items-center gap-1"
                title={`${contact.nameEn} - ${contact.agency}`}
              >
                <span>{lang === 'ne' ? contact.nameNe : contact.nameEn}:</span>
                <span className="font-mono">{contact.number}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

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
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-amber-950 text-xs sm:text-sm">
      <div className="max-w-4xl mx-auto flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1.5 w-full">
          <div>
            <span className="font-extrabold text-amber-950 uppercase tracking-wide text-xs sm:text-sm block">
              {t.disclaimerTitle || 'Prototype Emergency Coordination Service'}
            </span>
            <p className="text-amber-900 mt-0.5 text-xs sm:text-sm leading-relaxed">
              {lang === 'ne' ? (
                <>
                  नेपालएसएआर (NepalSAR) एक स्वतन्त्र प्रारम्भिक प्रणाली हो र यो{' '}
                  <strong className="font-bold text-amber-950">कुनै आधिकारिक आपतकालीन सेवा वा सरकारी निकाय होइन</strong>।
                </>
              ) : (
                <>
                  NepalSAR is an independent prototype and is{' '}
                  <strong className="font-bold text-amber-950">not an official emergency service or government agency</strong>.
                </>
              )}
            </p>
            <p className="text-amber-900 text-xs sm:text-sm leading-relaxed">
              {lang === 'ne' ? (
                <>
                  उद्धार अनुरोध दर्ता गर्दैमा{' '}
                  <strong className="font-bold text-amber-950">उद्धार वा प्रतिक्रियाको ग्यारेन्टी हुँदैन</strong>। आपतकालीन अवस्थामा, सम्भव भएसम्म सीधै उपयुक्त आधिकारिक आपतकालीन सेवाहरूमा सम्पर्क गर्नुहोस्।
                </>
              ) : (
                <>
                  Submitting a rescue request{' '}
                  <strong className="font-bold text-amber-950">does not guarantee a response or rescue</strong>. In an emergency, please contact the appropriate official emergency services directly whenever possible.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-amber-900/90 pt-1.5 border-t border-amber-200/80">
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

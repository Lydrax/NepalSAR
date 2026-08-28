export interface EmergencyContact {
  id: string;
  nameEn: string;
  nameNe: string;
  number: string;
  dialUrl: string;
  agency: string;
  descriptionEn: string;
  descriptionNe: string;
  isVerified: boolean;
  verifiedSource: string;
  verificationDate: string;
}

/**
 * Official verified emergency hotlines in Nepal.
 * Only verified national hotlines are enabled.
 * All entries are managed centrally here rather than hard-coded into UI components.
 */
export const OFFICIAL_EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: 'police',
    nameEn: 'Nepal Police',
    nameNe: 'नेपाल प्रहरी',
    number: '100',
    dialUrl: 'tel:100',
    agency: 'Nepal Police HQ, Naxal, Kathmandu',
    descriptionEn: 'National emergency police dispatch',
    descriptionNe: 'राष्ट्रिय आपतकालीन प्रहरी सेवा',
    isVerified: true,
    verifiedSource: 'Nepal Police Official Portal (nepalpolice.gov.np)',
    verificationDate: '2026-08-27',
  },
  {
    id: 'fire',
    nameEn: 'Fire Brigade',
    nameNe: 'दमकल (वारुण यन्त्र)',
    number: '101',
    dialUrl: 'tel:101',
    agency: 'Kathmandu Fire Service / District Municipalities',
    descriptionEn: 'Fire emergency & structural rescue',
    descriptionNe: 'आगलागी तथा आपतकालीन उद्धार',
    isVerified: true,
    verifiedSource: 'Ministry of Home Affairs (MoHA) Emergency Directory',
    verificationDate: '2026-08-27',
  },
  {
    id: 'ambulance',
    nameEn: 'Ambulance (EMS)',
    nameNe: 'एम्बुलेन्स सेवा',
    number: '102',
    dialUrl: 'tel:102',
    agency: 'Nepal Ambulance Service / Nepal Red Cross Society',
    descriptionEn: 'Emergency medical transport & triage',
    descriptionNe: 'आपतकालीन स्वास्थ्य तथा एम्बुलेन्स',
    isVerified: true,
    verifiedSource: 'Nepal Ambulance Service (NAS 102) & NRCS',
    verificationDate: '2026-08-27',
  },
  {
    id: 'traffic',
    nameEn: 'Traffic Police',
    nameNe: 'ट्राफिक प्रहरी',
    number: '103',
    dialUrl: 'tel:103',
    agency: 'Kathmandu Valley Traffic Police Division',
    descriptionEn: 'Highway accidents & road clearance',
    descriptionNe: 'सडक दुर्घटना तथा ट्राफिक सेवा',
    isVerified: true,
    verifiedSource: 'Nepal Traffic Police Official Portal (traffic.nepalpolice.gov.np)',
    verificationDate: '2026-08-27',
  },
  {
    id: 'neoc',
    nameEn: 'Disaster Helpline (NEOC)',
    nameNe: 'विपद् हेल्पलाइन (NEOC)',
    number: '1155',
    dialUrl: 'tel:1155',
    agency: 'National Emergency Operation Centre, Ministry of Home Affairs (MoHA)',
    descriptionEn: 'National disaster management hotline',
    descriptionNe: 'राष्ट्रिय आपतकालीन कार्यसञ्चालन केन्द्र (NEOC)',
    isVerified: true,
    verifiedSource: 'Ministry of Home Affairs Disaster Portal (drrportal.gov.np / neoc.gov.np)',
    verificationDate: '2026-08-27',
  },
];

/**
 * Helper to get only verified contacts
 */
export function getVerifiedEmergencyContacts(): EmergencyContact[] {
  return OFFICIAL_EMERGENCY_CONTACTS.filter((contact) => contact.isVerified);
}

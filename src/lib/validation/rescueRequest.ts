import {
  DisasterType,
  ImmediateDangerSituation,
  InjuryLevel,
  LocationData,
  RescueRequestFormData,
} from '../types/emergency';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

// Accepts standard RFC 4122 UUID format (8-4-4-4-12 hex digits)
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{5,20}$/;

const VALID_SITUATIONS: ImmediateDangerSituation[] = [
  'trapped',
  'stranded',
  'evacuating',
  'injured_immobile',
  'safe_need_evac',
  'other',
];

const VALID_INJURIES: InjuryLevel[] = ['none', 'minor', 'serious', 'critical'];

const VALID_DISASTERS: DisasterType[] = [
  'flood',
  'landslide',
  'earthquake',
  'building_collapse',
  'avalanche',
  'fire',
  'other',
];

/**
 * Strict server-side validator for public rescue request payloads.
 * Accepts both camelCase and snake_case properties.
 */
export function validateRescueRequestPayload(
  payload: unknown
): ValidationResult<RescueRequestFormData> {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return { success: false, errors: ['Request body must be a valid JSON object.'] };
  }

  const raw = payload as Record<string, unknown>;

  // 1. Client Request ID (clientRequestId or client_request_id)
  const rawClientId = raw.clientRequestId ?? raw.client_request_id;
  let clientRequestId = '';
  if (typeof rawClientId === 'string' && UUID_REGEX.test(rawClientId.trim())) {
    clientRequestId = rawClientId.trim().toLowerCase();
  } else if (typeof rawClientId === 'string' && rawClientId.trim().length >= 8 && rawClientId.trim().length <= 64) {
    clientRequestId = rawClientId.trim();
  } else {
    // Generate UUID server-side if client didn't supply a valid one
    clientRequestId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
            (
              Number(c) ^
              (Math.random() * 16 >> (Number(c) / 4))
            ).toString(16)
          );
  }

  // 2. People Count (peopleCount or people_count)
  const rawPeople = raw.peopleCount ?? raw.people_count;
  const peopleCount = Number(rawPeople);
  if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 100) {
    errors.push('peopleCount must be an integer between 1 and 100.');
  }

  // 3. Situation (situation or immediate_danger)
  const rawSituation = (raw.situation ?? raw.immediate_danger) as ImmediateDangerSituation;
  if (!VALID_SITUATIONS.includes(rawSituation)) {
    errors.push(`situation must be one of: ${VALID_SITUATIONS.join(', ')}.`);
  }

  const rawSituationOther = raw.situationOther ?? raw.situation_other;
  const situationOther =
    typeof rawSituationOther === 'string' ? rawSituationOther.trim().slice(0, 200) : undefined;

  // 4. Injury Level (injuryLevel or injury_level)
  const rawInjury = (raw.injuryLevel ?? raw.injury_level) as InjuryLevel;
  if (!VALID_INJURIES.includes(rawInjury)) {
    errors.push(`injuryLevel must be one of: ${VALID_INJURIES.join(', ')}.`);
  }

  // 5. Disaster Type (disasterType or disaster_type)
  const rawDisaster = (raw.disasterType ?? raw.disaster_type) as DisasterType;
  if (!VALID_DISASTERS.includes(rawDisaster)) {
    errors.push(`disasterType must be one of: ${VALID_DISASTERS.join(', ')}.`);
  }

  const rawDisasterOther = raw.disasterOther ?? raw.disaster_other;
  const disasterOther =
    typeof rawDisasterOther === 'string' ? rawDisasterOther.trim().slice(0, 200) : undefined;

  // 6. Location (nested location or top-level properties)
  const rawLoc = (raw.location || {}) as Record<string, unknown>;
  const rawLat = rawLoc.latitude ?? raw.latitude;
  const rawLng = rawLoc.longitude ?? raw.longitude;
  const rawAccuracy = rawLoc.accuracy ?? raw.location_accuracy ?? raw.accuracy;
  const rawSource = rawLoc.source ?? raw.location_source ?? raw.source;
  const rawDesc = rawLoc.manualDescription ?? raw.manual_location ?? raw.manualDescription;
  const rawTime = rawLoc.timestamp ?? raw.location_timestamp ?? raw.timestamp;

  const latitude = rawLat !== null && rawLat !== undefined && rawLat !== '' ? Number(rawLat) : null;
  const longitude = rawLng !== null && rawLng !== undefined && rawLng !== '' ? Number(rawLng) : null;
  const accuracy = rawAccuracy !== null && rawAccuracy !== undefined && rawAccuracy !== '' ? Number(rawAccuracy) : null;
  const manualDesc = typeof rawDesc === 'string' ? rawDesc.trim().slice(0, 1000) : '';

  if (latitude !== null && (isNaN(latitude) || latitude < -90 || latitude > 90)) {
    errors.push('latitude must be between -90 and 90 degrees.');
  }

  if (longitude !== null && (isNaN(longitude) || longitude < -180 || longitude > 180)) {
    errors.push('longitude must be between -180 and 180 degrees.');
  }

  if (accuracy !== null && (isNaN(accuracy) || accuracy < 0)) {
    errors.push('location accuracy must be a positive number.');
  }

  const hasCoords = latitude !== null && longitude !== null && !isNaN(latitude) && !isNaN(longitude);
  const hasDesc = manualDesc.length > 0;

  if (!hasCoords && !hasDesc) {
    errors.push('You must provide either valid GPS coordinates or a descriptive location text.');
  }

  const sourceVal =
    rawSource === 'MAP' || rawSource === 'MANUAL' ? rawSource : hasCoords ? 'GPS' : 'MANUAL';

  const locationData: LocationData = {
    latitude: hasCoords ? latitude : null,
    longitude: hasCoords ? longitude : null,
    accuracy: accuracy !== null && !isNaN(accuracy) ? accuracy : null,
    timestamp: typeof rawTime === 'string' ? rawTime : new Date().toISOString(),
    source: sourceVal,
    manualDescription: manualDesc || undefined,
  };

  // 7. Description (sanitized text up to 1000 chars)
  const description =
    typeof raw.description === 'string'
      ? raw.description
          .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '') // remove control chars
          .trim()
          .slice(0, 1000)
      : '';

  // 8. Phone Number (phoneNumber or phone_number)
  const rawPhone = raw.phoneNumber ?? raw.phone_number;
  let phoneNumber: string | undefined = undefined;
  if (typeof rawPhone === 'string' && rawPhone.trim().length > 0) {
    const cleanPhone = rawPhone.trim();
    if (cleanPhone.length > 30 || !PHONE_REGEX.test(cleanPhone)) {
      errors.push('Phone number contains invalid characters or exceeds 30 characters.');
    } else {
      phoneNumber = cleanPhone;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      clientRequestId,
      location: locationData,
      peopleCount,
      situation: rawSituation,
      situationOther,
      injuryLevel: rawInjury,
      disasterType: rawDisaster,
      disasterOther,
      description,
      phoneNumber,
    },
  };
}

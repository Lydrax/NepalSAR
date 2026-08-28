import {
  DisasterType,
  ImmediateDangerSituation,
  InjuryLevel,
  PriorityLevel,
  RescueCaseStatus,
} from '../types/emergency';

export const SITUATION_OPTIONS: { id: ImmediateDangerSituation; label: string; description: string }[] = [
  { id: 'trapped', label: 'Trapped', description: 'Unable to leave current physical location or building' },
  { id: 'stranded', label: 'Stranded', description: 'Cut off by water, debris, or collapsed terrain' },
  { id: 'injured_immobile', label: 'Injured & Immobile', description: 'Injured and unable to move independently' },
  { id: 'evacuating', label: 'Evacuating', description: 'Currently on the move, facing rising hazards' },
  { id: 'safe_need_evac', label: 'Safe but need Evacuation', description: 'Temporarily safe, urgently requiring relocation' },
  { id: 'other', label: 'Other', description: 'Other emergency situation' },
];

export const INJURY_OPTIONS: { id: InjuryLevel; label: string; severityBadge: string }[] = [
  { id: 'none', label: 'Nobody injured', severityBadge: 'bg-slate-700 text-slate-200' },
  { id: 'minor', label: 'Minor injury', severityBadge: 'bg-amber-900 text-amber-200' },
  { id: 'serious', label: 'Serious injury', severityBadge: 'bg-orange-900 text-orange-200' },
  { id: 'critical', label: 'Critical / Life-threatening', severityBadge: 'bg-red-900 text-red-100 font-bold' },
];

export const DISASTER_OPTIONS: { id: DisasterType; label: string }[] = [
  { id: 'flood', label: 'Flood' },
  { id: 'landslide', label: 'Landslide' },
  { id: 'earthquake', label: 'Earthquake' },
  { id: 'building_collapse', label: 'Building Collapse' },
  { id: 'avalanche', label: 'Avalanche' },
  { id: 'fire', label: 'Fire' },
  { id: 'other', label: 'Other' },
];

export const STATUS_DESCRIPTIONS: Record<RescueCaseStatus, { title: string; explanation: string; color: string }> = {
  SUBMITTED: {
    title: 'Request received',
    explanation: 'Your request has been recorded. It has NOT yet been received or accepted by a rescue team.',
    color: 'bg-amber-600 text-white',
  },
  VERIFIED: {
    title: 'Request verified',
    explanation: 'A rescue coordinator has reviewed and verified your request details.',
    color: 'bg-blue-600 text-white',
  },
  ASSIGNED: {
    title: 'Responder assigned',
    explanation: 'An authorized rescue team has been assigned to your case.',
    color: 'bg-indigo-600 text-white',
  },
  RESCUER_EN_ROUTE: {
    title: 'Responder en route',
    explanation: 'Rescue personnel are actively moving toward your reported location.',
    color: 'bg-purple-600 text-white',
  },
  RESCUED: {
    title: 'Rescue reported complete',
    explanation: 'Personnel have reached the location and secured individuals.',
    color: 'bg-emerald-600 text-white',
  },
  CLOSED: {
    title: 'Case closed',
    explanation: 'This rescue mission is resolved and completed.',
    color: 'bg-slate-700 text-slate-300',
  },
  CANCELLED: {
    title: 'Request cancelled',
    explanation: 'This request was cancelled or determined to be duplicate/invalid.',
    color: 'bg-red-900 text-red-200',
  },
};

/**
 * Deterministic calculation of emergency priority
 * Strictly rules-based as specified in Section 17 & 58.
 */
export function calculatePriority(
  situation: ImmediateDangerSituation,
  injuryLevel: InjuryLevel
): PriorityLevel {
  // CRITICAL:
  // - critical/life-threatening injury
  // - OR trapped + serious injury
  if (
    injuryLevel === 'critical' ||
    (situation === 'trapped' && injuryLevel === 'serious') ||
    (situation === 'injured_immobile' && injuryLevel === 'serious')
  ) {
    return 'CRITICAL';
  }

  // HIGH:
  // - trapped
  // - serious injury
  if (situation === 'trapped' || injuryLevel === 'serious') {
    return 'HIGH';
  }

  // NORMAL:
  // - stranded, evacuation request, minor/no injury
  return 'NORMAL';
}

export const DISCLAIMER_TEXT =
  'Prototype Emergency Coordination Service: NepalSAR is an independent prototype and is not an official emergency service or government agency. Submitting a rescue request does not guarantee a response or rescue. In an emergency, please contact the appropriate official emergency services directly whenever possible.';

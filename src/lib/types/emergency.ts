export type LocationSource = 'GPS' | 'MAP' | 'MANUAL';

export type ImmediateDangerSituation =
  | 'trapped'
  | 'stranded'
  | 'evacuating'
  | 'injured_immobile'
  | 'safe_need_evac'
  | 'other';

export type InjuryLevel =
  | 'none'
  | 'minor'
  | 'serious'
  | 'critical';

export type DisasterType =
  | 'flood'
  | 'landslide'
  | 'earthquake'
  | 'building_collapse'
  | 'avalanche'
  | 'fire'
  | 'other';

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'NORMAL';

export type RescueCaseStatus =
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'ASSIGNED'
  | 'RESCUER_EN_ROUTE'
  | 'RESCUED'
  | 'CLOSED'
  | 'CANCELLED';

export type ResponderRole = 'RESPONDER' | 'DISPATCHER' | 'ADMIN';

export interface LocationData {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null; // in meters
  timestamp: string | null;
  source: LocationSource;
  manualDescription?: string;
}

export interface RescueRequestFormData {
  clientRequestId: string;
  location: LocationData;
  peopleCount: number;
  situation: ImmediateDangerSituation;
  situationOther?: string;
  injuryLevel: InjuryLevel;
  disasterType: DisasterType;
  disasterOther?: string;
  description: string;
  phoneNumber?: string;
}

export interface RescueRequestRecord {
  id: string;
  caseNumber: string;
  clientRequestId: string;
  createdAt: string;
  updatedAt: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  locationTimestamp: string | null;
  locationSource: LocationSource;
  manualLocationDescription?: string | null;
  peopleCount: number;
  trappedStatus: ImmediateDangerSituation;
  injuryLevel: InjuryLevel;
  disasterType: DisasterType;
  disasterOther?: string | null;
  description: string | null;
  phoneNumber?: string | null;
  priority: PriorityLevel;
  status: RescueCaseStatus;
  assignedTo?: string | null;
  resolvedAt?: string | null;
  createdBy?: string | null;
}

export interface PublicCaseStatusView {
  caseNumber: string;
  status: RescueCaseStatus;
  submittedAt: string;
  lastUpdatedAt: string;
}

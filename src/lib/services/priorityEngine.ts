import { ImmediateDangerSituation, InjuryLevel, PriorityLevel } from '../types/emergency';

/**
 * Server-controlled deterministic priority rule engine.
 * Never trust priority supplied by client frontend.
 * 
 * Rules:
 * CRITICAL:
 * - Critical / life-threatening injury
 * - OR Trapped + serious injury
 * 
 * HIGH:
 * - Trapped
 * - OR Serious injury
 * 
 * NORMAL:
 * - Stranded, evacuation, minor/no injury
 */
export function calculateServerPriority(
  situation: ImmediateDangerSituation,
  injury: InjuryLevel
): PriorityLevel {
  if (
    injury === 'critical' ||
    (situation === 'trapped' && injury === 'serious') ||
    (situation === 'injured_immobile' && injury === 'serious')
  ) {
    return 'CRITICAL';
  }

  if (situation === 'trapped' || injury === 'serious') {
    return 'HIGH';
  }

  return 'NORMAL';
}

import { NextResponse } from 'next/server';

export const runtime = 'edge';

import { getAdminClient } from '@/lib/supabase/admin';
import { hashVerificationToken } from '@/lib/services/tokenAuth';
import { RescueCaseStatus, PriorityLevel, ImmediateDangerSituation, InjuryLevel, DisasterType } from '@/lib/types/emergency';

interface SeedCase {
  caseNumber: string;
  pin: string;
  latitude: number;
  longitude: number;
  locationDescription: string;
  peopleCount: number;
  situation: ImmediateDangerSituation;
  injuryLevel: InjuryLevel;
  disasterType: DisasterType;
  description: string;
  phoneNumber: string;
  priority: PriorityLevel;
  status: RescueCaseStatus;
  createdAt: string;
}

const SEED_CASES: SeedCase[] = [
  {
    caseNumber: '2026100001',
    pin: '112233',
    latitude: 27.6895,
    longitude: 85.2982,
    locationDescription: 'Balkhu Bridge area, Bagmati Riverbank, Kathmandu',
    peopleCount: 4,
    situation: 'trapped',
    injuryLevel: 'minor',
    disasterType: 'flood',
    description: 'Ground floor submerged by 5ft floodwater. 4 family members trapped on 2nd floor roof terrace.',
    phoneNumber: '9841234567',
    priority: 'CRITICAL',
    status: 'RESCUER_EN_ROUTE',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    caseNumber: '2026100002',
    pin: '223344',
    latitude: 27.8317,
    longitude: 85.5786,
    locationDescription: 'Melamchi Bazaar Ward 3, Sindhupalchok',
    peopleCount: 3,
    situation: 'injured_immobile',
    injuryLevel: 'serious',
    disasterType: 'landslide',
    description: 'Mudslide debris blocked front and rear exits. 1 elderly person with fractured leg.',
    phoneNumber: '9851098765',
    priority: 'HIGH',
    status: 'ASSIGNED',
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
  {
    caseNumber: '2026100003',
    pin: '334455',
    latitude: 28.7963,
    longitude: 83.9358,
    locationDescription: 'High Camp trail descent, Thorong La Pass, Mustang',
    peopleCount: 2,
    situation: 'stranded',
    injuryLevel: 'serious',
    disasterType: 'avalanche',
    description: 'Blizzard conditions and snow slab collapse. 2 trekkers sheltered in makeshift cave with hypothermia.',
    phoneNumber: '9801122334',
    priority: 'HIGH',
    status: 'VERIFIED',
    createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
  },
  {
    caseNumber: '2026100004',
    pin: '445566',
    latitude: 27.7348,
    longitude: 85.3121,
    locationDescription: 'Gongabu Bus Park Residential Alley, Kathmandu',
    peopleCount: 5,
    situation: 'trapped',
    injuryLevel: 'critical',
    disasterType: 'building_collapse',
    description: 'Partial structural collapse of brick building. 5 people trapped in reinforced stairwell void.',
    phoneNumber: '9860123456',
    priority: 'CRITICAL',
    status: 'SUBMITTED',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    caseNumber: '2026100005',
    pin: '556677',
    latitude: 28.2096,
    longitude: 83.9556,
    locationDescription: 'Lakeside Baidam North Shore, Pokhara',
    peopleCount: 2,
    situation: 'safe_need_evac',
    injuryLevel: 'none',
    disasterType: 'flood',
    description: 'Phewa Lake water level risen into resort parking. 2 staff safe on upper deck requiring boat transport.',
    phoneNumber: '9813987654',
    priority: 'NORMAL',
    status: 'SUBMITTED',
    createdAt: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
  },
  {
    caseNumber: '2026100006',
    pin: '667788',
    latitude: 27.8069,
    longitude: 86.7141,
    locationDescription: 'Namche Bazaar Main Helipad Ridge, Solukhumbu',
    peopleCount: 1,
    situation: 'injured_immobile',
    injuryLevel: 'critical',
    disasterType: 'other',
    description: 'High Altitude Pulmonary Edema (HAPE), oxygen saturation below 60%. Needs emergency heli-evac.',
    phoneNumber: '9849887766',
    priority: 'CRITICAL',
    status: 'RESCUED',
    createdAt: new Date(Date.now() - 300 * 60 * 1000).toISOString(),
  },
];

export async function POST() {
  try {
    const admin = getAdminClient();

    // 1. Find all legacy cases with NR- prefix or previous dummy records
    const { data: legacyCases, error: searchError } = await admin
      .from('rescue_requests')
      .select('id, case_number')
      .ilike('case_number', 'NR-%');

    if (searchError) {
      console.error('Error querying legacy cases:', searchError);
    }

    let deletedCount = 0;
    if (legacyCases && legacyCases.length > 0) {
      const idsToDelete = legacyCases.map((c) => c.id);

      // Delete access tokens & events first (if cascade isn't configured)
      await admin.from('rescue_request_access').delete().in('rescue_request_id', idsToDelete);
      await admin.from('rescue_request_events').delete().in('rescue_request_id', idsToDelete);
      await admin.from('rescue_request_photos').delete().in('rescue_request_id', idsToDelete);

      const { error: deleteError } = await admin
        .from('rescue_requests')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('Error deleting legacy records:', deleteError);
      } else {
        deletedCount = idsToDelete.length;
      }
    }

    // 2. Also ensure our new seed case numbers are freshly replaced if they already exist
    const seedCaseNumbers = SEED_CASES.map((s) => s.caseNumber);
    const { data: existingSeeds } = await admin
      .from('rescue_requests')
      .select('id')
      .in('case_number', seedCaseNumbers);

    if (existingSeeds && existingSeeds.length > 0) {
      const existingIds = existingSeeds.map((s) => s.id);
      await admin.from('rescue_request_access').delete().in('rescue_request_id', existingIds);
      await admin.from('rescue_request_events').delete().in('rescue_request_id', existingIds);
      await admin.from('rescue_request_photos').delete().in('rescue_request_id', existingIds);
      await admin.from('rescue_requests').delete().in('id', existingIds);
    }

    // 3. Insert New Style Cases with Numeric IDs and 6-Digit Verification PINs
    const insertedCases = [];
    const errors: Array<{ caseNumber: string; error: unknown }> = [];

    for (const seed of SEED_CASES) {
      const clientRequestId = crypto.randomUUID();

      const { data: newReq, error: insertError } = await admin
        .from('rescue_requests')
        .insert({
          case_number: seed.caseNumber,
          client_request_id: clientRequestId,
          latitude: seed.latitude,
          longitude: seed.longitude,
          location_accuracy: 5,
          location_source: 'GPS',
          location_timestamp: seed.createdAt,
          manual_location_description: seed.locationDescription,
          people_count: seed.peopleCount,
          trapped_status: seed.situation,
          injury_level: seed.injuryLevel,
          disaster_type: seed.disasterType,
          description: seed.description,
          phone_number: seed.phoneNumber,
          priority: seed.priority,
          status: seed.status,
          created_at: seed.createdAt,
          updated_at: seed.createdAt,
        })
        .select('id, case_number, status')
        .single();

      if (insertError || !newReq) {
        errors.push({ caseNumber: seed.caseNumber, error: insertError });
        continue;
      }

      // Hash 6-digit PIN and insert into rescue_request_access
      const tokenHash = hashVerificationToken(seed.pin);
      await admin.from('rescue_request_access').insert({
        rescue_request_id: newReq.id,
        token_hash: tokenHash,
      });

      // Insert audit event
      await admin.from('rescue_request_events').insert({
        rescue_request_id: newReq.id,
        event_type: 'STATUS_CHANGE',
        new_status: seed.status,
        notes: `Sample operational emergency initialized with status ${seed.status}`,
        created_at: seed.createdAt,
      });

      insertedCases.push({
        caseNumber: newReq.case_number,
        pin: seed.pin,
        status: newReq.status,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase legacy NR records deleted and new numeric cases seeded successfully.',
      legacyDeletedCount: deletedCount,
      newCasesSeeded: insertedCases,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error during cleanup & seeding:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error during cleanup and seed' },
      { status: 500 }
    );
  }
}

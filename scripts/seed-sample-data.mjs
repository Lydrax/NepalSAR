import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function hashToken(token) {
  return createHash('sha256').update(token.trim()).digest('hex');
}

async function ensureUserAndProfile({ email, password, fullName, organization, role }) {
  console.log(`Ensuring user: ${email} (${role})...`);
  let userId = null;

  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });

  if (listError) {
    console.error('Error listing users:', listError);
  }

  const existing = listData?.users?.find((u) => u.email === email);
  if (existing) {
    userId = existing.id;
    console.log(`Found existing user ${email} (ID: ${userId}). Updating password...`);
    await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
  } else {
    console.log(`Creating new user ${email}...`);
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });

    if (createError || !newUser.user) {
      console.error(`Failed to create user ${email}:`, createError);
      return null;
    }
    userId = newUser.user.id;
  }

  // Ensure profile row
  const { data: profile, error: fetchProfError } = await admin
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    console.log(`Creating profile for ${email}...`);
    const { error: insError } = await admin.from('profiles').insert({
      id: userId,
      full_name: fullName,
      organization,
      role,
    });
    if (insError) {
      console.error(`Error creating profile for ${email}:`, insError);
    }
  } else {
    console.log(`Updating profile for ${email}...`);
    await admin
      .from('profiles')
      .update({
        full_name: fullName,
        organization,
        role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
  }

  return userId;
}

const SAMPLE_CASES = [
  {
    client_request_id: 'e4a10001-0000-4000-a000-000000000001',
    priority: 'CRITICAL',
    status: 'SUBMITTED',
    people_count: 4,
    trapped_status: 'trapped',
    injury_level: 'serious',
    disaster_type: 'landslide',
    latitude: 27.7885,
    longitude: 85.9012,
    location_accuracy: 15,
    location_source: 'GPS',
    manual_location_description: 'Bahrabise Ward 4, Sindhupalchok near Kodari Highway bridge',
    phone_number: '9841234567',
    description:
      'Urgent: Hillside collapsed onto 2 houses after heavy rainfall. 4 people trapped inside lower floor room with water seepage. 1 person has head injury. Need excavation gear.',
    events: [
      {
        event_type: 'SUBMITTED',
        notes: 'Emergency rescue report received from public citizen via GPS mobile dispatch.',
      },
    ],
  },
  {
    client_request_id: 'e4a10002-0000-4000-a000-000000000002',
    priority: 'CRITICAL',
    status: 'VERIFIED',
    people_count: 3,
    trapped_status: 'stranded',
    injury_level: 'serious',
    disaster_type: 'avalanche',
    latitude: 28.7963,
    longitude: 83.9354,
    location_accuracy: 30,
    location_source: 'MAP',
    manual_location_description: 'Thorong La Pass High Camp, Annapurna Circuit (Altitude: 4,850m)',
    phone_number: '9801987654',
    description:
      'Sudden heavy blizzard and powder snow avalanche blocked descent route. 3 trekkers stranded at tea shelter, one showing signs of severe hypothermia and frostbite. Air evacuation or high-altitude team required.',
    events: [
      {
        event_type: 'SUBMITTED',
        notes: 'Satellite dispatch SOS received.',
      },
      {
        event_type: 'VERIFIED',
        notes: 'Coordinator verified via local lodge owner contact. Weather window closing.',
      },
    ],
  },
  {
    client_request_id: 'e4a10003-0000-4000-a000-000000000003',
    priority: 'HIGH',
    status: 'ASSIGNED',
    people_count: 6,
    trapped_status: 'safe_need_evac',
    injury_level: 'minor',
    disaster_type: 'flood',
    latitude: 27.8300,
    longitude: 85.5800,
    location_accuracy: 20,
    location_source: 'GPS',
    manual_location_description: 'Melamchi Bazaar riverside settlement, near old suspension bridge',
    phone_number: '9865123890',
    description:
      'Melamchi river swollen and overflowing embankment. 6 family members including two elderly citizens took refuge on concrete rooftop. Inundation depth ~1.5 meters on ground floor.',
    events: [
      {
        event_type: 'SUBMITTED',
        notes: 'Flood evacuation request logged.',
      },
      {
        event_type: 'VERIFIED',
        notes: 'Disaster response centre verified flood level with local police post.',
      },
      {
        event_type: 'ASSIGNED',
        notes: 'Assigned to Armed Police Force SAR Team Alpha.',
      },
    ],
  },
  {
    client_request_id: 'e4a10004-0000-4000-a000-000000000004',
    priority: 'HIGH',
    status: 'RESCUER_EN_ROUTE',
    people_count: 2,
    trapped_status: 'trapped',
    injury_level: 'minor',
    disaster_type: 'building_collapse',
    latitude: 27.6710,
    longitude: 85.4298,
    location_accuracy: 10,
    location_source: 'GPS',
    manual_location_description: 'Bhaktapur Durbar Square heritage alley, Taumadhi to Golmadhi path',
    phone_number: '9812345678',
    description:
      'Partial wall collapse of three-story brick structure following tremors. 2 shopkeepers trapped in rear courtyard. Passageway obstructed by timber beams.',
    events: [
      { event_type: 'SUBMITTED', notes: 'Call received from neighbor.' },
      { event_type: 'VERIFIED', notes: 'Bhaktapur Municipal SAR confirmed situation.' },
      { event_type: 'ASSIGNED', notes: 'Urban Search & Rescue squad dispatched.' },
      { event_type: 'RESCUER_EN_ROUTE', notes: 'Vehicle en route with hydraulic cutters and medical kit.' },
    ],
  },
  {
    client_request_id: 'e4a10005-0000-4000-a000-000000000005',
    priority: 'NORMAL',
    status: 'SUBMITTED',
    people_count: 1,
    trapped_status: 'stranded',
    injury_level: 'none',
    disaster_type: 'other',
    disaster_other: 'Lost Hiker',
    latitude: 27.7989,
    longitude: 85.4215,
    location_accuracy: 45,
    location_source: 'GPS',
    manual_location_description: 'Shivapuri National Park, descending trail between Chisapani and Sundarijal',
    phone_number: '9849998877',
    description:
      'Solo hiker mistook side trail during fog before dusk. No injuries, has warm clothing and flashlight, but battery at 18%. Requested directional guidance or patrol rendezvous.',
    events: [
      {
        event_type: 'SUBMITTED',
        notes: 'Hiker submitted GPS coordinates from ridge trail.',
      },
    ],
  },
];

async function seed() {
  console.log('--- Seeding Nepal SAR Database ---');

  // 1. Seed Accounts
  const dispatcherId = await ensureUserAndProfile({
    email: 'dispatcher@nepal-sar.org',
    password: 'NepalSar2026!',
    fullName: 'Prem Bahadur Shrestha',
    organization: 'National Emergency Operations Centre (NEOC)',
    role: 'DISPATCHER',
  });

  const responderId = await ensureUserAndProfile({
    email: 'responder@nepal-sar.org',
    password: 'NepalSar2026!',
    fullName: 'Inspector Anita Thapa',
    organization: 'Armed Police Force Disaster Management Unit',
    role: 'RESPONDER',
  });

  const adminId = await ensureUserAndProfile({
    email: 'admin@nepal-sar.org',
    password: 'NepalSar2026!',
    fullName: 'Col. Bikash Gurung',
    organization: 'Ministry of Home Affairs - Nepal SAR Coordination',
    role: 'ADMIN',
  });

  console.log('\n--- Seeding Sample Emergency Rescue Requests ---');

  const createdCases = [];

  for (const sample of SAMPLE_CASES) {
    // Check if case with client_request_id already exists
    const { data: existing } = await admin
      .from('rescue_requests')
      .select('id, case_number')
      .eq('client_request_id', sample.client_request_id)
      .maybeSingle();

    let caseId = existing?.id;
    let caseNumber = existing?.case_number;

    const assignedTo =
      sample.status === 'ASSIGNED' || sample.status === 'RESCUER_EN_ROUTE' ? responderId : null;

    if (!existing) {
      console.log(`Inserting case: ${sample.disaster_type} (${sample.priority})...`);

      const { data: inserted, error: insertError } = await admin
        .from('rescue_requests')
        .insert({
          client_request_id: sample.client_request_id,
          priority: sample.priority,
          status: sample.status,
          people_count: sample.people_count,
          trapped_status: sample.trapped_status,
          injury_level: sample.injury_level,
          disaster_type: sample.disaster_type,
          disaster_other: sample.disaster_other || null,
          latitude: sample.latitude,
          longitude: sample.longitude,
          location_accuracy: sample.location_accuracy,
          location_source: sample.location_source,
          manual_location_description: sample.manual_location_description,
          phone_number: sample.phone_number,
          description: sample.description,
          assigned_to: assignedTo,
        })
        .select('id, case_number')
        .single();

      if (insertError) {
        console.error('Error inserting rescue request:', insertError);
        continue;
      }
      caseId = inserted.id;
      caseNumber = inserted.case_number;

      // Create access token
      const plainToken = `NRP-${caseNumber?.replace('NR-', '') || randomBytes(6).toString('hex').toUpperCase()}`;
      const tokenHash = hashToken(plainToken);

      await admin.from('rescue_request_access').insert({
        rescue_request_id: caseId,
        token_hash: tokenHash,
      });

      // Insert event audit trail
      for (const ev of sample.events) {
        await admin.from('rescue_request_events').insert({
          rescue_request_id: caseId,
          event_type: ev.event_type,
          notes: ev.notes,
          actor_user_id:
            ev.event_type === 'VERIFIED' || ev.event_type === 'ASSIGNED'
              ? dispatcherId
              : ev.event_type === 'RESCUER_EN_ROUTE'
              ? responderId
              : null,
        });
      }

      createdCases.push({
        caseNumber,
        caseId,
        token: plainToken,
        priority: sample.priority,
        status: sample.status,
        location: sample.manual_location_description,
      });
    } else {
      console.log(`Case already exists: ${caseNumber}`);
      createdCases.push({
        caseNumber,
        caseId,
        priority: sample.priority,
        status: sample.status,
        location: sample.manual_location_description,
      });
    }
  }

  console.log('\n======================================================');
  console.log('✅ SEEDING COMPLETE');
  console.log('======================================================');
  console.log('TEST CREDENTIALS:');
  console.log('1. DISPATCHER:');
  console.log('   Email:    dispatcher@nepal-sar.org');
  console.log('   Password: NepalSar2026!');
  console.log('   Role:     DISPATCHER (can verify, assign, update, and close)');
  console.log('');
  console.log('2. FIELD RESPONDER:');
  console.log('   Email:    responder@nepal-sar.org');
  console.log('   Password: NepalSar2026!');
  console.log('   Role:     RESPONDER (can accept assignment, mark en route & rescued)');
  console.log('');
  console.log('3. ADMIN:');
  console.log('   Email:    admin@nepal-sar.org');
  console.log('   Password: NepalSar2026!');
  console.log('   Role:     ADMIN');
  console.log('======================================================');
  console.log('SAMPLE CASES IN DATABASE:');
  createdCases.forEach((c) => {
    console.log(`• Case: ${c.caseNumber} | [${c.priority}] ${c.status} | Loc: ${c.location}`);
    if (c.token) {
      console.log(`  Private Tracking Token: ${c.token}`);
    }
  });
  console.log('======================================================\n');
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});

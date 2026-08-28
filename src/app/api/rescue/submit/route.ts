import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
import { validateRescueRequestPayload } from '@/lib/validation/rescueRequest';
import { calculateServerPriority } from '@/lib/services/priorityEngine';
import { checkRateLimit } from '@/lib/services/rateLimiter';
import {
  generateVerificationToken,
  generateNumericCaseNumber,
  hashVerificationToken,
} from '@/lib/services/tokenAuth';
import { getAdminClient, SupabaseConfigError } from '@/lib/supabase/admin';
import { RescueCaseStatus } from '@/lib/types/emergency';


interface RequestSummary {
  id: string;
  case_number: string;
  status: RescueCaseStatus;
  created_at: string;
}

export async function POST(req: NextRequest) {
  try {
    // 1. IP / Client Rate Limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous_ip';
    const rateLimit = checkRateLimit(`submit_${ip}`, { windowMs: 60 * 1000, maxRequests: 15 });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please wait a moment before sending another request.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // 2. Parse & Validate Payload
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const validation = validateRescueRequestPayload(body);
    if (!validation.success || !validation.data) {
      return NextResponse.json(
        {
          error: 'Validation failed.',
          details: validation.errors,
        },
        { status: 422 }
      );
    }

    const data = validation.data;

    let adminSupabase;
    try {
      adminSupabase = getAdminClient();
    } catch (error) {
      if (error instanceof SupabaseConfigError) {
        console.error('Supabase configuration error:', error.message);
        return NextResponse.json(
          {
            error:
              'Rescue coordination server is not configured. Your request could not be processed.',
          },
          { status: 503 }
        );
      }
      throw error;
    }

    // 3. Idempotency Check: check if client_request_id already exists
    const { data: existingRequest, error: searchError } = await adminSupabase
      .from('rescue_requests')
      .select('id, case_number, status, created_at')
      .eq('client_request_id', data.clientRequestId)
      .maybeSingle<RequestSummary>();

    if (!searchError && existingRequest) {
      // Idempotent duplicate submission - return existing safe data without creating duplicate
      return NextResponse.json({
        success: true,
        caseNumber: existingRequest.case_number,
        status: existingRequest.status,
        createdAt: existingRequest.created_at,
        isExisting: true,
      });
    }

    // 4. Deterministic Server Priority Calculation
    const serverPriority = calculateServerPriority(data.situation, data.injuryLevel);

    // 5. Generate Easy-to-Remember 6-Digit Verification PIN & Numeric Case ID
    const plainVerificationToken = generateVerificationToken();
    const tokenHash = hashVerificationToken(plainVerificationToken);
    const numericCaseNumber = generateNumericCaseNumber();

    // 6. Insert Request into Database with clean numeric Case ID (no hyphens)
    const { data: insertedRequest, error: insertError } = await adminSupabase
      .from('rescue_requests')
      .insert({
        case_number: numericCaseNumber,
        client_request_id: data.clientRequestId,
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        location_accuracy: data.location.accuracy,
        location_timestamp: data.location.timestamp,
        location_source: data.location.source,
        manual_location_description: data.location.manualDescription || null,
        people_count: data.peopleCount,
        trapped_status: data.situation,
        injury_level: data.injuryLevel,
        disaster_type: data.disasterType,
        disaster_other: data.disasterOther || null,
        description: data.description || null,
        phone_number: data.phoneNumber || null,
        priority: serverPriority,
        status: 'SUBMITTED',
      })
      .select('id, case_number, status, created_at')
      .single<RequestSummary>();


    if (insertError || !insertedRequest) {
      // Check if duplicate race occurred
      if (insertError?.code === '23505') {
        const { data: raceExisting } = await adminSupabase
          .from('rescue_requests')
          .select('id, case_number, status, created_at')
          .eq('client_request_id', data.clientRequestId)
          .single<RequestSummary>();

        if (raceExisting) {
          return NextResponse.json({
            success: true,
            caseNumber: raceExisting.case_number,
            status: raceExisting.status,
            createdAt: raceExisting.created_at,
            isExisting: true,
          });
        }
      }

      console.error('Database insert error:', insertError?.message);
      return NextResponse.json(
        {
          error: "We couldn't submit your request yet. Please retry in a moment.",
        },
        { status: 500 }
      );
    }

    // 8. Store SHA-256 Token Hash for Dual-Credential Public Verification
    await adminSupabase.from('rescue_request_access').insert({
      rescue_request_id: insertedRequest.id,
      token_hash: tokenHash,
    });

    // 9. Append Initial Immutable Audit Event
    await adminSupabase.from('rescue_request_events').insert({
      rescue_request_id: insertedRequest.id,
      event_type: 'SUBMITTED',
      new_status: 'SUBMITTED',
      notes: `Request received from public submission. Triage priority calculated as ${serverPriority}.`,
    });

    // 10. Return strictly safe payload
    return NextResponse.json(
      {
        success: true,
        caseNumber: insertedRequest.case_number,
        verificationToken: plainVerificationToken,
        status: insertedRequest.status,
        createdAt: insertedRequest.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      console.error('Supabase configuration error:', error.message);
      return NextResponse.json(
        {
          error:
            'Rescue coordination server is not configured. Your request could not be processed.',
        },
        { status: 503 }
      );
    }

    console.error('Unhandled submission error:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while processing your emergency request. Please retry.',
      },
      { status: 500 }
    );
  }
}

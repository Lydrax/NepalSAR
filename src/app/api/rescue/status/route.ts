import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
import { hashVerificationToken } from '@/lib/services/tokenAuth';
import { checkRateLimit } from '@/lib/services/rateLimiter';
import { getAdminClient } from '@/lib/supabase/admin';
import { RescueCaseStatus } from '@/lib/types/emergency';

export async function POST(req: NextRequest) {
  try {
    // 1. Basic Rate Limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous_ip';
    const rateLimit = checkRateLimit(`status_${ip}`, { windowMs: 60 * 1000, maxRequests: 30 });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many status check requests. Please try again in a few seconds.' },
        { status: 429 }
      );
    }

    // 2. Parse payload
    let body: { caseNumber?: string; verificationToken?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON body.' }, { status: 400 });
    }

    const rawCaseNumber = body.caseNumber?.trim() || '';
    const rawToken = body.verificationToken?.toString().trim() || '';

    if (!rawCaseNumber || !rawToken) {
      return NextResponse.json(
        { error: 'Both Case ID and Verification PIN are required.' },
        { status: 400 }
      );
    }

    // Clean inputs: strip hyphens, spaces, and non-alphanumerics for easy typing
    const cleanCaseNumber = rawCaseNumber.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
    const tokenHash = hashVerificationToken(rawToken);
    const adminSupabase = getAdminClient();

    // 3. Find matching request (try clean case number, original input, or dash variations)
    let requestRecord: {
      id: string;
      case_number: string;
      status: RescueCaseStatus;
      created_at: string;
      updated_at: string;
    } | null = null;

    // First query attempt: exact or clean case number
    const { data: exactMatch } = await adminSupabase
      .from('rescue_requests')
      .select('id, case_number, status, created_at, updated_at')
      .or(`case_number.eq.${cleanCaseNumber},case_number.eq.${rawCaseNumber}`)
      .limit(1)
      .maybeSingle<{
        id: string;
        case_number: string;
        status: RescueCaseStatus;
        created_at: string;
        updated_at: string;
      }>();

    requestRecord = exactMatch;

    // Fallback: If entered as legacy NR-YYYY-XXXXXX or numeric equivalent
    if (!requestRecord && cleanCaseNumber.startsWith('NR') && cleanCaseNumber.length >= 10) {
      const formatted = `NR-${cleanCaseNumber.slice(2, 6)}-${cleanCaseNumber.slice(6)}`;
      const { data: legacyMatch } = await adminSupabase
        .from('rescue_requests')
        .select('id, case_number, status, created_at, updated_at')
        .eq('case_number', formatted)
        .limit(1)
        .maybeSingle<{
          id: string;
          case_number: string;
          status: RescueCaseStatus;
          created_at: string;
          updated_at: string;
        }>();
      requestRecord = legacyMatch;
    }

    if (!requestRecord) {
      // Uniform generic message to prevent case ID enumeration
      return NextResponse.json(
        { error: 'Unable to verify this request. Please check your Case ID and Verification PIN.' },
        { status: 404 }
      );
    }


    // 4. Verify token hash
    const { data: accessRecord, error: accessError } = await adminSupabase
      .from('rescue_request_access')
      .select('id')
      .eq('rescue_request_id', requestRecord.id)
      .eq('token_hash', tokenHash)
      .maybeSingle<{ id: string }>();

    if (accessError || !accessRecord) {
      // Uniform generic message to prevent token probing
      return NextResponse.json(
        { error: 'Unable to verify this request. Please check your Case ID and Verification PIN.' },
        { status: 404 }
      );
    }

    // 5. Return strictly safe public response data
    return NextResponse.json({
      success: true,
      caseNumber: requestRecord.case_number,
      status: requestRecord.status,
      submittedAt: requestRecord.created_at,
      lastUpdatedAt: requestRecord.updated_at,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Unable to retrieve case status. Please retry later.' },
      { status: 500 }
    );
  }
}

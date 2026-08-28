import { NextRequest, NextResponse } from 'next/server';
import { validateResponderAuth } from '@/lib/services/responderAuth';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authorize Responder
    const auth = await validateResponderAuth(req);
    if (!auth.authorized || !auth.responder) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Case ID parameter is required.' }, { status: 400 });
    }

    const adminSupabase = getAdminClient();

    // 2. Fetch full case detail (including phone number & description for authorized responder)
    const { data: caseRecord, error: caseError } = await adminSupabase
      .from('rescue_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (caseError || !caseRecord) {
      return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    }

    // 3. Fetch assigned responder profile details if assigned
    let assignedResponderInfo = null;
    if (caseRecord.assigned_to) {
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('id, full_name, organization, role')
        .eq('id', caseRecord.assigned_to)
        .maybeSingle();
      if (profile) {
        assignedResponderInfo = profile;
      }
    }

    // 4. Fetch full chronological audit history
    const { data: auditEvents } = await adminSupabase
      .from('rescue_request_events')
      .select('id, created_at, actor_user_id, event_type, old_status, new_status, notes')
      .eq('rescue_request_id', id)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      success: true,
      case: {
        ...caseRecord,
        assignedResponderInfo,
        auditHistory: auditEvents || [],
      },
    });
  } catch (error) {
    console.error('Responder case detail error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

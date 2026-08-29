import { NextRequest, NextResponse } from 'next/server';
import { validateResponderAuth } from '@/lib/services/responderAuth';
import { isValidStateTransition } from '@/lib/services/stateMachine';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const auth = await validateResponderAuth(req);
    if (!auth.authorized || !auth.responder) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
    }

    let body: { caseId?: string; notes?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const { caseId, notes } = body;
    if (!caseId) {
      return NextResponse.json({ error: 'caseId is required.' }, { status: 400 });
    }

    const adminSupabase = getAdminClient();

    // 1. Fetch current case
    const { data: currentCase, error: fetchError } = await adminSupabase
      .from('rescue_requests')
      .select('id, status, case_number')
      .eq('id', caseId)
      .maybeSingle();

    if (fetchError || !currentCase) {
      return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    }

    // 2. Validate State Transition: SUBMITTED -> VERIFIED
    if (!isValidStateTransition(currentCase.status, 'VERIFIED')) {
      return NextResponse.json(
        {
          error: `Invalid transition: Cannot verify a case in status [${currentCase.status}]. Please refresh.`,
        },
        { status: 409 }
      );
    }

    // 3. Update Status
    const { data: updatedCase, error: updateError } = await adminSupabase
      .from('rescue_requests')
      .update({
        status: 'VERIFIED',
      })
      .eq('id', caseId)
      .eq('status', currentCase.status) // Optimistic locking guard
      .select('id, case_number, status, updated_at')
      .single();

    if (updateError || !updatedCase) {
      return NextResponse.json(
        { error: 'This case has been updated by another responder. Please refresh.' },
        { status: 409 }
      );
    }

    // 4. Record Immutable Audit Event
    await adminSupabase.from('rescue_request_events').insert({
      rescue_request_id: caseId,
      actor_user_id: auth.responder.userId,
      event_type: 'REQUEST_VERIFIED',
      old_status: currentCase.status,
      new_status: 'VERIFIED',
      notes: notes
        ? `Verified by ${auth.responder.fullName} (${auth.responder.role}): ${notes.trim()}`
        : `Verified by ${auth.responder.fullName} (${auth.responder.role})`,
    });

    return NextResponse.json({
      success: true,
      case: updatedCase,
    });
  } catch (error) {
    console.error('Verify case error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

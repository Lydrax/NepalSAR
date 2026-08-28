import { NextRequest, NextResponse } from 'next/server';

import { validateResponderAuth } from '@/lib/services/responderAuth';
import { isValidStateTransition } from '@/lib/services/stateMachine';
import { getAdminClient } from '@/lib/supabase/admin';
import { Database } from '@/lib/supabase/types';
import { RescueCaseStatus } from '@/lib/types/emergency';

export async function POST(req: NextRequest) {
  try {
    const auth = await validateResponderAuth(req);
    if (!auth.authorized || !auth.responder) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
    }

    let body: { caseId?: string; targetStatus?: RescueCaseStatus; notes?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const { caseId, targetStatus, notes } = body;
    if (!caseId || !targetStatus) {
      return NextResponse.json(
        { error: 'caseId and targetStatus are required.' },
        { status: 400 }
      );
    }

    const adminSupabase = getAdminClient();

    // 1. Fetch current case
    const { data: currentCase, error: fetchError } = await adminSupabase
      .from('rescue_requests')
      .select('id, status, assigned_to, case_number')
      .eq('id', caseId)
      .maybeSingle();

    if (fetchError || !currentCase) {
      return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    }

    // 2. Authorization check:
    // Closing a case requires Dispatcher or Admin role
    if (targetStatus === 'CLOSED' && auth.responder.role === 'RESPONDER') {
      return NextResponse.json(
        { error: 'Closing a case requires Dispatcher or Admin authorization.' },
        { status: 403 }
      );
    }

    // 3. State Transition Validation
    if (!isValidStateTransition(currentCase.status, targetStatus)) {
      return NextResponse.json(
        {
          error: `Invalid transition: Cannot transition from [${currentCase.status}] to [${targetStatus}]. Please refresh.`,
        },
        { status: 409 }
      );
    }

    // 4. Update Status with Optimistic Concurrency Guard
    const updatePayload: Database['public']['Tables']['rescue_requests']['Update'] = {
      status: targetStatus,
    };

    if (targetStatus === 'CLOSED') {
      updatePayload.resolved_at = new Date().toISOString();
    }

    const { data: updatedCase, error: updateError } = await adminSupabase
      .from('rescue_requests')
      .update(updatePayload)
      .eq('id', caseId)
      .eq('status', currentCase.status) // Concurrency check
      .select('id, case_number, status, resolved_at, updated_at')
      .single();

    if (updateError || !updatedCase) {
      return NextResponse.json(
        { error: 'This case has been updated by another responder. Please refresh.' },
        { status: 409 }
      );
    }

    // 5. Record Immutable Audit Event
    const eventTypeMap: Record<RescueCaseStatus, string> = {
      SUBMITTED: 'REQUEST_SUBMITTED',
      VERIFIED: 'REQUEST_VERIFIED',
      ASSIGNED: 'CASE_ASSIGNED',
      RESCUER_EN_ROUTE: 'RESCUER_EN_ROUTE',
      RESCUED: 'RESCUE_COMPLETED',
      CLOSED: 'CASE_CLOSED',
      CANCELLED: 'REQUEST_CANCELLED',
    };

    await adminSupabase.from('rescue_request_events').insert({
      rescue_request_id: caseId,
      actor_user_id: auth.responder.userId,
      event_type: eventTypeMap[targetStatus] || 'STATUS_CHANGED',
      old_status: currentCase.status,
      new_status: targetStatus,
      notes: notes
        ? `${targetStatus} marked by ${auth.responder.fullName} (${auth.responder.role}): ${notes.trim()}`
        : `${targetStatus} marked by ${auth.responder.fullName} (${auth.responder.role})`,
    });

    return NextResponse.json({
      success: true,
      case: updatedCase,
    });
  } catch (error) {
    console.error('Status transition error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

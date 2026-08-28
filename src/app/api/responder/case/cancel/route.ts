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

    let body: {
      caseId?: string;
      reasonType?: 'duplicate' | 'false_report' | 'no_longer_needed' | 'other';
      reasonDetails?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const { caseId, reasonType, reasonDetails } = body;
    if (!caseId || !reasonType) {
      return NextResponse.json(
        { error: 'caseId and reasonType are mandatory for controlled cancellation.' },
        { status: 400 }
      );
    }

    const adminSupabase = getAdminClient();

    const { data: currentCase, error: fetchError } = await adminSupabase
      .from('rescue_requests')
      .select('id, status, case_number')
      .eq('id', caseId)
      .maybeSingle();

    if (fetchError || !currentCase) {
      return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    }

    if (!isValidStateTransition(currentCase.status, 'CANCELLED')) {
      return NextResponse.json(
        { error: `Cannot cancel a case in status [${currentCase.status}].` },
        { status: 409 }
      );
    }

    const { data: updatedCase, error: updateError } = await adminSupabase
      .from('rescue_requests')
      .update({ status: 'CANCELLED' })
      .eq('id', caseId)
      .eq('status', currentCase.status)
      .select('id, case_number, status, updated_at')
      .single();

    if (updateError || !updatedCase) {
      return NextResponse.json(
        { error: 'This case has been updated by another user. Please refresh.' },
        { status: 409 }
      );
    }

    // Append Audit Event with cancellation reason
    const reasonText = `Reason: [${reasonType}] ${reasonDetails ? `- ${reasonDetails.trim()}` : ''}`;
    await adminSupabase.from('rescue_request_events').insert({
      rescue_request_id: caseId,
      actor_user_id: auth.responder.userId,
      event_type: 'REQUEST_CANCELLED',
      old_status: currentCase.status,
      new_status: 'CANCELLED',
      notes: `Cancelled by ${auth.responder.fullName} (${auth.responder.role}). ${reasonText}`,
    });

    return NextResponse.json({
      success: true,
      case: updatedCase,
    });
  } catch (error) {
    console.error('Cancel case error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

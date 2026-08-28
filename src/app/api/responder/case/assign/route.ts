import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

import { validateResponderAuth } from '@/lib/services/responderAuth';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const auth = await validateResponderAuth(req);
    if (!auth.authorized || !auth.responder) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
    }

    let body: { caseId?: string; assignToUserId?: string; notes?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const { caseId, assignToUserId, notes } = body;
    if (!caseId) {
      return NextResponse.json({ error: 'caseId is required.' }, { status: 400 });
    }

    // Determine target assignee
    let targetAssigneeId = auth.responder.userId;
    let targetAssigneeName = auth.responder.fullName;

    // If assigning to someone else, user must be DISPATCHER or ADMIN
    if (assignToUserId && assignToUserId !== auth.responder.userId) {
      if (auth.responder.role !== 'DISPATCHER' && auth.responder.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Only Dispatchers and Admins can assign cases to other responders.' },
          { status: 403 }
        );
      }
      targetAssigneeId = assignToUserId;
    }

    const adminSupabase = getAdminClient();

    // Verify target assignee profile exists
    const { data: targetProfile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, full_name, organization, role')
      .eq('id', targetAssigneeId)
      .maybeSingle();

    if (profileError || !targetProfile) {
      return NextResponse.json({ error: 'Target responder profile not found.' }, { status: 404 });
    }
    targetAssigneeName = targetProfile.full_name;

    // 1. Fetch current case
    const { data: currentCase, error: fetchError } = await adminSupabase
      .from('rescue_requests')
      .select('id, status, assigned_to, case_number')
      .eq('id', caseId)
      .maybeSingle();

    if (fetchError || !currentCase) {
      return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    }

    // Check if already assigned (Concurrency race protection)
    if (currentCase.assigned_to && currentCase.status === 'ASSIGNED') {
      if (auth.responder.role === 'RESPONDER') {
        return NextResponse.json(
          { error: 'This case has already been assigned.' },
          { status: 409 }
        );
      }
    }

    // 2. Validate state transition: VERIFIED -> ASSIGNED (or reassigning in ASSIGNED status)
    if (currentCase.status !== 'VERIFIED' && currentCase.status !== 'ASSIGNED') {
      return NextResponse.json(
        {
          error: `Invalid transition: Case is in status [${currentCase.status}]. Must be VERIFIED to assign.`,
        },
        { status: 409 }
      );
    }

    // 3. Atomic Assignment Update with optimistic concurrency lock
    let updateQuery = adminSupabase
      .from('rescue_requests')
      .update({
        status: 'ASSIGNED',
        assigned_to: targetAssigneeId,
      })
      .eq('id', caseId);

    // If normal responder self-claiming, enforce that it was still unassigned/VERIFIED
    if (auth.responder.role === 'RESPONDER') {
      updateQuery = updateQuery.eq('status', 'VERIFIED');
    }

    const { data: updatedCase, error: updateError } = await updateQuery
      .select('id, case_number, status, assigned_to, updated_at')
      .single();

    if (updateError || !updatedCase) {
      return NextResponse.json(
        { error: 'This case has already been assigned or modified by another responder.' },
        { status: 409 }
      );
    }

    // 4. Record Immutable Audit Event
    await adminSupabase.from('rescue_request_events').insert({
      rescue_request_id: caseId,
      actor_user_id: auth.responder.userId,
      event_type: 'CASE_ASSIGNED',
      old_status: currentCase.status,
      new_status: 'ASSIGNED',
      notes: `Assigned to ${targetAssigneeName} (${targetProfile.organization || 'SAR Agency'}) by ${auth.responder.fullName}.${notes ? ` Notes: ${notes.trim()}` : ''}`,
    });

    return NextResponse.json({
      success: true,
      case: updatedCase,
      assignedTo: targetProfile,
    });
  } catch (error) {
    console.error('Assign case error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

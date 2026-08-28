import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

import { validateResponderAuth } from '@/lib/services/responderAuth';
import { getAdminClient } from '@/lib/supabase/admin';
import { PriorityLevel } from '@/lib/types/emergency';

export async function POST(req: NextRequest) {
  try {
    // Only Dispatchers and Admins can modify triage priority
    const auth = await validateResponderAuth(req, ['DISPATCHER', 'ADMIN']);
    if (!auth.authorized || !auth.responder) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 403 });
    }

    let body: { caseId?: string; newPriority?: PriorityLevel; reason?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const { caseId, newPriority, reason } = body;
    if (!caseId || !newPriority) {
      return NextResponse.json({ error: 'caseId and newPriority are required.' }, { status: 400 });
    }

    if (!['CRITICAL', 'HIGH', 'NORMAL'].includes(newPriority)) {
      return NextResponse.json({ error: 'Invalid priority level.' }, { status: 400 });
    }

    const adminSupabase = getAdminClient();

    const { data: currentCase, error: fetchError } = await adminSupabase
      .from('rescue_requests')
      .select('id, priority, case_number')
      .eq('id', caseId)
      .maybeSingle();

    if (fetchError || !currentCase) {
      return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
    }

    const oldPriority = currentCase.priority;

    const { data: updatedCase, error: updateError } = await adminSupabase
      .from('rescue_requests')
      .update({ priority: newPriority })
      .eq('id', caseId)
      .select('id, case_number, priority, updated_at')
      .single();

    if (updateError || !updatedCase) {
      return NextResponse.json({ error: 'Failed to update priority.' }, { status: 500 });
    }

    // Append Immutable Audit Event
    await adminSupabase.from('rescue_request_events').insert({
      rescue_request_id: caseId,
      actor_user_id: auth.responder.userId,
      event_type: 'PRIORITY_CHANGED',
      notes: `Priority changed from ${oldPriority} to ${newPriority} by ${auth.responder.fullName} (${auth.responder.role}). Reason: ${reason?.trim() || 'Operational reassessment'}`,
    });

    return NextResponse.json({
      success: true,
      case: updatedCase,
    });
  } catch (error) {
    console.error('Update priority error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

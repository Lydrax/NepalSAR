import { NextRequest, NextResponse } from 'next/server';
import { validateResponderAuth } from '@/lib/services/responderAuth';
import { getAdminClient } from '@/lib/supabase/admin';
import { PriorityLevel, RescueCaseStatus } from '@/lib/types/emergency';

export async function GET(req: NextRequest) {
  try {
    // 1. Authorize Responder
    const auth = await validateResponderAuth(req);
    if (!auth.authorized || !auth.responder) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
    }

    const { searchParams } = new URL(req.url);
    const priorityFilter = searchParams.get('priority'); // 'ALL' | 'CRITICAL' | 'HIGH' | 'NORMAL'
    const statusFilter = searchParams.get('status'); // 'ACTIVE' | 'ALL' | specific status

    const adminSupabase = getAdminClient();

    // Build query for operational queue
    let query = adminSupabase
      .from('rescue_requests')
      .select(
        'id, case_number, priority, status, people_count, trapped_status, injury_level, disaster_type, disaster_other, latitude, longitude, location_accuracy, location_source, manual_location_description, assigned_to, created_at, updated_at'
      );

    // Apply Status Filter
    if (!statusFilter || statusFilter === 'ACTIVE') {
      query = query.in('status', ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'RESCUER_EN_ROUTE']);
    } else if (statusFilter !== 'ALL') {
      query = query.eq('status', statusFilter as RescueCaseStatus);
    }

    // Apply Priority Filter
    if (priorityFilter && priorityFilter !== 'ALL') {
      query = query.eq('priority', priorityFilter as PriorityLevel);
    }

    // Order: Priority (CRITICAL -> HIGH -> NORMAL) handled in sorting, and oldest first
    const { data: rawCases, error: queryError } = await query.order('created_at', { ascending: true });

    if (queryError) {
      console.error('Error fetching responder cases:', queryError.message);
      return NextResponse.json({ error: 'Failed to retrieve cases.' }, { status: 500 });
    }

    // Sort order: CRITICAL -> HIGH -> NORMAL, within each priority oldest first
    const priorityWeight: Record<PriorityLevel, number> = {
      CRITICAL: 1,
      HIGH: 2,
      NORMAL: 3,
    };

    const sortedCases = (rawCases || []).sort((a, b) => {
      const weightA = priorityWeight[a.priority as PriorityLevel] || 99;
      const weightB = priorityWeight[b.priority as PriorityLevel] || 99;

      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    return NextResponse.json({
      success: true,
      cases: sortedCases,
      total: sortedCases.length,
    });
  } catch (error) {
    console.error('Responder cases route error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

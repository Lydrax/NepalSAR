import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

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
    const statusFilter = searchParams.get('status'); // 'ACTIVE' | 'CLOSED_DIRECTORY' | 'CLOSED' | 'CANCELLED' | 'ALL' | specific status
    const searchTerm = searchParams.get('search')?.trim().toLowerCase();

    const adminSupabase = getAdminClient();

    // 2. Fetch summary counts for both Active and Closed directories
    const { data: allStatusCounts } = await adminSupabase
      .from('rescue_requests')
      .select('status');

    let activeCount = 0;
    let closedCount = 0;
    if (allStatusCounts) {
      for (const item of allStatusCounts) {
        if (['CLOSED', 'CANCELLED'].includes(item.status)) {
          closedCount++;
        } else {
          activeCount++;
        }
      }
    }

    // 3. Build query for operational queue or closed directory
    let query = adminSupabase
      .from('rescue_requests')
      .select(
        'id, case_number, priority, status, people_count, trapped_status, injury_level, disaster_type, disaster_other, latitude, longitude, location_accuracy, location_source, manual_location_description, description, phone_number, assigned_to, created_at, updated_at, resolved_at'
      );

    const isClosedDirectory = statusFilter === 'CLOSED_DIRECTORY' || statusFilter === 'CLOSED' || statusFilter === 'CANCELLED';

    // Apply Status Filter
    if (statusFilter === 'CLOSED_DIRECTORY') {
      query = query.in('status', ['CLOSED', 'CANCELLED']);
    } else if (statusFilter === 'CLOSED') {
      query = query.eq('status', 'CLOSED');
    } else if (statusFilter === 'CANCELLED') {
      query = query.eq('status', 'CANCELLED');
    } else if (['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'RESCUER_EN_ROUTE', 'RESCUED'].includes(statusFilter || '')) {
      query = query.eq('status', statusFilter as RescueCaseStatus);
    } else {
      // Active queue default (or 'ALL' / 'ALL_ACTIVE'): Strictly active cases only, excluding CLOSED and CANCELLED
      query = query.in('status', ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'RESCUER_EN_ROUTE', 'RESCUED']);
    }

    // Apply Priority Filter
    if (priorityFilter && priorityFilter !== 'ALL') {
      query = query.eq('priority', priorityFilter as PriorityLevel);
    }

    // Ordering
    const orderColumn = isClosedDirectory ? 'updated_at' : 'created_at';
    const isAscending = !isClosedDirectory; // Closed directory shows newest updates first, active queue shows oldest first
    const { data: rawCases, error: queryError } = await query.order(orderColumn, { ascending: isAscending });

    if (queryError) {
      console.error('Error fetching responder cases:', queryError.message);
      return NextResponse.json({ error: 'Failed to retrieve cases.' }, { status: 500 });
    }

    let filteredCases = rawCases || [];

    // Apply text search if requested
    if (searchTerm && searchTerm.length > 0) {
      filteredCases = filteredCases.filter((c) => {
        const caseNum = (c.case_number || '').toLowerCase();
        const desc = (c.description || '').toLowerCase();
        const locDesc = (c.manual_location_description || '').toLowerCase();
        const disaster = (c.disaster_type || '').toLowerCase();
        const phone = (c.phone_number || '').toLowerCase();
        return (
          caseNum.includes(searchTerm) ||
          desc.includes(searchTerm) ||
          locDesc.includes(searchTerm) ||
          disaster.includes(searchTerm) ||
          phone.includes(searchTerm)
        );
      });
    }

    // Sort order for active cases: CRITICAL -> HIGH -> NORMAL, within each priority oldest first
    let sortedCases = filteredCases;
    if (!isClosedDirectory) {
      const priorityWeight: Record<PriorityLevel, number> = {
        CRITICAL: 1,
        HIGH: 2,
        NORMAL: 3,
      };

      sortedCases = [...filteredCases].sort((a, b) => {
        const weightA = priorityWeight[a.priority as PriorityLevel] || 99;
        const weightB = priorityWeight[b.priority as PriorityLevel] || 99;

        if (weightA !== weightB) {
          return weightA - weightB;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    } else {
      // Closed cases: sorted by updated_at / resolved_at descending
      sortedCases = [...filteredCases].sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA;
      });
    }

    return NextResponse.json({
      success: true,
      cases: sortedCases,
      total: sortedCases.length,
      activeCount,
      closedCount,
    });
  } catch (error) {
    console.error('Responder cases route error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

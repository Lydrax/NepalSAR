import { NextResponse } from 'next/server';

export const runtime = 'edge';

import { getAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  try {
    const admin = getAdminClient();

    // 1. Try invoking the stored database RPC if configured
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (admin as any).rpc('purge_all_rescue_requests');

    if (!rpcError) {
      return NextResponse.json({
        success: true,
        message: `Database cleaned successfully via RPC. Removed records.`,
        purgedCount: rpcResult,
      });
    }

    // 2. If RPC is not present, fetch all rescue request IDs and purge child access records & requests
    const { data: allRequests, error: fetchErr } = await admin
      .from('rescue_requests')
      .select('id, case_number');

    if (fetchErr) {
      console.error('Error fetching rescue requests for purge:', fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const totalFound = allRequests?.length || 0;
    const requestIds = (allRequests || []).map((r) => r.id);

    if (requestIds.length > 0) {
      // Delete child records in tables that permit deletion
      await admin.from('rescue_request_access').delete().in('rescue_request_id', requestIds);
      await admin.from('rescue_request_photos').delete().in('rescue_request_id', requestIds);

      // Attempt deletion on rescue_requests
      const { error: deleteRequestsErr } = await admin
        .from('rescue_requests')
        .delete()
        .in('id', requestIds);

      if (deleteRequestsErr) {
        console.error('Direct deletion error:', deleteRequestsErr);
        return NextResponse.json({
          success: false,
          error: deleteRequestsErr.message,
          suggestion: 'If immutable audit trigger is preventing CASCADE delete, run migration /supabase/migrations/20260828000004_purge_dummy_data_rpc.sql in your Supabase SQL editor.',
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Database cleaned successfully. Removed ${totalFound} dummy/test rescue records.`,
      purgedCount: totalFound,
    });
  } catch (error) {
    console.error('Error in clear-all route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear database records' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

import { validateResponderAuth } from '@/lib/services/responderAuth';

export async function GET(req: NextRequest) {
  try {
    const auth = await validateResponderAuth(req);
    if (!auth.authorized || !auth.responder) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
    }

    return NextResponse.json({
      id: auth.responder.userId,
      full_name: auth.responder.fullName,
      organization: auth.responder.organization,
      role: auth.responder.role,
      email: auth.responder.email,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

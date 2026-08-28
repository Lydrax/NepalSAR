import { NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ResponderRole } from '@/lib/types/emergency';

export interface AuthenticatedResponder {
  userId: string;
  email: string;
  fullName: string;
  organization: string | null;
  role: ResponderRole;
}

export interface AuthValidationResult {
  authorized: boolean;
  responder?: AuthenticatedResponder;
  error?: string;
  statusCode?: number;
}

/**
 * Validates that an incoming HTTP request is authenticated and authorized
 * as an active Search & Rescue responder, dispatcher, or admin.
 */
export async function validateResponderAuth(
  req: NextRequest,
  requiredRoles: ResponderRole[] = ['RESPONDER', 'DISPATCHER', 'ADMIN']
): Promise<AuthValidationResult> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
      statusCode: 401,
    };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return {
      authorized: false,
      error: 'Empty or malformed authorization token.',
      statusCode: 401,
    };
  }

  const adminSupabase = getAdminClient();

  // 1. Verify User Session with Supabase Auth
  const { data: userData, error: userError } = await adminSupabase.auth.getUser(token);
  if (userError || !userData.user) {
    return {
      authorized: false,
      error: 'Invalid or expired session. Please log in again.',
      statusCode: 401,
    };
  }

  const user = userData.user;

  // 2. Verify Profile and Active Responder Role
  let { data: profile } = await adminSupabase
    .from('profiles')
    .select('id, full_name, organization, role')
    .eq('id', user.id)
    .maybeSingle<{
      id: string;
      full_name: string;
      organization: string | null;
      role: ResponderRole;
    }>();

  // If user is validly authenticated in Supabase Auth but profile record is not yet created,
  // auto-initialize profile using user metadata or email defaults
  if (!profile) {
    const rawRole = (user.user_metadata?.role as ResponderRole) || 'DISPATCHER';
    const validRoles: ResponderRole[] = ['ADMIN', 'DISPATCHER', 'RESPONDER'];
    const cleanRole: ResponderRole = validRoles.includes(rawRole) ? rawRole : 'DISPATCHER';
    const emailPrefix = user.email ? user.email.split('@')[0] : 'Officer';
    const defaultName =
      (user.user_metadata?.full_name as string) ||
      emailPrefix.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const defaultOrg = (user.user_metadata?.organization as string) || 'National SAR Operations';

    const { data: createdProfile } = await adminSupabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: defaultName,
        organization: defaultOrg,
        role: cleanRole,
      })
      .select('id, full_name, organization, role')
      .maybeSingle<{
        id: string;
        full_name: string;
        organization: string | null;
        role: ResponderRole;
      }>();

    if (createdProfile) {
      profile = createdProfile;
    }
  }

  if (!profile) {
    return {
      authorized: false,
      error: 'Access denied: No authorized responder profile associated with this account.',
      statusCode: 403,
    };
  }

  // 3. Role-Based Permission Check
  if (!requiredRoles.includes(profile.role)) {
    return {
      authorized: false,
      error: `Access denied: Action requires role [${requiredRoles.join(', ')}], current role is [${profile.role}].`,
      statusCode: 403,
    };
  }

  return {
    authorized: true,
    responder: {
      userId: user.id,
      email: user.email || '',
      fullName: profile.full_name,
      organization: profile.organization,
      role: profile.role,
    },
  };
}

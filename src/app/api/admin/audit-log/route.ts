import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth/admin';

/**
 * GET /api/admin/audit-log
 * View super admin audit log entries. Super admin only.
 *
 * Query params:
 *   - limit: number (default 50)
 *   - offset: number (default 0)
 *   - tenant_id: filter by specific tenant
 *   - action: filter by action type
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const { adminSupabase } = auth;

        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
        const offset = parseInt(searchParams.get('offset') || '0');
        const tenantFilter = searchParams.get('tenant_id');
        const actionFilter = searchParams.get('action');

        let query = adminSupabase
            .from('super_admin_audit_log')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (tenantFilter) {
            query = query.eq('target_tenant_id', tenantFilter);
        }
        if (actionFilter) {
            query = query.eq('action', actionFilter);
        }

        const { data: entries, count, error } = await query;

        if (error) {
            console.error('Audit log error:', error);
            return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
        }

        return NextResponse.json({
            entries: entries || [],
            total: count || 0,
            limit,
            offset,
        });
    } catch (error) {
        console.error('Audit log API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
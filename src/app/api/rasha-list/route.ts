import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rashaListSchema, RashaListFormData } from '@/lib/validations/rasha-list';

export async function GET(_req: NextRequest) {
  // STANDARD: Always join to public.users for created_by/updated_by for all entity APIs
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Fetch all rasha_list items
  const { data, error } = await supabase
    .from('rasha_list')
    .select('*')
    .order('rasha_list_id', { ascending: true });
    
  if (error) {
    console.error('Error fetching rasha_list:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Fetch user emails for created_by and updated_by
  const userIds = new Set<string>();
  (data || []).forEach(item => {
    if (item.created_by) userIds.add(item.created_by);
    if (item.updated_by) userIds.add(item.updated_by);
  });
  
  let userMap = new Map<string, { email: string; full_name: string | null }>();
  if (userIds.size > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('id', Array.from(userIds));
    
    (users || []).forEach(u => {
      userMap.set(u.id, { email: u.email, full_name: u.full_name });
    });
  }
  
  // Map to flat fields for frontend
  const mapped = (data || []).map(item => ({
    ...item,
    created_by_email: item.created_by ? (userMap.get(item.created_by)?.email || null) : null,
    created_by_full_name: item.created_by ? (userMap.get(item.created_by)?.full_name || null) : null,
    updated_by_email: item.updated_by ? (userMap.get(item.updated_by)?.email || null) : null,
    updated_by_full_name: item.updated_by ? (userMap.get(item.updated_by)?.full_name || null) : null,
  }));
  
  return NextResponse.json({ data: mapped }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: RashaListFormData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parse = rashaListSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('rasha_list')
    .insert([parse.data])
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}


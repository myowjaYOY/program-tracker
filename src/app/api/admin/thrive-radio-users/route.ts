import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function generatePassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (userError || !user?.is_admin) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error: NextResponse.json(
        { error: 'Server configuration error: Missing service role key' },
        { status: 500 }
      ),
    };
  }

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  return { supabase, adminSupabase, session };
}

export async function GET() {
  try {
    const ctx = await getAdminContext();
    if ('error' in ctx && ctx.error) return ctx.error;
    const { adminSupabase } = ctx;

    const { data: profiles, error } = await adminSupabase
      .schema('thrive_radio')
      .from('profiles')
      .select('*');

    if (error) {
      console.error('Error fetching thrive_radio profiles:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profiles' },
        { status: 500 }
      );
    }

    const { data: loginEvents } = await adminSupabase
      .schema('thrive_radio')
      .from('auth_events')
      .select('user_id, created_at')
      .eq('event_type', 'login')
      .order('created_at', { ascending: false });

    const loginMap = new Map<string, string | null>();
    for (const evt of loginEvents || []) {
      if (!loginMap.has(evt.user_id)) {
        loginMap.set(evt.user_id, evt.created_at);
      }
    }

    const enriched = (profiles || []).map((p: Record<string, unknown>) => ({
      ...p,
      last_sign_in_at: loginMap.get(p.id as string) ?? null,
    }));

    return NextResponse.json({ data: enriched });
  } catch (error) {
    console.error('Thrive Radio Users GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAdminContext();
    if ('error' in ctx && ctx.error) return ctx.error;
    const { supabase, adminSupabase } = ctx;

    const body = await request.json();
    const { person_id, person_type } = body;

    if (!person_id || !person_type) {
      return NextResponse.json(
        { error: 'person_id and person_type are required' },
        { status: 400 }
      );
    }

    if (person_type === 'lead') {
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('lead_id, first_name, last_name, email, phone')
        .eq('lead_id', person_id)
        .single();

      if (leadError || !lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      if (!lead.email) {
        return NextResponse.json(
          { error: 'Lead does not have an email address' },
          { status: 400 }
        );
      }

      const password = generatePassword(8);

      const { data: authData, error: authCreateError } =
        await adminSupabase.auth.admin.createUser({
          email: lead.email,
          password,
          email_confirm: true,
          user_metadata: {
            app_source: 'thrive_radio',
            first_name: lead.first_name || '',
            last_name: lead.last_name || '',
          },
        });

      if (authCreateError) {
        console.error('Error creating auth user for lead:', authCreateError);
        return NextResponse.json(
          { error: authCreateError.message || 'Failed to create auth user' },
          { status: 400 }
        );
      }

      if (!authData.user) {
        return NextResponse.json(
          { error: 'Failed to create auth user' },
          { status: 400 }
        );
      }

      // Wait for trigger to create the profile
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify profile was created, update phone if available
      if (lead.phone) {
        await adminSupabase
          .schema('thrive_radio')
          .from('profiles')
          .update({ phone: lead.phone })
          .eq('id', authData.user.id);
      }

      const { data: newProfile } = await adminSupabase
        .schema('thrive_radio')
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      return NextResponse.json({
        data: newProfile,
        generatedPassword: password,
        message: 'Thrive Radio user created successfully',
      });
    }

    if (person_type === 'employee') {
      const { data: employee, error: empError } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('id', person_id)
        .single();

      if (empError || !employee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      const nameParts = (employee.full_name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { data: newProfile, error: insertError } = await adminSupabase
        .schema('thrive_radio')
        .from('profiles')
        .insert({
          id: employee.id,
          first_name: firstName,
          last_name: lastName,
          email: employee.email,
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('Error inserting profile for employee:', insertError);
        return NextResponse.json(
          { error: insertError.message || 'Failed to create profile' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        data: newProfile,
        existingCredentials: true,
        message: 'Employee added to Thrive Radio — they can use their existing credentials',
      });
    }

    return NextResponse.json(
      { error: 'Invalid person_type. Must be "lead" or "employee".' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Thrive Radio Users POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

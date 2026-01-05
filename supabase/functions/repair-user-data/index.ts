import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get the authorization header to identify the user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create regular client to get user from JWT
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    // Create service role client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const repairs: string[] = [];

    // Check and create profile if missing
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!existingProfile) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || ''
        });
      
      if (profileError) {
        console.error('Failed to create profile:', profileError);
      } else {
        repairs.push('profile');
      }
    }

    // Check and create user_settings if missing
    const { data: existingSettings } = await supabaseAdmin
      .from('user_settings')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!existingSettings) {
      const { error: settingsError } = await supabaseAdmin
        .from('user_settings')
        .insert({ user_id: user.id });
      
      if (settingsError) {
        console.error('Failed to create user_settings:', settingsError);
      } else {
        repairs.push('user_settings');
      }
    }

    // Check and create simulator_settings if missing
    const { data: existingSimSettings } = await supabaseAdmin
      .from('simulator_settings')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!existingSimSettings) {
      const { error: simError } = await supabaseAdmin
        .from('simulator_settings')
        .insert({ user_id: user.id });
      
      if (simError) {
        console.error('Failed to create simulator_settings:', simError);
      } else {
        repairs.push('simulator_settings');
      }
    }

    // Check and create investor role if no roles exist
    const { data: existingRoles } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id);

    if (!existingRoles || existingRoles.length === 0) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: user.id, role: 'investor' });
      
      if (roleError) {
        console.error('Failed to create user_role:', roleError);
      } else {
        repairs.push('user_roles');
      }
    }

    console.log(`User data repair completed for ${user.id}:`, repairs);

    return new Response(
      JSON.stringify({ 
        success: true, 
        repairs,
        message: repairs.length > 0 
          ? `Repaired: ${repairs.join(', ')}` 
          : 'No repairs needed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Repair user data error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

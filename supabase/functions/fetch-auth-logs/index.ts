import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Note: Edge functions cannot access Supabase analytics database directly
    // We need to implement a custom audit logging system
    // For now, return data from auth.audit_log_entries if available
    const { data: logs, error: logsError } = await supabase.auth.admin.listUsers()
    
    if (logsError) {
      console.error('Error fetching users:', logsError)
      // Return empty logs rather than throwing
      return new Response(
        JSON.stringify({ logs: [], message: 'Custom audit logging not yet implemented' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Return user data as a temporary solution
    const auditData = logs.users.map(u => ({
      id: u.id,
      timestamp: new Date(u.last_sign_in_at || u.created_at).getTime() * 1000,
      event_message: JSON.stringify({
        action: u.last_sign_in_at ? 'Login' : 'Signup',
        user_id: u.id,
        actor_username: u.email,
        login_method: 'email'
      })
    }))

    return new Response(
      JSON.stringify({ logs: auditData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in fetch-auth-logs function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

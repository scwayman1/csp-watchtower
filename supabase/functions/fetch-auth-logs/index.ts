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

    // Query auth logs from the analytics database
    const { data: logs, error: logsError } = await supabase.rpc('graphql', {
      query: `
        query {
          authLogsCollection(
            orderBy: {timestamp: DescNullsLast}
            first: 50
            filter: {
              or: [
                {event_message: {like: "%Login%"}}
                {event_message: {like: "%Signup%"}}
                {event_message: {like: "%Logout%"}}
              ]
            }
          ) {
            edges {
              node {
                id
                timestamp
                event_message
              }
            }
          }
        }
      `
    })

    if (logsError) {
      console.error('Error fetching auth logs:', logsError)
      throw logsError
    }

    return new Response(
      JSON.stringify({ logs: logs || [] }),
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

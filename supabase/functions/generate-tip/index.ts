// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface RequestPayload {
  interests: string[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.info('Edge Function: generate-tip started');

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { interests } = await req.json()

    // Get OpenAI API key from environment
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Randomly decide: 60% chance single interest, 40% chance cohesive combination
    const isCohesive = Math.random() > 0.6
    let selectedInterests: string[]
    
    if (isCohesive && interests.length >= 2) {
      // Select 2-3 random interests to combine
      const numToSelect = Math.min(interests.length, Math.floor(Math.random() * 2) + 2)
      const shuffled = [...interests].sort(() => Math.random() - 0.5)
      selectedInterests = shuffled.slice(0, numToSelect)
    } else {
      // Pick one random interest
      selectedInterests = [interests[Math.floor(Math.random() * interests.length)]]
    }

    const interestsText = selectedInterests.join(' and ')
    const currentDate = new Date().toISOString().split('T')[0]
    
    const systemPrompt = `You are a helpful learning assistant that provides short, actionable daily tips. Always include references to real, current resources from trusted sources like Wikipedia, Coursera, Medium, YouTube channels, official documentation, or reputable educational platforms. Current date: ${currentDate}`
    
    let userPrompt: string
    if (isCohesive && selectedInterests.length > 1) {
      userPrompt = `Generate one creative and cohesive learning tip that COMBINES these interests: ${interestsText}. Show how these topics can be connected in a meaningful way. Make it actionable and under 100 tokens. Include a specific resource they can explore.`
    } else {
      userPrompt = `Generate one short, actionable learning tip specifically about: ${interestsText}. Focus ONLY on this topic. Keep it under 100 tokens and include a specific reference to a real resource (Wikipedia, Coursera, Medium article, or YouTube channel) that they can explore today.`
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 150,
        temperature: 0.9
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI API error')
    }

    // Add metadata about the response type
    const result = {
      ...data,
      isCohesive: isCohesive && selectedInterests.length > 1,
      selectedInterests: selectedInterests
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})

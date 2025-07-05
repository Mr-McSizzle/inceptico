
'use server';
/**
 * @fileOverview A flow to initialize the startup simulation (digital twin)
 * based on a user-provided business plan, target market, budget, currency, specific goals,
 * and selected founder archetype. This flow now uses a direct call to the Groq API.
 *
 * - promptStartup - A function that takes user input and returns initial startup conditions for the simulation.
 * - PromptStartupInput - The input type for the promptStartup function.
 * - PromptStartupOutput - The return type for the promptStartup function.
 */
import {
  FounderArchetypeEnum,
  type PromptStartupInput,
  type PromptStartupOutput,
  PromptStartupOutputSchema
} from '@/types/simulation';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const systemPrompt = `You are an expert startup simulator and business strategist for Inceptico. Your task is to analyze the user's startup idea and generate the initial conditions for a "digital twin" simulation.

You MUST output a single, valid, parsable JSON object, and NOTHING ELSE. Do not include any text before or after the JSON object.

The JSON object must have two keys: "initialConditions" and "suggestedChallenges".
The value for "initialConditions" MUST be a string containing a valid JSON object.
The value for "suggestedChallenges" MUST be a string containing a valid JSON array of strings.

Example for the string content of 'initialConditions':
'{"companyName": "AI-Driven SaaS", "market": { "targetMarketDescription": "B2B Tech Companies", "estimatedSize": 50000 }, "resources": { "initialFunding": 100000, "coreTeam": [{"role": "Founder", "count": 1, "salary": 0}], "marketingSpend": 5000 }, "productService": { "name": "AI Analytics Suite", "initialDevelopmentStage": "mvp", "pricePerUser": 99 }, "financials": { "startingCash": 100000, "estimatedInitialMonthlyBurnRate": 15000, "currencyCode": "USD" }, "initialGoals": ["Achieve 100 paying customers"]}'

Example for the string content of 'suggestedChallenges':
'["Differentiating from established players", "Ensuring data privacy and compliance"]'

Apply the following founder archetype influences subtly:
- If 'innovator': Slightly lean towards higher initial R&D focus and unique product features.
- If 'scaler': Prioritize operational efficiency, a clear market segment, and a realistic budget.
- If 'community_builder': Lean towards lower initial marketing spend but suggest goals related to user engagement.
- If 'blockchain_visionary': Create a concept native to Web3, possibly involving tokens or DAOs (e.g., "EthosProtocol DAO").`;


const buildUserPrompt = (input: PromptStartupInput): string => {
  const featuresList = (input.initialProductFeatures && input.initialProductFeatures.length > 0) ? input.initialProductFeatures.join(', ') : 'Not specified';
  
  return `
    User Startup Description:
    ${input.prompt}
    (This includes: Business Plan/Idea Summary, Target Market Description, Initial Budget, Preferred Currency: ${input.currencyCode})

    Founder Archetype Selected: ${input.selectedArchetype}

    Optional Specific Goals from User:
    - Target Monthly User Growth Rate: ${input.targetGrowthRate ? `${input.targetGrowthRate}%` : 'Not specified'}
    - Desired Profit Margin: ${input.desiredProfitMargin ? `${input.desiredProfitMargin}%` : 'Not specified'}
    - Target CAC: ${input.targetCAC ? `${input.currencyCode} ${input.targetCAC}` : 'Not specified'}

    Optional Detailed Initial Parameters from User:
    - Initial Team Setup Notes: ${input.initialTeamSetupNotes || 'Not specified'}
    - Key Initial Product Features: ${featuresList}
    - Initial IP/Assets: ${input.initialIP || 'Not specified'}

    Now, generate the JSON output as instructed in the system prompt.
  `;
}

export async function promptStartup(input: PromptStartupInput): Promise<PromptStartupOutput> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured. Please set it in your .env file.");
  }

  const userPrompt = buildUserPrompt(input);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.8,
        response_format: { type: "json_object" }, // Enforce JSON mode
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      const errorMessage = errorBody?.error?.message || "An unknown error occurred";
      const failedGeneration = errorBody?.error?.failed_generation;
      console.error("Groq API Error Response:", errorBody);
      throw new Error(`Groq API error: ${response.status} ${errorMessage} ${failedGeneration ? `(Failed Generation: ${failedGeneration})` : ''}`);
    }

    const groqData = await response.json();
    const aiContent = groqData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error("Groq API returned an empty response content.");
    }
    
    // First, parse the main AI response which should be a JSON object
    const parsedAIResponse = JSON.parse(aiContent);

    // Validate the structure of the parsed object against our Zod schema.
    const validationResult = PromptStartupOutputSchema.safeParse(parsedAIResponse);

    if (!validationResult.success) {
      console.error("AI response failed Zod validation:", validationResult.error);
      throw new Error(`The AI failed to generate valid startup parameters. Validation errors: ${validationResult.error.message}`);
    }
    
    const validatedData = validationResult.data;

    // Additionally, try to parse the stringified JSON within the validated object to ensure it's valid.
    try {
        JSON.parse(validatedData.initialConditions);
    } catch (e) {
        console.error("AI failed to generate valid JSON string for 'initialConditions'.", e);
        console.error("Problematic string:", validatedData.initialConditions);
        throw new Error(`The AI failed to generate valid startup parameters (error processing initialConditions: ${e instanceof Error ? e.message : String(e)}).`);
    }

     try {
        JSON.parse(validatedData.suggestedChallenges);
    } catch (e) {
        console.error("AI failed to generate valid JSON string for 'suggestedChallenges'.", e);
        console.error("Problematic string:", validatedData.suggestedChallenges);
        throw new Error(`The AI failed to generate valid startup parameters (error processing suggestedChallenges: ${e instanceof Error ? e.message : String(e)}).`);
    }

    return {
        initialConditions: validatedData.initialConditions,
        suggestedChallenges: validatedData.suggestedChallenges,
    };

  } catch (err) {
    console.error("Failed to initialize simulation.", err);
    throw new Error(`Failed to initialize simulation. Details: ${err instanceof Error ? err.message : String(err)}`);
  }
}

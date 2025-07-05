
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
import { z } from 'zod';
import { FounderArchetypeEnum, type FounderArchetype } from '@/types/simulation';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Schemas
const PromptStartupInputSchema = z.object({
  prompt: z
    .string()
    .describe('A detailed description of the desired startup, including its business plan/idea, target market, and initial budget. This will also include the preferred currency code and any specific goals.'),
  currencyCode: z.string().optional().describe('The 3-letter currency code (e.g., USD, EUR, JPY) the user wants the simulation to be in. All monetary values in the output should be relative to this currency.'),
  targetGrowthRate: z.string().optional().describe('User\'s target monthly user growth rate (e.g., "20" for 20%).'),
  desiredProfitMargin: z.string().optional().describe('User\'s desired profit margin (e.g., "15" for 15%).'),
  targetCAC: z.string().optional().describe('User\'s target Customer Acquisition Cost (e.g., "25" if currency is USD).'),
  initialTeamSetupNotes: z.string().optional().describe('User notes on desired initial team structure or key roles (e.g., "Two technical co-founders, 1 marketing intern"). AI should interpret this for the coreTeam structure.'),
  initialProductFeatures: z.array(z.string()).optional().describe('A list of key initial product features the user envisions (e.g., ["User Authentication", "Dashboard Analytics", "AI Content Suggestions"]).'),
  initialIP: z.string().optional().describe('Any initial intellectual property, unique assets, or proprietary technology the startup possesses (e.g., "Patented algorithm for X", "Exclusive dataset Y").'),
  selectedArchetype: FounderArchetypeEnum.optional().describe("The founder's chosen archetype (e.g., 'innovator', 'scaler', 'community_builder', 'blockchain_visionary'). This should subtly influence initial conditions."),
});
export type PromptStartupInput = z.infer<typeof PromptStartupInputSchema>;

// The AI will return a single JSON object with these two keys.
// The values of these keys will be STRINGIFIED JSON.
const AIResponseSchema = z.object({
    initialConditions: z.string().describe('A stringified JSON object containing all the initial conditions for the startup simulation. This includes companyName, market, resources, product details, financials, and initial goals. All monetary values in this stringified object MUST be numbers, not strings.'),
    suggestedChallenges: z.string().describe('A stringified JSON array of 3-5 strings, each describing a potential early-stage challenge for the startup.'),
});

// The final output of our flow will have the stringified JSON parsed.
export const PromptStartupOutputSchema = z.object({
  initialConditions: z.string(),
  suggestedChallenges: z.string(),
});
export type PromptStartupOutput = z.infer<typeof PromptStartupOutputSchema>;

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
    - Key Initial Product Features: ${input.initialProductFeatures?.join(', ') || 'Not specified'}
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
      const errorText = await response.text();
      throw new Error(`Groq API error: ${response.status} ${errorText}`);
    }

    const groqData = await response.json();
    const aiContent = groqData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error("Groq API returned an empty response content.");
    }
    
    // First, parse the main AI response which should be a JSON object
    const parsedAIResponse = AIResponseSchema.parse(JSON.parse(aiContent));

    // Then, parse the stringified JSON within that object
    // This provides a two-step validation.
    try {
        JSON.parse(parsedAIResponse.initialConditions);
    } catch (e) {
        console.error("AI failed to generate valid JSON string for 'initialConditions'.", e);
        console.error("Problematic string:", parsedAIResponse.initialConditions);
        throw new Error(`The AI failed to generate valid startup parameters for 'initialConditions'.`);
    }

     try {
        JSON.parse(parsedAIResponse.suggestedChallenges);
    } catch (e) {
        console.error("AI failed to generate valid JSON string for 'suggestedChallenges'.", e);
        console.error("Problematic string:", parsedAIResponse.suggestedChallenges);
        throw new Error(`The AI failed to generate valid startup parameters for 'suggestedChallenges'.`);
    }

    return {
        initialConditions: parsedAIResponse.initialConditions,
        suggestedChallenges: parsedAIResponse.suggestedChallenges,
    };

  } catch (err) {
    console.error("Failed to initialize simulation.", err);
    throw new Error(`Failed to initialize simulation. Details: ${err instanceof Error ? err.message : String(err)}`);
  }
}

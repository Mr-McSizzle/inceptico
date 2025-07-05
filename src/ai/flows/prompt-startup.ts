
'use server';
/**
 * @fileOverview A flow to initialize the startup simulation (digital twin)
 * based on a user-provided business plan, target market, budget, currency, specific goals,
 * and selected founder archetype. This flow now directly uses the Groq API and expects
 * a single JSON string in response to improve reliability.
 *
 * - promptStartup - A function that takes user input and returns initial startup conditions for the simulation.
 * - PromptStartupInput - The input type for the promptStartup function.
 * - PromptStartupOutput - The return type for the promptStartup function.
 */

import {z} from 'zod'; // Use zod directly
import { FounderArchetypeEnum, type FounderArchetype } from '@/types/simulation';

// Schemas are defined here now instead of relying on genkit's z
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


// The final output of our function must match this type.
// Both fields must be strings.
const PromptStartupOutputSchema = z.object({
  initialConditions: z.string(),
  suggestedChallenges: z.string(),
});
export type PromptStartupOutput = z.infer<typeof PromptStartupOutputSchema>;


// The AI's direct output, however, will be simpler.
// We ask for one key with a string value, then parse it ourselves.
const AIOutputSchema = z.object({
  startupDataJSON: z.string().describe('A single JSON string containing an object with two keys: "initialConditions" (an object) and "suggestedChallenges" (an array of strings).'),
});


const buildPrompt = (input: PromptStartupInput): string => {
  return `You are an expert startup simulator and business strategist.
Your task is to take a user's description of their desired startup and generate the initial conditions for a "digital twin" simulation.

User Startup Description:
${input.prompt}
(This includes: Business Plan/Idea Summary, Target Market Description, Initial Budget, Preferred Currency: ${input.currencyCode})

Founder Archetype Selected: ${input.selectedArchetype}
- If 'innovator': Slightly lean towards higher initial R&D focus.
- If 'scaler': Slightly lean towards operational efficiency.
- If 'community_builder': Slightly lean towards lower initial marketing spend but focus on user engagement.
- If 'blockchain_visionary': Lean towards a crypto-native concept (e.g., "EthosProtocol DAO").
These influences should be SUBTLE.

Optional Specific Goals from User:
- Target Monthly User Growth Rate: ${input.targetGrowthRate || 'Not specified'}
- Desired Profit Margin: ${input.desiredProfitMargin || 'Not specified'}
- Target CAC: ${input.targetCAC || 'Not specified'}

Optional Detailed Initial Parameters from User:
- Initial Team Setup Notes: ${input.initialTeamSetupNotes || 'Not specified'}
- Key Initial Product Features: ${input.initialProductFeatures?.join(', ') || 'Not specified'}
- Initial IP/Assets: ${input.initialIP || 'Not specified'}

ABSOLUTELY CRITICAL INSTRUCTIONS:
- YOUR ENTIRE RESPONSE MUST BE A SINGLE, VALID JSON OBJECT.
- THIS JSON OBJECT MUST HAVE ONLY ONE KEY: "startupDataJSON".
- The value for "startupDataJSON" must be a single, valid, parsable JSON string.
- This JSON string must contain an object with two keys:
  1. "initialConditions": A detailed JSON object with the startup parameters (companyName, market, resources, etc.). All monetary values must be numbers.
  2. "suggestedChallenges": A JSON array of 3-5 strings.

Example of the required content for the "startupDataJSON" string:
'{
  "initialConditions": {
    "companyName": "AI-Driven SaaS",
    "market": { "targetMarketDescription": "B2B Tech Companies", "estimatedSize": 50000 },
    "resources": { "initialFunding": 100000, "coreTeam": [{"role": "Founder", "count": 1, "salary": 0}], "marketingSpend": 5000 },
    "productService": { "name": "AI Analytics Suite", "initialDevelopmentStage": "mvp", "pricePerUser": 99 },
    "financials": { "startingCash": 100000, "estimatedInitialMonthlyBurnRate": 15000, "currencyCode": "USD" },
    "initialGoals": ["Achieve 100 paying customers"]
  },
  "suggestedChallenges": ["Differentiating from established players", "Ensuring data privacy and compliance", "Scaling the AI infrastructure cost-effectively"]
}'
`;
}


export async function promptStartup(input: PromptStartupInput): Promise<PromptStartupOutput> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set in the environment variables.");
  }
  
  const systemPrompt = buildPrompt(input);
  
  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: [
          { role: "system", content: "You are an expert startup simulator. Your entire output MUST be a single, valid JSON object with one key: 'startupDataJSON'. The value of this key must be a string containing a JSON object." },
          { role: "user", content: systemPrompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqResponse.ok) {
      const errorBody = await groqResponse.text();
      let errorMessage = `Groq API error: ${groqResponse.status}`;
      try {
        const parsedError = JSON.parse(errorBody);
        errorMessage += ` - ${parsedError.error?.message || errorBody}`;
      } catch {
        errorMessage += ` - ${errorBody}`;
      }
      throw new Error(errorMessage);
    }

    const groqData = await groqResponse.json();
    const rawContent = groqData.choices?.[0]?.message?.content?.trim();

    if (!rawContent) {
      throw new Error("Groq returned an empty response content.");
    }
    
    // First parse: Get the top-level object { startupDataJSON: "..." }
    const aiOutput = JSON.parse(rawContent) as z.infer<typeof AIOutputSchema>;

    if (!aiOutput.startupDataJSON || typeof aiOutput.startupDataJSON !== 'string') {
      throw new Error("AI output did not contain the expected 'startupDataJSON' string.");
    }

    // Second parse: Get the nested object from the string value
    const nestedData = JSON.parse(aiOutput.startupDataJSON);

    const initialConditions = nestedData.initialConditions;
    const suggestedChallenges = nestedData.suggestedChallenges;

    if (!initialConditions || typeof initialConditions !== 'object') {
      throw new Error("Parsed AI data is missing the 'initialConditions' object.");
    }
    if (!suggestedChallenges || !Array.isArray(suggestedChallenges)) {
      throw new Error("Parsed AI data is missing the 'suggestedChallenges' array.");
    }
    
    // Re-stringify the components to match the required final output type
    return {
      initialConditions: JSON.stringify(initialConditions),
      suggestedChallenges: JSON.stringify(suggestedChallenges),
    };

  } catch (error) {
    console.error("Failed to initialize startup via Groq:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to initialize simulation. Details: ${error.message}`);
    }
    throw new Error("An unknown error occurred during startup initialization.");
  }
}

'use server';
/**
 * @fileOverview A flow to initialize the startup simulation (digital twin)
 * based on a user-provided business plan, target market, budget, currency, specific goals,
 * and selected founder archetype. This flow now uses a direct call to the Groq API and handles
 * JSON creation internally for robustness.
 *
 * - promptStartup - A function that takes user input and returns initial startup conditions for the simulation.
 * - PromptStartupInput - The input type for the promptStartup function from the simulation types.
 * - PromptStartupOutput - The return type for the promptStartup function from the simulation types.
 */
import {
  type PromptStartupInput,
  type PromptStartupOutput,
} from '@/types/simulation';
import { z } from 'zod';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Define a more direct schema for the AI to follow. No nested stringified JSON.
const AIResponseSchema = z.object({
  companyName: z.string(),
  market: z.object({
    targetMarketDescription: z.string(),
    estimatedSize: z.number(),
    growthRate: z.number().optional(),
    keySegments: z.array(z.string()).optional(),
  }),
  resources: z.object({
    initialFunding: z.number(),
    coreTeam: z.array(z.object({
      role: z.string(),
      count: z.number(),
      salary: z.number(),
    })),
    initialIpOrAssets: z.string().optional(),
    marketingSpend: z.number(),
    rndSpend: z.number().optional(), // Make optional as it might be derived
  }),
  productService: z.object({
    name: z.string(),
    initialDevelopmentStage: z.string(),
    features: z.array(z.string()).optional(),
    pricePerUser: z.number(),
  }),
  financials: z.object({
    startingCash: z.number(),
    estimatedInitialMonthlyBurnRate: z.number(),
    currencyCode: z.string(),
  }),
  initialGoals: z.array(z.string()).optional(),
  suggestedChallenges: z.array(z.string()).optional(),
});


const systemPrompt = `You are an expert startup simulator and business strategist for Inceptico. Your task is to analyze the user's startup idea and generate the initial conditions for a "digital twin" simulation.

You MUST output a single, valid, parsable JSON object, and NOTHING ELSE. Do not include any text, notes, or explanations before or after the JSON object.

The JSON object must conform to the following structure:
- companyName: string
- market: object with targetMarketDescription (string), estimatedSize (number)
- resources: object with initialFunding (number), coreTeam (array of objects with role, count, salary), marketingSpend (number)
- productService: object with name (string), initialDevelopmentStage (string), pricePerUser (number)
- financials: object with startingCash (number), estimatedInitialMonthlyBurnRate (number), currencyCode (string)
- initialGoals: array of strings
- suggestedChallenges: array of strings`;


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

    Now, generate the single JSON object as instructed in the system prompt.
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
        temperature: 0.7, // Slightly lower temp for better JSON adherence
        response_format: { type: "json_object" },
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
    const validationResult = AIResponseSchema.safeParse(parsedAIResponse);

    if (!validationResult.success) {
      console.error("AI response failed Zod validation:", validationResult.error);
      throw new Error(`The AI failed to generate valid startup parameters. Validation errors: ${validationResult.error.message}`);
    }
    
    const validatedData = validationResult.data;

    // Manually construct the final output format required by the simulation store
    const { suggestedChallenges, ...initialConditionsObject } = validatedData;

    return {
        initialConditions: JSON.stringify(initialConditionsObject),
        suggestedChallenges: JSON.stringify(suggestedChallenges || []), // Ensure it's always an array string
    };

  } catch (err) {
    console.error("Failed to initialize simulation.", err);
    throw new Error(`Failed to initialize simulation. Details: ${err instanceof Error ? err.message : String(err)}`);
  }
}

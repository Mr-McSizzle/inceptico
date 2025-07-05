'use server';
/**
 * @fileOverview A flow to initialize the startup simulation (digital twin)
 * based on a user-provided business plan, target market, budget, currency, specific goals,
 * and selected founder archetype. This flow now directly uses the Groq API.
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

const PromptStartupOutputSchema = z.object({
  initialConditions: z
    .string()
    .describe('A JSON string representing the initial conditions of the startup\'s digital twin, including market parameters, resources, initial team setup, and key financial metrics. All monetary values must be in the specified currency.'),
  suggestedChallenges: z
    .string()
    .describe('A list of potential strategic challenges or critical decisions the startup might face early in thesimulation, formatted as a JSON array of strings. These should consider any specific goals provided by the user and their chosen archetype.'),
});
export type PromptStartupOutput = z.infer<typeof PromptStartupOutputSchema>;

const buildPrompt = (input: PromptStartupInput): string => {
  // This function builds the text prompt string that was previously in the genkit prompt object.
  return `You are an expert startup simulator and business strategist. Your task is to take a user's description of their desired startup and generate the initial conditions for a "digital twin" simulation.

User Startup Description:
${input.prompt}
(This includes: Business Plan/Idea Summary, Target Market Description, Initial Budget, Preferred Currency: ${input.currencyCode})

Founder Archetype Selected: ${input.selectedArchetype}
- If 'innovator': Slightly lean towards higher initial R&D focus or more ambitious product features. Maybe a slightly higher initial burn rate if justified by R&D.
- If 'scaler': Slightly lean towards operational efficiency, perhaps a more defined initial team structure for execution, or goals related to market penetration.
- If 'community_builder': Slightly lean towards lower initial marketing spend but perhaps suggest initial goals around user engagement or early adopter feedback. Consider features that foster community.
- If 'blockchain_visionary': Lean towards a crypto-native concept. The product name might be "protocol" or include "DAO". The target market should be "Web3 enthusiasts". Initial IP could be "novel consensus mechanism". Initial goals should be related to "token distribution" or "decentralized governance". Generate a company name that sounds like a Web3 project (e.g., 'EthosProtocol', 'DeFiForge', 'QuantumLedger').
These influences should be SUBTLE and not override the user's main prompt details significantly.

Optional Specific Goals from User:
${input.targetGrowthRate ? `Target Monthly User Growth Rate: ${input.targetGrowthRate}%` : ''}
${input.desiredProfitMargin ? `Desired Profit Margin: ${input.desiredProfitMargin}%` : ''}
${input.targetCAC ? `Target Customer Acquisition Cost (CAC): ${input.currencyCode} ${input.targetCAC}` : ''}

Optional Detailed Initial Parameters from User:
${input.initialTeamSetupNotes ? `Initial Team Setup Notes: "${input.initialTeamSetupNotes}" (Use this to inform the 'coreTeam' structure. If roles like 'engineer' or 'marketer' are mentioned, try to include them with estimated counts and sensible default salaries. Ensure at least one 'Founder' role, typically with 0 salary initially unless specified).` : ''}
${input.initialProductFeatures ? `Key Initial Product Features: ${input.initialProductFeatures.join(', ')} (Incorporate these into 'productService.features').` : ''}
${input.initialIP ? `Initial IP/Assets: "${input.initialIP}" (Reflect this in 'resources.initialIpOrAssets').` : ''}

Based on ALL available information, generate:
1. Initial Conditions: A detailed JSON string for the startup's digital twin. This should include realistic starting values for:
    - companyName: A suitable name for the startup itself, derived from the user's prompt.
    - market:
        - targetMarketDescription: Based on user input.
        - estimatedSize: Estimated market size.
        - growthRate: Estimated market growth rate.
        - keySegments: Key segments within the target market.
    - resources:
        - initialFunding: CRITICALLY IMPORTANT - Set this to the numerical value of the user's provided 'Initial Budget'.
        - coreTeam: An array of objects (e.g., [{ role: 'Founder', count: 1, salary: 0 }]). Interpret notes if provided.
        - initialIpOrAssets: Based on notes if provided.
        - marketingSpend: Suggest a realistic initial monthly marketing spend.
        - rndSpend: Suggest a realistic initial monthly R&D spend.
    - productService: (Note: use 'productService' as the key)
        - name: A suitable name for the product/service.
        - initialDevelopmentStage: (e.g., 'idea', 'prototype', 'mvp').
        - features: An array of strings.
        - pricePerUser: Suggest an initial monthly price per user.
    - financials:
        - startingCash: CRITICALLY IMPORTANT - Set this to the numerical value of the user's provided 'Initial Budget'.
        - estimatedInitialMonthlyBurnRate: CRITICALLY IMPORTANT - Provide a realistic estimate of the *total* initial monthly burn rate.
        - currencyCode: Set this to ${input.currencyCode}.
    - initialGoals: One or two key short-term objectives.

2. Suggested Challenges: A JSON array of 3-5 strings outlining potential strategic challenges.

ABSOLUTELY CRITICAL INSTRUCTIONS FOR JSON VALIDITY AND CONTENT:
- YOUR ENTIRE RESPONSE MUST BE A SINGLE JSON OBJECT.
- THIS JSON OBJECT MUST START WITH '{' AND END WITH '}'.
- THERE MUST BE NO TEXT, EXPLANATIONS, OR ANY OTHER CHARACTERS BEFORE THE OPENING '{' OR AFTER THE CLOSING '}'.
- The 'initialConditions' field MUST be a single, valid, strictly parsable JSON string.
- The 'suggestedChallenges' field MUST be a valid JSON array of strings.
`;
}

function sanitizeJsonString(jsonString: string): string {
  if (!jsonString || typeof jsonString !== 'string') {
    return jsonString;
  }
  return jsonString.replace(/,\\s*(?=[}\]])/g, '');
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
          { role: "system", content: "You are an expert startup simulator. Your entire output MUST be a single, valid JSON object with two keys: 'initialConditions' (a JSON string) and 'suggestedChallenges' (a JSON array of strings). Do not add any commentary or extra text." },
          { role: "user", content: systemPrompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }, // Request JSON output
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      throw new Error(`Groq API error: ${groqResponse.status} ${errorText}`);
    }

    const groqData = await groqResponse.json();
    const rawContent = groqData.choices?.[0]?.message?.content?.trim();

    if (!rawContent) {
      throw new Error("Groq returned an empty response content.");
    }
    
    const rawOutput = JSON.parse(rawContent) as PromptStartupOutput;
    
    if (!rawOutput || !rawOutput.initialConditions || !rawOutput.suggestedChallenges) {
      console.error("AI promptStartup did not return the expected structure (missing initialConditions or suggestedChallenges). Raw output was:", rawOutput);
      throw new Error("AI failed to provide complete initial data. Missing initialConditions or suggestedChallenges.");
    }

    let finalInitialConditionsString: string;
    let finalSuggestedChallengesString: string;

    // Process initialConditions
    try {
        const sanitizedStr = sanitizeJsonString(rawOutput.initialConditions);
        const parsedObject = JSON.parse(sanitizedStr);
        finalInitialConditionsString = JSON.stringify(parsedObject);
    } catch (e) {
        const errorDetails = e instanceof Error ? e.message : String(e);
        console.error("CRITICAL (prompt-startup.ts): Error processing 'initialConditions'.", e);
        console.error("Original 'initialConditions' string from AI:", rawOutput.initialConditions);
        throw new Error(`The AI failed to generate valid startup parameters (error processing initialConditions: ${errorDetails}).`);
    }

    // Process suggestedChallenges
    try {
        const sanitizedStr = sanitizeJsonString(rawOutput.suggestedChallenges);
        const parsedArray = JSON.parse(sanitizedStr);
        finalSuggestedChallengesString = JSON.stringify(parsedArray);
    } catch (e) {
        const errorDetails = e instanceof Error ? e.message : String(e);
        console.error("CRITICAL (prompt-startup.ts): Error processing 'suggestedChallenges'.", e);
        console.error("Original 'suggestedChallenges' string from AI:", rawOutput.suggestedChallenges);
        throw new Error(`The AI failed to generate valid startup parameters (error processing suggestedChallenges: ${errorDetails}).`);
    }
    
    return {
      initialConditions: finalInitialConditionsString,
      suggestedChallenges: finalSuggestedChallengesString,
    };

  } catch (error) {
    console.error("Failed to initialize startup via Groq:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to initialize simulation. Details: ${error.message}`);
    }
    throw new Error("An unknown error occurred during startup initialization.");
  }
}


'use server';
/**
 * @fileOverview A flow to initialize the startup simulation (digital twin)
 * based on a user-provided business plan, target market, budget, currency, specific goals,
 * and selected founder archetype. This flow now uses the Genkit AI framework with Gemini for stability.
 *
 * - promptStartup - A function that takes user input and returns initial startup conditions for the simulation.
 * - PromptStartupInput - The input type for the promptStartup function.
 * - PromptStartupOutput - The return type for the promptStartup function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit'; // Using Genkit's Zod export
import { FounderArchetypeEnum, type FounderArchetype } from '@/types/simulation';

// These schemas should ideally live in the types/simulation.ts file, but defining them here for clarity.
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
  initialConditions: z.string().describe('A JSON string containing all the initial conditions for the startup simulation. This includes company name, market, resources, product details, financials, and initial goals.'),
  suggestedChallenges: z.string().describe('A JSON string containing an array of 3-5 strings, each describing a potential early-stage challenge for the startup.'),
});
export type PromptStartupOutput = z.infer<typeof PromptStartupOutputSchema>;


export async function promptStartup(input: PromptStartupInput): Promise<PromptStartupOutput> {
  return promptStartupFlow(input);
}


const prompt = ai.definePrompt({
    name: 'initializeStartupPrompt',
    input: { schema: PromptStartupInputSchema },
    output: { schema: PromptStartupOutputSchema },
    config: {
        temperature: 0.8,
    },
    prompt: `You are an expert startup simulator and business strategist for Inceptico. Your task is to analyze the user's startup idea and generate the initial conditions for a "digital twin" simulation.

User Startup Description:
{{{prompt}}}
(This includes: Business Plan/Idea Summary, Target Market Description, Initial Budget, Preferred Currency: {{{currencyCode}}})

Founder Archetype Selected: {{{selectedArchetype}}}
- If 'innovator': Slightly lean towards higher initial R&D focus and unique product features.
- If 'scaler': Prioritize operational efficiency, a clear market segment, and a realistic budget.
- If 'community_builder': Lean towards lower initial marketing spend but suggest goals related to user engagement.
- If 'blockchain_visionary': Create a concept native to Web3, possibly involving tokens or DAOs (e.g., "EthosProtocol DAO").
These influences should be subtle.

Optional Specific Goals from User:
- Target Monthly User Growth Rate: {{#if targetGrowthRate}}{{{targetGrowthRate}}}%{{else}}Not specified{{/if}}
- Desired Profit Margin: {{#if desiredProfitMargin}}{{{desiredProfitMargin}}}%{{else}}Not specified{{/if}}
- Target CAC: {{#if targetCAC}}{{{currencyCode}}} {{{targetCAC}}}{{else}}Not specified{{/if}}

Optional Detailed Initial Parameters from User:
- Initial Team Setup Notes: {{#if initialTeamSetupNotes}}{{{initialTeamSetupNotes}}}{{else}}Not specified{{/if}}
- Key Initial Product Features: {{#if initialProductFeatures}}{{#each initialProductFeatures}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}Not specified{{/if}}
- Initial IP/Assets: {{#if initialIP}}{{{initialIP}}}{{else}}Not specified{{/if}}

Based on all the information provided, generate two outputs:
1.  **initialConditions**: A single, valid, parsable JSON string. This string must contain a JSON object with the startup parameters (e.g., companyName, market, resources, productService, financials, initialGoals). All monetary values in this object MUST be numbers, not strings.
2.  **suggestedChallenges**: A single, valid, parsable JSON string. This string must contain a JSON array of 3-5 strings, each describing a potential early-stage challenge.

Example for 'initialConditions' string content:
'{"companyName": "AI-Driven SaaS", "market": { "targetMarketDescription": "B2B Tech Companies", "estimatedSize": 50000 }, "resources": { "initialFunding": 100000, "coreTeam": [{"role": "Founder", "count": 1, "salary": 0}], "marketingSpend": 5000 }, "productService": { "name": "AI Analytics Suite", "initialDevelopmentStage": "mvp", "pricePerUser": 99 }, "financials": { "startingCash": 100000, "estimatedInitialMonthlyBurnRate": 15000, "currencyCode": "USD" }, "initialGoals": ["Achieve 100 paying customers"]}'

Example for 'suggestedChallenges' string content:
'["Differentiating from established players", "Ensuring data privacy and compliance"]'

The output MUST be a single JSON object matching the PromptStartupOutputSchema.
{{output}}`,
});

const promptStartupFlow = ai.defineFlow(
  {
    name: 'promptStartupFlow',
    inputSchema: PromptStartupInputSchema,
    outputSchema: PromptStartupOutputSchema,
  },
  async (input: PromptStartupInput): Promise<PromptStartupOutput> => {
    const {output} = await prompt(input);
    if (!output || !output.initialConditions || !output.suggestedChallenges) {
        console.error("AI promptStartupFlow did not return the expected structure.", output);
        throw new Error("AI failed to generate valid startup parameters.");
    }

    try {
        JSON.parse(output.initialConditions);
        JSON.parse(output.suggestedChallenges);
    } catch (e) {
        console.error("AI failed to generate valid JSON strings for startup parameters.", e);
        console.error("Problematic initialConditions:", output.initialConditions);
        console.error("Problematic suggestedChallenges:", output.suggestedChallenges);
        throw new Error(`The AI failed to generate valid startup parameters (error processing ${e instanceof Error && e.message.includes('initialConditions') ? 'initialConditions' : 'suggestedChallenges'}: ${e instanceof Error ? e.message : String(e)}).`);
    }
    
    return output;
  }
);

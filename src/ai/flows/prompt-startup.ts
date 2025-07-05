
'use server';
/**
 * @fileOverview A flow to initialize the startup simulation (digital twin)
 * based on a user-provided business plan, target market, budget, currency, specific goals,
 * and selected founder archetype. This flow uses Genkit with Gemini for stable and reliable JSON generation.
 *
 * - promptStartup - A function that takes user input and returns initial startup conditions.
 * - PromptStartupInput - The input type for the promptStartup function.
 * - PromptStartupOutput - The return type for the promptStartup function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { PromptStartupInputSchema, PromptStartupOutputSchema, type PromptStartupInput, type PromptStartupOutput } from '@/types/simulation';

export async function promptStartup(input: PromptStartupInput): Promise<PromptStartupOutput> {
  return promptStartupGenkitFlow(input);
}

const prompt = ai.definePrompt({
  name: 'promptStartupPrompt',
  input: { schema: PromptStartupInputSchema },
  output: { schema: PromptStartupOutputSchema },
  config: {
    temperature: 0.7,
  },
  prompt: `You are an expert startup simulator and business strategist for Inceptico. Your task is to analyze the user's startup idea and generate the initial conditions for a "digital twin" simulation.

You must provide two JSON strings: 'initialConditions' and 'suggestedChallenges'.

**'initialConditions' JSON String Structure:**
- companyName: (string)
- market: (object) with targetMarketDescription, estimatedSize, growthRate (optional), keySegments (optional)
- resources: (object) with initialFunding, coreTeam (array of objects with role, count, salary), marketingSpend, rndSpend (optional), initialIpOrAssets (optional)
- productService: (object) with name, initialDevelopmentStage, features (optional), pricePerUser
- financials: (object) with startingCash, estimatedInitialMonthlyBurnRate, currencyCode
- initialGoals: (array of strings, optional)

**'suggestedChallenges' JSON String Structure:**
- A JSON array of strings, where each string is a plausible early-stage challenge for this startup.

**User's Startup Input:**
- Core Idea/Plan: {{{prompt}}}
- Selected Founder Archetype: {{{selectedArchetype}}}
- Initial Budget & Currency: {{{currencyCode}}}
- Target User Growth Rate (%): {{#if targetGrowthRate}}{{{targetGrowthRate}}}{{else}}Not specified{{/if}}
- Desired Profit Margin (%): {{#if desiredProfitMargin}}{{{desiredProfitMargin}}}{{else}}Not specified{{/if}}
- Target CAC: {{#if targetCAC}}{{{targetCAC}}}{{else}}Not specified{{/if}}
- Initial Team Notes: {{#if initialTeamSetupNotes}}{{{initialTeamSetupNotes}}}{{else}}Not specified{{/if}}
- Key Initial Features: {{#if initialProductFeatures}}{{{initialProductFeatures}}}{{else}}Not specified{{/if}}
- Initial IP/Assets: {{#if initialIP}}{{{initialIP}}}{{else}}Not specified{{/if}}

Based on all the above, generate the two JSON strings as requested.
{{output}}
`
});

const promptStartupGenkitFlow = ai.defineFlow(
  {
    name: 'promptStartupGenkitFlow',
    inputSchema: PromptStartupInputSchema,
    outputSchema: PromptStartupOutputSchema,
  },
  async (input: PromptStartupInput): Promise<PromptStartupOutput> => {
    try {
      const {output} = await prompt(input);
      if (!output || !output.initialConditions || typeof output.initialConditions !== 'string') {
        throw new Error("AI failed to generate a valid 'initialConditions' JSON string.");
      }
      if (!output.suggestedChallenges || typeof output.suggestedChallenges !== 'string') {
        // Fallback for challenges to prevent total failure
        console.warn("AI did not generate a 'suggestedChallenges' string, providing a default.");
        output.suggestedChallenges = '["Launch MVP", "Secure first 100 users"]';
      }
      return output;
    } catch (err) {
      console.error("Failed to initialize simulation in promptStartupGenkitFlow.", err);
      throw new Error(`Failed to initialize simulation. Details: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
);

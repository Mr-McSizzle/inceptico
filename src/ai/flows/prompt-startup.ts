
'use server';
/**
 * @fileOverview A flow to initialize the startup simulation using Gemini.
 * This flow takes user input and uses an AI model to generate the initial startup conditions.
 *
 * - promptStartup - A function that takes user input and returns initial startup conditions.
 * - PromptStartupInput - The input type for the promptStartup function.
 * - PromptStartupOutput - The return type for the promptStartup function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { PromptStartupInputSchema, PromptStartupOutputSchema, type PromptStartupInput, type PromptStartupOutput } from '@/types/simulation';

// Define a schema for the direct output we expect from the AI model.
const AiModelOutputSchema = z.object({
  initialConditions: z.any().describe("A JSON object representing the initial state of the simulation. This includes companyName, market, resources, productService, financials, and initialGoals."),
  suggestedChallenges: z.array(z.string()).describe("An array of strings, where each string is a plausible early-stage challenge for this startup.")
});

const startupPrompt = ai.definePrompt({
  name: 'startupConditionsPrompt',
  inputSchema: PromptStartupInputSchema,
  output: { schema: AiModelOutputSchema, format: 'json' },

  system: `You are an expert startup simulator and business strategist for Inceptico. Your task is to analyze the user's startup idea and generate the initial conditions for a "digital twin" simulation.

You MUST respond with a single, valid JSON object that conforms to the requested output schema. Do not include any text before or after the JSON object. The JSON object must have two top-level keys: 'initialConditions' (which must be a JSON object) and 'suggestedChallenges' (which must be a JSON array of strings).`,

  prompt: `Based on ALL the following startup details, generate the initial simulation conditions.

**User's Startup Input:**
- Core Idea/Plan: {{{prompt}}}
- Selected Founder Archetype: {{{selectedArchetype}}}
- Initial Budget & Currency: {{{currencyCode}}}
- Target User Growth Rate (%): {{#if targetGrowthRate}}{{{targetGrowthRate}}}{{else}}Not specified{{/if}}
- Desired Profit Margin (%): {{#if desiredProfitMargin}}{{{desiredProfitMargin}}}{{else}}Not specified{{/if}}
- Target CAC: {{#if targetCAC}}{{{targetCAC}}}{{else}}Not specified{{/if}}
- Initial Team Notes: {{#if initialTeamSetupNotes}}{{{initialTeamSetupNotes}}}{{else}}Not specified{{/if}}
- Key Initial Features: {{#if initialProductFeatures}}{{#each initialProductFeatures}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}Not specified{{/if}}
- Initial IP/Assets: {{#if initialIP}}{{{initialIP}}}{{else}}Not specified{{/if}}
`
});


const promptStartupFlow = ai.defineFlow(
  {
    name: 'promptStartupFlow',
    inputSchema: PromptStartupInputSchema,
    outputSchema: PromptStartupOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await startupPrompt(input);

      if (!output || !output.initialConditions || !output.suggestedChallenges) {
        throw new Error("AI returned an incomplete or malformed response for startup conditions.");
      }

      // Ensure the output matches the expected format for the rest of the application
      return {
        initialConditions: JSON.stringify(output.initialConditions, null, 2),
        suggestedChallenges: JSON.stringify(output.suggestedChallenges, null, 2),
      };

    } catch (err) {
      console.error("Failed to initialize simulation in promptStartupFlow.", err);
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check for common API errors to provide more specific feedback
      if (errorMessage.toLowerCase().includes("api key not valid")) {
        throw new Error("Failed to initialize simulation. The Gemini API key is invalid or missing. Please check your .env configuration.");
      }
      
      throw new Error(`Failed to initialize simulation. Details: ${errorMessage}`);
    }
  }
);


export async function promptStartup(input: PromptStartupInput): Promise<PromptStartupOutput> {
  return promptStartupFlow(input);
}

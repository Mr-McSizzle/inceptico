
'use server';
/**
 * @fileOverview A flow to initialize the startup simulation using Groq's Llama3 model.
 * This flow makes a direct API call to Groq to generate the initial startup conditions.
 *
 * - promptStartup - A function that takes user input and returns initial startup conditions.
 * - PromptStartupInput - The input type for the promptStartup function.
 * - PromptStartupOutput - The return type for the promptStartup function.
 */

import { z } from 'zod';
import { PromptStartupInputSchema, PromptStartupOutputSchema, type PromptStartupInput, type PromptStartupOutput } from '@/types/simulation';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Define a schema for the direct output we expect from the Groq API call.
// This is simpler for the AI to generate correctly.
const GroqOutputSchema = z.object({
  initialConditions: z.any().describe("A JSON object representing the initial state of the simulation. This includes companyName, market, resources, productService, financials, and initialGoals."),
  suggestedChallenges: z.array(z.string()).describe("An array of strings, where each string is a plausible early-stage challenge for this startup.")
});

export async function promptStartup(input: PromptStartupInput): Promise<PromptStartupOutput> {
  if (!GROQ_API_KEY || GROQ_API_KEY === "YOUR_GROQ_API_KEY_HERE") {
    throw new Error("Groq API key is not configured. Please set GROQ_API_KEY in your .env file.");
  }
  
  // The system prompt now strictly enforces the JSON output format.
  const systemPrompt = `You are an expert startup simulator and business strategist for Inceptico. Your task is to analyze the user's startup idea and generate the initial conditions for a "digital twin" simulation.

You MUST respond with a single, valid JSON object and NOTHING else. Do not include any text before or after the JSON object. The JSON object must have two top-level keys: 'initialConditions' (which must be a JSON object) and 'suggestedChallenges' (which must be a JSON array of strings).

**User's Startup Input:**
- Core Idea/Plan: ${input.prompt}
- Selected Founder Archetype: ${input.selectedArchetype}
- Initial Budget & Currency: ${input.currencyCode}
- Target User Growth Rate (%): ${input.targetGrowthRate || 'Not specified'}
- Desired Profit Margin (%): ${input.desiredProfitMargin || 'Not specified'}
- Target CAC: ${input.targetCAC || 'Not specified'}
- Initial Team Notes: ${input.initialTeamSetupNotes || 'Not specified'}
- Key Initial Features: ${input.initialProductFeatures?.join(', ') || 'Not specified'}
- Initial IP/Assets: ${input.initialIP || 'Not specified'}

Based on ALL the above, generate the JSON object as requested.
`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.7,
        response_format: { type: "json_object" }, // Force JSON mode
      }),
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => response.text());
        console.error("Groq API error response:", errorBody);
        const failedGeneration = errorBody?.error?.failed_generation;
        let errorMessage = `Groq API error: ${response.status} ${response.statusText}`;
        if (failedGeneration) {
            errorMessage += ` (Failed Generation: ${failedGeneration})`;
        }
        throw new Error(errorMessage);
    }

    const data = await response.json();
    const aiResponseContent = data.choices?.[0]?.message?.content;

    if (!aiResponseContent) {
      throw new Error("Groq API returned an empty response.");
    }
    
    // Parse the entire response string as the JSON we need
    const parsedData = JSON.parse(aiResponseContent);

    // Validate the parsed data against our internal schema
    const validationResult = GroqOutputSchema.safeParse(parsedData);
    if (!validationResult.success) {
      console.error("AI output validation failed:", validationResult.error.flatten());
      throw new Error(`The AI returned data in an unexpected format. Validation errors: ${JSON.stringify(validationResult.error.flatten())}`);
    }

    const { initialConditions, suggestedChallenges } = validationResult.data;

    // Stringify the parts to fit the required PromptStartupOutput format
    return {
      initialConditions: JSON.stringify(initialConditions, null, 2),
      suggestedChallenges: JSON.stringify(suggestedChallenges, null, 2),
    };

  } catch (err) {
    console.error("Failed to initialize simulation in promptStartup.", err);
    throw new Error(`Failed to initialize simulation. Details: ${err instanceof Error ? err.message : String(err)}`);
  }
}

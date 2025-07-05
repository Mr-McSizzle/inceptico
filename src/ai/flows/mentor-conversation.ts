
'use server';

/**
 * @fileOverview EVE, your AI Queen Hive Mind assistant.
 * EVE engages in natural language conversations to provide synthesized business advice, 
 * strategic guidance, and coordinates insights from a team of specialized AI expert agents.
 * This flow includes an optional dual-LLM pipeline to optimize user prompts with Groq before sending to Gemini.
 *
 * - mentorConversation - A function that handles the conversation with EVE.
 * - MentorConversationInput - The input type for the mentorConversation function.
 * - MentorConversationOutput - The return type for the mentorConversation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { alexTheAccountantTool } from '@/ai/tools/alex-the-accountant-tool';
import { mayaTheMarketingGuruTool } from '@/ai/tools/maya-the-marketing-guru-tool';
import { leoTheExpansionExpertTool } from '@/ai/tools/leo-the-expansion-expert-tool';
import { tyTheSocialMediaStrategistTool } from '@/ai/tools/ty-the-social-media-strategist-tool';
import { zaraTheFocusGroupLeaderTool } from '@/ai/tools/zara-the-focus-group-leader-tool';
import { theAdvisorTool } from '@/ai/tools/the-advisor-tool';
import { brandLabTool } from '@/ai/tools/brand-lab-tool';
import { setMarketingBudgetTool } from '@/ai/tools/set-marketing-budget-tool';
import { setRnDBudgetTool } from '@/ai/tools/set-rnd-budget-tool';
import { setProductPriceTool } from '@/ai/tools/set-product-price-tool';


import type { AlexTheAccountantToolInput, MayaTheMarketingGuruToolInput, TyTheSocialMediaStrategistToolInput, ZaraTheFocusGroupLeaderToolInput, LeoTheExpansionExpertToolInput, TheAdvisorToolInput, BrandLabToolInput } from '@/types/simulation'; 

const MentorConversationInputSchema = z.object({
  userInput: z
    .string()
    .describe('The user input to EVE, the AI Queen Hive Mind assistant.'),
  useGroqOptimizer: z.boolean().optional().describe('Whether to use Groq to optimize the prompt before sending to Gemini.'),
  language: z.string().optional().describe("The user's preferred language code (e.g., 'en-US', 'es-ES'). EVE must respond in this language if provided."),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'tool_response']),
    content: z.string(),
  })).optional().describe('The conversation history. Includes user messages, EVE\'s responses, and tool responses.'),
  simulationMonth: z.number().optional().describe("Current month in the simulation (e.g., 0 for initial setup, 1 for first month, etc.)."),
  financials: z.object({
    cashOnHand: z.number().optional(),
    burnRate: z.number().optional(),
    revenue: z.number().optional(),
    expenses: z.number().optional(),
    currencyCode: z.string().optional(),
    currencySymbol: z.string().optional(),
  }).optional().describe("Key financial figures from the current simulation state."),
  product: z.object({
    name: z.string().optional().describe("Name of the startup's product/service."),
    stage: z.string().optional().describe("Current development stage of the product (e.g., 'idea', 'mvp', 'growth')."),
    pricePerUser: z.number().optional().describe("Current monthly price per user for the product."),
    description: z.string().optional().describe("Brief description of the product/service for context."),
  }).optional().describe("Current product details."),
  resources: z.object({
    marketingSpend: z.number().optional().describe("Current monthly marketing spend."),
    team: z.array(z.object({ role: z.string(), count: z.number(), salary: z.number() })).optional().describe("Current team composition and salaries."),
    rndSpend: z.number().optional().describe("Current monthly R&D spend."),
  }).optional().describe("Current resource allocation."),
  market: z.object({
    targetMarketDescription: z.string().optional().describe("Description of the target market."),
    competitionLevel: z.string().optional().describe("Current competition level ('low', 'moderate', 'high').")
  }).optional().describe("Current market focus."),
  userMetrics: z.object({ // Added for churn rate
      churnRate: z.number().optional(),
  }).optional().describe("Key user metrics."),
  currentSimulationPage: z.string().optional().describe("The current page the user is on in the Inceptico app, e.g., '/app/dashboard'. Used for context-aware navigation suggestions."),
  isSimulationInitialized: z.boolean().optional().describe("Whether the simulation has been set up."),
});

export type MentorConversationInput = z.infer<typeof MentorConversationInputSchema>;

const SuggestedNextActionSchema = z.object({
  page: z.string().describe("The recommended page URL to navigate to (e.g., '/app/dashboard', '/app/simulation', '/app/strategy')."),
  label: z.string().describe("The text for the button/link for this action (e.g., 'View Your Dashboard', 'Adjust Budgets', 'Analyze Strategy')."),
});

const MentorConversationOutputSchema = z.object({
  response: z.string().describe('EVE\'s response to the user input, potentially synthesizing information from her specialized AI agents or tools.'),
  suggestedNextAction: SuggestedNextActionSchema.optional().nullable().describe("A suggested next action or page for the user to navigate to. If no suggestion, this can be omitted or null."),
});

export type MentorConversationOutput = z.infer<typeof MentorConversationOutputSchema>;

export async function mentorConversation(input: MentorConversationInput): Promise<MentorConversationOutput> {
  return mentorConversationFlow(input);
}

// Define a more specific type for the history being passed to the prompt
const ProcessedHistoryMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'tool_response']),
    content: z.string(),
    isUser: z.boolean(),
    isAssistant: z.boolean(),
    isTool: z.boolean(),
});

const PromptInputSchemaWithHistory = MentorConversationInputSchema.extend({
  conversationHistoryForPrompt: z.array(ProcessedHistoryMessageSchema).optional(),
});


const prompt = ai.definePrompt({
  name: 'eveHiveMindConversationPrompt',
  tools: [
    alexTheAccountantTool, 
    mayaTheMarketingGuruTool, 
    leoTheExpansionExpertTool, 
    tyTheSocialMediaStrategistTool, 
    zaraTheFocusGroupLeaderTool,
    theAdvisorTool,
    brandLabTool,
    setMarketingBudgetTool,
    setRnDBudgetTool,
    setProductPriceTool,
  ],
  input: {
    schema: PromptInputSchemaWithHistory,
  },
  output: { 
    schema: MentorConversationOutputSchema,
  },
  config: {
    temperature: 0.7,
  },
  prompt: `You are EVE, the AI "Queen Hive Mind" and ultimate intelligence for Inceptico. Your primary role is to act as a personalized strategic assistant for the user (a startup founder). You possess a deep, holistic understanding of the entire Inceptico simulation environment and its mechanics.

You interface with a team of specialized AI expert agents. Based on the user's query and the simulation context, you must:
1.  Provide a direct, thoughtful response. If the query falls into a specialist's domain, synthesize insights as if you've consulted them.
2.  If the user asks to change a core parameter (marketing budget, R&D budget, product price), use the appropriate tool to acknowledge this. ALWAYS confirm the action and the new value in your textual response to the user.
3.  Proactively suggest a next logical step or page within Inceptico if relevant, using 'suggestedNextAction'.
4.  If a 'language' is provided, you MUST conduct the entire conversation in that language.
5.  Adapt your tone based on the simulation's state (e.g., cautious if cash is low, celebratory on milestones, concerned if churn is high).

Current simulation context:
- User's Language: {{#if language}}{{language}}{{else}}en-US (default){{/if}}
- Simulation Month: {{simulationMonth}}
- Is Initialized: {{isInitialized}}
- User is on page: {{currentSimulationPage}}
- Financials (Currency: {{{financials.currencyCode}}}): Cash: {{{financials.currencySymbol}}}{{{financials.currencyCode}}}{{financials.cashOnHand}}, Burn: {{{financials.currencySymbol}}}{{financials.burnRate}}/mo
- Product: '{{#if product.name}}{{product.name}}{{else}}Unnamed{{/if}}' (Stage: {{product.stage}})

{{#if conversationHistoryForPrompt}}
Conversation History:
{{#each conversationHistoryForPrompt}}
  {{#if isUser}}Founder: {{/if}}{{#if isAssistant}}EVE: {{/if}}{{#if isTool}}Tool: {{/if}}{{{content}}}
{{/each}}
{{/if}}

User's current query:
{{{userInput}}}
`,
});

const mentorConversationFlow = ai.defineFlow(
  {
    name: 'eveHiveMindConversationFlow',
    inputSchema: MentorConversationInputSchema,
    outputSchema: MentorConversationOutputSchema,
  },
  async (input: MentorConversationInput) => {
    
    let finalUserInput = input.userInput;

    if (input.useGroqOptimizer) {
      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey || groqApiKey === "YOUR_GROQ_API_KEY_HERE") {
        console.warn("[Dual LLM Fallback] Groq API key not found. Skipping optimization.");
      } else {
        console.log('[Dual LLM] Groq optimizer enabled. Optimizing prompt...');
        try {
          const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqApiKey}`,
            },
            body: JSON.stringify({
              model: 'llama3-70b-8192',
              messages: [
                { "role": "system", "content": "You are a prompt optimizer. Rewrite the user's prompt to be clearer, more concise, and better suited for a powerful AI assistant like Gemini. Focus on extracting the core intent. Return ONLY the optimized prompt, with no additional commentary or conversational text." },
                { "role": "user", "content": input.userInput }
              ],
              temperature: 0.2,
            }),
          });

          if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            throw new Error(`Groq API error: ${groqResponse.status} ${errorText}`);
          }

          const groqData = await groqResponse.json();
          const optimizedPrompt = groqData.choices?.[0]?.message?.content?.trim();

          if (optimizedPrompt) {
            finalUserInput = optimizedPrompt;
            console.log(`[Dual LLM] Original Prompt: "${input.userInput}"`);
            console.log(`[Dual LLM] Optimized Prompt: "${finalUserInput}"`);
          } else {
            console.warn('[Dual LLM] Groq returned an empty response. Using original prompt.');
          }
        } catch (error) {
          console.error('[Dual LLM] Fallback: Groq API call failed. Using original prompt.', error);
        }
      }
    }
    
    // Process history to add boolean flags for the template
    const processedHistory = input.conversationHistory?.map(message => ({
      ...message,
      isUser: message.role === 'user',
      isAssistant: message.role === 'assistant',
      isTool: message.role === 'tool_response',
    }));

    const flowInputForPrompt = {
      ...input,
      userInput: finalUserInput,
      conversationHistoryForPrompt: processedHistory,
    };
    
    const {output} = await prompt(flowInputForPrompt, {
        toolContext: {
            setMarketingBudgetTool: { currencyCode: input.financials?.currencyCode },
            setRnDBudgetTool: { currencyCode: input.financials?.currencyCode },
            setProductPriceTool: { currencyCode: input.financials?.currencyCode },
        }
    });

    if (!output || !output.response) {
      console.error("EVE (AI) did not return a valid response structure.", output);
      const geminiResponse = "I seem to be having trouble formulating a complete response at the moment. Could you try rephrasing or asking again shortly?";
      return { response: geminiResponse, suggestedNextAction: null };
    }
    
    return {
      response: output.response,
      suggestedNextAction: output.suggestedNextAction === undefined ? null : output.suggestedNextAction,
    };
  }
);

    
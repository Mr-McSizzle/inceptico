
'use server';
/**
 * @fileOverview An AI flow that simulates one month of business operations.
 * It takes the current simulation state and calculates the outcomes for the next month.
 *
 * - simulateMonth - Function to call the AI simulation flow.
 * - SimulateMonthInput - Input type for the flow.
 * - SimulateMonthOutput - Output type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { SimulateMonthInputSchema, SimulateMonthOutputSchema, type SimulateMonthInput, type SimulateMonthOutput, KeyEventCategoryEnum, KeyEventImpactEnum } from '@/types/simulation';

export async function simulateMonth(input: SimulateMonthInput): Promise<SimulateMonthOutput> {
  return simulateMonthGenkitFlow(input);
}

const prompt = ai.definePrompt({
  name: 'simulateMonthQuantEnginePrompt',
  input: { schema: SimulateMonthInputSchema },
  output: { schema: SimulateMonthOutputSchema },
  config: {
    temperature: 0.4, // Lower temperature for more deterministic, quant-like behavior
     safetySettings: [ 
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE'},
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE'},
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE'},
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE'},
    ],
  },
  prompt: `You are a quantitative simulation engine. Your sole function is to receive the current state of a business simulation and generate a probabilistic forecast for the next time step (one month). You must adhere to the following directives and internal workflow.

**Core Directives:**
-   **Backend-Oriented:** Do not produce user-facing reports or narrative explanations. Your output is a structured forecast.
-   **Quantify Uncertainty:** Your output should reflect a central tendency from an implied distribution. Use stochastic models conceptually.
-   **No Data Hallucination:** Only use signals provided in the input. Do not invent external data (e.g., real-time stock prices).
-   **Reproducibility & Discipline:** Maintain numerical stability and statistical defensibility in your logic. Be cautious, realistic, and mathematically honest.

**Internal Workflow (Execute Silently):**

1.  **Data Ingestion:**
    *   Acknowledge the following input data as realized outcomes for the current month (t={{{currentSimulationMonth}}}):
        *   Company: {{{companyName}}}
        *   Financials: Cash: {{{financials.currencySymbol}}}{{{financials.cashOnHand}}}, Last Revenue: {{{financials.currencySymbol}}}{{{financials.currentRevenue}}}, Last Expenses: {{{financials.currencySymbol}}}{{{financials.currentExpenses}}}
        *   User Metrics: Active Users: {{{userMetrics.activeUsers}}}, Churn Rate: {{{userMetrics.churnRate}}}
        *   Product: Stage '{{{product.stage}}}', Progress {{{product.developmentProgress}}}%, Price {{{financials.currencySymbol}}}{{{product.pricePerUser}}}
        *   Resources: Marketing Spend {{{financials.currencySymbol}}}{{{resources.marketingSpend}}}, R&D Spend {{{financials.currencySymbol}}}{{{resources.rndSpend}}}, Team: {{#each resources.team}}{{{count}}}x {{{role}}}; {{/each}}
        *   Market: Competition '{{{market.competitionLevel}}}', Target: '{{{market.targetMarketDescription}}}'
        *   Scores: Startup Score {{{currentStartupScore}}}, Investor Sentiment {{{currentInvestorSentiment}}}
    *   Active Scenarios modifying logic: {{#if activeScenarios}}{{#each activeScenarios}}{{{this}}}; {{/each}}{{else}}None{{/if}}
    *   Conceptually integrate macroeconomic factors: Assume a baseline economic environment. If competition is 'high', imply higher market volatility. If a 'Recession' scenario is active, apply negative pressure on acquisition and retention.

2.  **Feature Engineering & Modeling (Ensemble Approach):**
    *   **User Base Forecast (t+1):**
        *   *Churn:* Model churn as a stochastic process. Baseline Churn = round({{{userMetrics.activeUsers}}} * {{{userMetrics.churnRate}}}). Apply a small stochastic shock (+/- 1-5%) based on product stage (higher churn for 'idea'/'prototype') and competition. High competition increases churn volatility.
        *   *Acquisition:* Model as a function of marketing spend, price elasticity, and word-of-mouth, influenced by macro factors.
            *   Base Acquisition from Marketing = ({{{resources.marketingSpend}}} / (Base_CAC * Comp_Factor)) * Product_Maturity_Multiplier.
                *   Base_CAC is conceptually 20.
                *   Comp_Factor is 1.0 for moderate, 1.5 for high competition.
                *   Product_Maturity_Multiplier is 0.5 for 'idea'/'prototype', 1.0 for 'mvp', 1.2 for 'growth', 1.4 for 'mature'.
            *   Word-of-Mouth = round({{{userMetrics.activeUsers}}} / 1000 * (1 - {{{userMetrics.churnRate}}}))
        *   *New Users (t+1)* = Base Acquisition + Word-of-Mouth.
        *   *Updated Active Users (t+1)* = {{{userMetrics.activeUsers}}} - Churn + New Users.

    *   **Financial Forecast (t+1):**
        *   *Revenue:* Calculated Revenue = Updated Active Users * {{{product.pricePerUser}}}. If a 'Freemium' scenario is active, adjust by assuming only a fraction of users convert.
        *   *Expenses:*
            *   Salaries = Sum of all team member salaries.
            *   Marketing = {{{resources.marketingSpend}}}
            *   R&D = {{{resources.rndSpend}}}
            *   Operational Costs = (Number of team members * 150) + 1000. Introduce a small stochastic shock (+/- 5%) to simulate variable costs.
            *   **Cash Preservation (Stress Test Logic):** If ({{{financials.cashOnHand}}} / (Last Month Expenses - Last Month Revenue)) < 2, HALVE marketing and R&D spend for this month. This overrides user input and represents an emergency risk management action. Generate a "Financial" key event reflecting this.
            *   Calculated Expenses = Sum of all expense components.
        *   *Cash Flow:* Profit/Loss = Revenue - Expenses. Updated Cash = {{{financials.cashOnHand}}} + Profit/Loss.

    *   **Product Development Forecast (t+1):**
        *   *Progress Delta:* Model as a function of R&D investment and team size. Progress Delta = (R&D Spend / (200 + (is_early_stage ? 100 : 0))) + (Num_Engineers * (2 + (is_growth_stage ? 1 : 0))). Cap delta at 25% to prevent unrealistic jumps.
        *   *Stage Advancement:* If {{{product.developmentProgress}}} + Progress Delta >= 100, advance to next product stage and reset progress to 0.

3.  **Event Generation & Score Calibration:**
    *   **Key Events (Exactly 2):** Generate two distinct, plausible events based on the current state.
        *   Event 1: A significant market or competitor event (e.g., "Competitor X cut prices by 20%", "New regulatory guidelines announced for your industry").
        *   Event 2: An internal operational event (e.g., "R&D team achieved a minor breakthrough, increasing dev speed by 5% for one month", "Unexpected server costs increased operational expenses by $500", "Positive PR from a tech blog boosts acquisition temporarily").
    *   **Score Adjustments:** Calculate integer adjustments based on performance against implied targets.
        *   startupScoreAdjustment: Based on profitability, cash runway, user growth, and event impacts. Significant negative cash flow must result in a negative adjustment. Hitting a new user milestone (e.g., crossing 10k users) gives a bonus.
        *   investorSentimentAdjustment: Based on growth metrics (MoM user growth), runway (cash/burn ratio), and major milestones. High burn with low cash must decrease sentiment. Stage advancement must increase it.

**Output Generation:**
Provide the final forecast as a single, valid JSON object matching the SimulateMonthOutputSchema. Do not include any commentary. The \`aiReasoning\` field should be a very brief, technical note on the dominant factor for the month's forecast (e.g., "Forecast dominated by high burn rate leading to cash preservation measures.", "Strong word-of-mouth effect driving user acquisition above marketing-spend baseline.").
{{output}}
`,
});

const simulateMonthGenkitFlow = ai.defineFlow(
  {
    name: 'simulateMonthGenkitFlow',
    inputSchema: SimulateMonthInputSchema,
    outputSchema: SimulateMonthOutputSchema,
  },
  async (input: SimulateMonthInput): Promise<SimulateMonthOutput> => {
    const targetSimulatedMonth = input.currentSimulationMonth + 1;

    let currentProductStageForAI = input.product.stage;
    const validStages: SimulateMonthInput['product']['stage'][] = ['idea', 'prototype', 'mvp', 'growth', 'mature'];
    if (!validStages.includes(currentProductStageForAI)) {
        if (String(currentProductStageForAI).toLowerCase() === 'concept') {
            currentProductStageForAI = 'idea';
        } else {
            console.warn(`Invalid product stage "${currentProductStageForAI}" detected before AI call in simulateMonthFlow. Defaulting to "idea".`);
            currentProductStageForAI = 'idea';
        }
    }

    const flowInputForPrompt = {
      ...input,
      product: {
        ...input.product,
        stage: currentProductStageForAI,
      }
    };

    let {output} = await prompt(flowInputForPrompt);

    if (!output) {
      console.error("AI simulateMonthFlow did not return any output.");
      throw new Error("AI simulation failed to produce an output.");
    }

    if (output.simulatedMonthNumber !== targetSimulatedMonth) {
        console.warn(`AI returned month ${output.simulatedMonthNumber}, expected ${targetSimulatedMonth}. Proceeding with AI's month.`);
    }

    // Make expenseBreakdown authoritative and ensure consistency
    if (output.expenseBreakdown) {
        const breakdownSum = output.expenseBreakdown.salaries + output.expenseBreakdown.marketing + output.expenseBreakdown.rnd + output.expenseBreakdown.operational;
        if (Math.abs(breakdownSum - output.calculatedExpenses) > 0.01) { // Allow for small floating point differences
            console.warn(`AI expenseBreakdown sum (${breakdownSum}) does not match AI's calculatedExpenses (${output.calculatedExpenses}). Overriding calculatedExpenses with breakdown sum.`);
        }
        output.calculatedExpenses = breakdownSum;
        output.profitOrLoss = output.calculatedRevenue - output.calculatedExpenses;
        output.updatedCashOnHand = input.financials.cashOnHand + output.profitOrLoss;

    } else {
        console.error("AI simulateMonthFlow did not return expenseBreakdown. This is required.");
        const placeholderSalaries = input.resources.team.reduce((acc, member) => acc + (member.count * member.salary), 0);
        const placeholderOperational = Math.max(0, output.calculatedExpenses - (placeholderSalaries + input.resources.marketingSpend + input.resources.rndSpend));
        output.expenseBreakdown = {
            salaries: placeholderSalaries,
            marketing: input.resources.marketingSpend,
            rnd: input.resources.rndSpend,
            operational: placeholderOperational
        };
        output.profitOrLoss = output.calculatedRevenue - output.calculatedExpenses;
        output.updatedCashOnHand = input.financials.cashOnHand + output.profitOrLoss;
    }
    
    // Validate AI-generated events structure
    if (output.keyEventsGenerated && Array.isArray(output.keyEventsGenerated)) {
        output.keyEventsGenerated.forEach(event => {
            if (!event.description || !event.category || !event.impact) {
                console.warn("AI returned a malformed key event:", event);
                // Attempt to fix or default malformed event
                event.description = event.description || "Unspecified event from AI";
                event.category = KeyEventCategoryEnum.Values.General; // Default category
                event.impact = KeyEventImpactEnum.Values.Neutral; // Default impact
            }
            if (typeof event.description !== 'string' || !KeyEventCategoryEnum.safeParse(event.category).success || !KeyEventImpactEnum.safeParse(event.impact).success) {
                console.warn("AI returned an event with invalid category or impact type:", event);
                event.category = KeyEventCategoryEnum.Values.General;
                event.impact = KeyEventImpactEnum.Values.Neutral;
            }
        });
         if (output.keyEventsGenerated.length !== 2) {
            console.warn(`AI returned ${output.keyEventsGenerated.length} events, expected 2. Padding/truncating if necessary.`);
            // Basic padding/truncating - could be more sophisticated
            while(output.keyEventsGenerated.length < 2) {
                output.keyEventsGenerated.push({description: "Placeholder event due to AI under-generation.", category: "System", impact: "Neutral"});
            }
            if(output.keyEventsGenerated.length > 2) {
                output.keyEventsGenerated = output.keyEventsGenerated.slice(0, 2);
            }
        }
    } else {
        console.error("AI did not return keyEventsGenerated or it was not an array. Creating default events.");
        output.keyEventsGenerated = [
            {description: "AI failed to generate primary event for the month.", category: "System", impact: "Neutral"},
            {description: "AI failed to generate secondary event for the month.", category: "System", impact: "Neutral"}
        ];
    }


    return output;
  }
);

    

'use server';
/**
 * @fileOverview A tool for EVE to access real-time information from the web
 * by using the Google Custom Search JSON API.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const webSearchTool = ai.defineTool(
  {
    name: 'webSearchTool',
    description: 'Provides real-time information by searching the web. Use this tool for queries about current events, live data (like stock prices, market caps), or any factual information that might be very recent or outside your internal knowledge base.',
    inputSchema: z.object({
      query: z.string().describe('The specific search query to look up on the web.'),
    }),
    outputSchema: z.string().describe('The search result, typically a snippet or summary of the top result.'),
  },
  async (input) => {
    console.log(`[WebSearchTool] Received query: "${input.query}"`);

    const API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const CX = process.env.GOOGLE_CUSTOM_SEARCH_CX;

    if (!API_KEY || !CX || API_KEY === 'YOUR_API_KEY_HERE' || CX === 'YOUR_SEARCH_ENGINE_ID_HERE') {
      const errorMessage = "Web search is not configured. Please set GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_CX in your .env file.";
      console.error(`[WebSearchTool] ${errorMessage}`);
      return `Simulated search result for "${input.query}": ${errorMessage}`;
    }

    const searchApiUrl = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(input.query)}`;

    try {
      const response = await fetch(searchApiUrl);
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`API call failed with status: ${response.status}. Details: ${errorBody?.error?.message}`);
      }

      const data = await response.json();

      // Extract the most relevant snippet or answer from the API response.
      const answerSnippet = data.items?.[0]?.snippet;
      const answerPagemap = data.items?.[0]?.pagemap?.metatags?.[0]?.['og:description'];
      
      const bestAnswer = answerSnippet || answerPagemap;
      
      if (bestAnswer) {
        return bestAnswer;
      }
      
      if (data.spelling?.correctedQuery) {
        return `No direct answer found for "${input.query}". Did you mean "${data.spelling.correctedQuery}"?`;
      }

      return "No relevant information found in the top search results.";

    } catch (error) {
      console.error("[WebSearchTool] API call failed:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      return `Sorry, I was unable to perform the web search at this time. Error: ${errorMessage}`;
    }
  }
);

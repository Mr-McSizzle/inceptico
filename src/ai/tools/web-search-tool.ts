
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
    outputSchema: z.string().describe('A summary of the top web search results.'),
  },
  async (input) => {
    console.log(`[WebSearchTool] Received query: "${input.query}"`);

    const API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const CX = process.env.GOOGLE_CUSTOM_SEARCH_CX;

    if (!API_KEY || !CX || API_KEY === 'YOUR_API_KEY_HERE' || CX === 'YOUR_SEARCH_ENGINE_ID_HERE') {
      const errorMessage = "Web search is not configured. Please set GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_CX in your .env file.";
      console.error(`[WebSearchTool] ${errorMessage}`);
      // Return a user-friendly error that EVE can relay if necessary.
      return `Error: The web search tool is not configured. An API key is required.`;
    }

    const searchApiUrl = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(input.query)}`;

    try {
      const response = await fetch(searchApiUrl);
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { message: "Unknown API error." } }));
        throw new Error(`API call failed with status: ${response.status}. Details: ${errorBody?.error?.message}`);
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        if (data.spelling?.correctedQuery) {
          return `No direct answer found for "${input.query}". Did you mean "${data.spelling.correctedQuery}"?`;
        }
        return "No relevant information found in web search results.";
      }
      
      // Process the top 3 results to give a more comprehensive summary.
      const searchSummaries = data.items.slice(0, 3).map((item: any, index: number) => {
        const title = item.title;
        const snippet = item.snippet || item.pagemap?.metatags?.[0]?.['og:description'] || 'No description available.';
        return `${index + 1}. ${title}: ${snippet}`;
      }).join('\n');

      return searchSummaries;

    } catch (error) {
      console.error("[WebSearchTool] API call failed:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      return `Sorry, I was unable to perform the web search at this time. Error: ${errorMessage}`;
    }
  }
);

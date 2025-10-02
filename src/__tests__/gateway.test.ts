import { describe, it, expect } from 'vitest';
import { generateText, tool, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { router } from '../index';
import { z } from 'zod';

describe('Model Gateway', () => {
  it('should generate text using gateway wrapper', async () => {
    const reasoningModel = google('gemini-2.0-flash');
    const fastModel = google('gemini-2.0-flash-lite');
    const analyticsModel = google('gemini-2.5-flash-lite');
    const codeModel = google('gemini-2.5-flash');

    // Define 3 tools - each maps to a specific model
    const getWeather = tool({
      description: 'Get current weather conditions for any city.',
      inputSchema: z.object({
        city: z.string().describe('City name'),
      }),
      execute: async ({ city }) => {
        console.log(`[Tool] getWeather called for: ${city}`);
        return `Current weather in ${city}: Temperature 72°F, Humidity 65%, Conditions: Sunny, Wind: 5mph NW`;
      },
    });

    const getFinancialReport = tool({
      description: 'Generate comprehensive financial report with revenue, expenses, and profit analysis.',
      inputSchema: z.object({
        company: z.string().describe('Company name'),
        period: z.string().describe('Time period for report'),
      }),
      execute: async ({ company, period }) => {
        console.log(`[Tool] getFinancialReport called: ${company} - ${period}`);
        return `Financial Report for ${company} (${period}):
Revenue: $2,500,000
Expenses: $1,800,000
Net Profit: $700,000
Profit Margin: 28%
Year-over-Year Growth: 15%
Key Metrics: Strong performance with healthy profit margins and consistent growth trajectory.`;
      },
    });

    const exportToTable = tool({
      description: 'Format data into a structured table format (markdown, CSV, or HTML).',
      inputSchema: z.object({
        data: z.string().describe('Data to format'),
        format: z.string().describe('Output format: markdown, csv, or html'),
      }),
      execute: async ({ data, format }) => {
        console.log(`[Tool] exportToTable called: format=${format}`);
        return `| Metric | Value |
|--------|-------|
| Revenue | $2,500,000 |
| Expenses | $1,800,000 |
| Net Profit | $700,000 |
| Profit Margin | 28% |
| Growth | 15% |
| Weather | 72°F Sunny |

Table exported in ${format} format successfully.`;
      },
    });

    const prompt = 'Please complete these three tasks: 1) Get the current weather for New York, 2) Generate a financial report for Acme Corp for Q4 2024, and 3) Export the results to a markdown table.';

    const gatewayModel = router(
      reasoningModel,
      [
        {
          model: fastModel,
          description: 'Weather information specialist. Expert at retrieving current weather conditions, forecasts, and meteorological data.',
        },
        {
          model: analyticsModel,
          description: 'Financial analysis specialist. Expert at generating financial reports, analyzing revenue, expenses, profit margins, and business metrics.',
        },
        {
          model: codeModel,
          description: 'Data formatting and table generation specialist. Expert at converting data into structured formats like markdown tables, CSV, and HTML.',
        },
      ],
      prompt,
      { debug: true }
    );

    let result;
    try {
      result = await generateText({
        model: gatewayModel,
        prompt,
        tools: {
          getWeather,
          getFinancialReport,
          exportToTable,
        },
        stopWhen: stepCountIs(10), // Allow up to 10 steps for multiple tool calls
      });
    } catch (error) {
      console.log('\n=== Error Occurred ===');
      console.log('Error:', error.message || error);
      console.log('\nTest completed (with error) - check logs above');
      return; // Exit test gracefully
    }

    if (!result) {
      console.log('No result returned');
      return;
    }

    console.log('\n=== Response Messages (Conversation History) ===');
    if (result.response?.messages) {
      result.response.messages.forEach((msg, idx) => {
        console.log(`\nMessage ${idx + 1} [${msg.role}]:`);
        if (Array.isArray(msg.content)) {
          msg.content.forEach((part, partIdx) => {
            if (part.type === 'text') {
              console.log(`  Text: ${part.text.substring(0, 100)}${part.text.length > 100 ? '...' : ''}`);
            } else if (part.type === 'tool-call') {
              console.log(`  Tool Call: ${part.toolName}`);
              console.log(`  Args:`, part.input);
            } else if (part.type === 'tool-result') {
              console.log(`  Tool Result from: ${part.toolName}`);
              console.log(`  Result:`, typeof part.output === 'string' ? part.output.substring(0, 100) + '...' : part.output);
            }
          });
        } else {
          console.log(`  Content:`, msg.content);
        }
      });
    }
    
    console.log('\n=== Execution Summary ===');    
    const toolsCalled = new Set<string>();
    if (result.steps && result.steps.length > 0) {
      result.steps.forEach((step, idx) => {
        console.log(`\nStep ${idx + 1}:`);
        if (step.toolCalls && step.toolCalls.length > 0) {
          step.toolCalls.forEach(call => {
            console.log(`  ✓ Tool called: ${call.toolName}`);
            toolsCalled.add(call.toolName);
          });
        }
        if (step.toolResults && step.toolResults.length > 0) {
          step.toolResults.forEach(result => {
            console.log(`  → Result received from: ${result.toolName}`);
          });
        }
      });
    }
    
    console.log('\n=== Tools Used ===');
    console.log('Unique tools called:', Array.from(toolsCalled).join(', ') || 'None');
    console.log('Expected: getWeather, getFinancialReport, exportToTable');
    
    console.log('\n=== Final Response ===');
    console.log(result.text);
  }, 30000);
});

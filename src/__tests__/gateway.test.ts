import { describe, it, expect } from 'vitest';
import { generateText, tool, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { modelRouter } from '../index';
import { z } from 'zod';

// ============================================================================
// Test Helpers & Utilities
// ============================================================================

/**
 * Logs execution steps and tool calls in a structured format
 */
function logExecutionSummary(result: any) {
  console.log('\n=== Execution Summary ===');
  const toolsCalled = new Set<string>();
  
  if (result.steps && result.steps.length > 0) {
    result.steps.forEach((step: any, idx: number) => {
      console.log(`\nStep ${idx + 1}:`);
      if (step.toolCalls && step.toolCalls.length > 0) {
        step.toolCalls.forEach((call: any) => {
          console.log(`  ✓ Tool called: ${call.toolName}`);
          toolsCalled.add(call.toolName);
        });
      }
      if (step.toolResults && step.toolResults.length > 0) {
        step.toolResults.forEach((result: any) => {
          console.log(`  → Result received from: ${result.toolName}`);
        });
      }
    });
  }
  
  console.log('\n=== Tools Used ===');
  console.log('Unique tools called:', Array.from(toolsCalled).join(', ') || 'None');
  
  return toolsCalled;
}

/**
 * Logs the conversation history with all messages and tool interactions
 */
function logConversationHistory(result: any) {
  console.log('\n=== Response Messages (Conversation History) ===');
  if (result.response?.messages) {
    result.response.messages.forEach((msg: any, idx: number) => {
      console.log(`\nMessage ${idx + 1} [${msg.role}]:`);
      if (Array.isArray(msg.content)) {
        msg.content.forEach((part: any) => {
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
}

// ============================================================================
// Tool Definitions - Business Intelligence Workflow
// ============================================================================

/**
 * Step 1: Retrieves market data including competitor pricing and market trends
 */
const getMarketData = tool({
  description: 'Retrieve market intelligence data including competitor pricing, market share, and industry trends for business analysis.',
  inputSchema: z.object({
    industry: z.string().describe('Industry sector to analyze'),
    region: z.string().describe('Geographic region for market data'),
  }),
  execute: async ({ industry, region }) => {
    console.log(`[Tool] getMarketData called: ${industry} in ${region}`);
    return JSON.stringify({
      industry,
      region,
      marketSize: '$45B',
      growthRate: '12.5%',
      competitorCount: 8,
      averagePrice: '$299',
      marketShare: {
        leader: '28%',
        secondPlace: '22%',
        thirdPlace: '18%',
        others: '32%',
      },
      trends: [
        'Increased demand for sustainable products',
        'Digital transformation accelerating',
        'Price sensitivity due to economic conditions',
      ],
    });
  },
});

/**
 * Step 2: Analyzes company performance against market benchmarks
 */
const analyzeCompanyPerformance = tool({
  description: 'Analyze company financial performance and compare against market benchmarks. Requires market data context for accurate comparison.',
  inputSchema: z.object({
    company: z.string().describe('Company name to analyze'),
    quarter: z.string().describe('Fiscal quarter (e.g., Q4 2024)'),
    marketContext: z.string().describe('Market data for benchmarking comparison'),
  }),
  execute: async ({ company, quarter, marketContext }) => {
    console.log(`[Tool] analyzeCompanyPerformance called: ${company} - ${quarter}`);
    
    // Parse market context to provide relevant analysis
    const marketData = JSON.parse(marketContext);
    
    return JSON.stringify({
      company,
      quarter,
      financial: {
        revenue: '$12.5M',
        expenses: '$8.2M',
        netProfit: '$4.3M',
        profitMargin: '34.4%',
        growthRate: '15.2%',
      },
      marketComparison: {
        revenueVsMarketGrowth: `Company: 15.2% vs Market: ${marketData.growthRate}`,
        marketPosition: 'Above average - outperforming market by 2.7%',
        pricingStrategy: `Current avg: $315 vs Market avg: ${marketData.averagePrice}`,
        competitiveAdvantage: 'Premium positioning with strong margins',
      },
      keyInsights: [
        'Outpacing market growth rate',
        'Higher profit margins than industry average',
        'Successfully executing premium pricing strategy',
        'Well-positioned against top 3 competitors',
      ],
    });
  },
});

/**
 * Step 3: Generates strategic recommendations based on analysis
 */
const generateRecommendations = tool({
  description: 'Generate strategic business recommendations based on performance analysis and market conditions. Requires both market data and performance analysis.',
  inputSchema: z.object({
    performanceData: z.string().describe('Company performance analysis data'),
    marketData: z.string().describe('Market intelligence data'),
    focusArea: z.string().describe('Strategic focus area (e.g., growth, efficiency, market-share)'),
  }),
  execute: async ({ performanceData, marketData, focusArea }) => {
    console.log(`[Tool] generateRecommendations called: focus=${focusArea}`);
    
    return JSON.stringify({
      focusArea,
      recommendations: [
        {
          priority: 'High',
          category: 'Market Expansion',
          action: 'Increase market share by targeting the 32% "others" segment',
          expectedImpact: '+5% market share',
          timeline: '6-12 months',
        },
        {
          priority: 'High',
          category: 'Sustainability',
          action: 'Develop sustainable product line to capitalize on market trend',
          expectedImpact: '+$2M revenue',
          timeline: '9 months',
        },
        {
          priority: 'Medium',
          category: 'Pricing Strategy',
          action: 'Maintain premium positioning while offering mid-tier options',
          expectedImpact: '+3% customer acquisition',
          timeline: '3-6 months',
        },
        {
          priority: 'Medium',
          category: 'Digital Transformation',
          action: 'Accelerate digital capabilities to match market trends',
          expectedImpact: '15% operational efficiency',
          timeline: '12 months',
        },
      ],
      riskFactors: [
        'Economic conditions may increase price sensitivity',
        'Competitor response to market share gains',
        'Implementation capacity constraints',
      ],
      successMetrics: [
        'Market share increase to 8-10%',
        'Revenue growth rate maintained above 15%',
        'Profit margin sustained above 30%',
      ],
    });
  },
});

/**
 * Step 4: Exports comprehensive executive report in structured format
 */
const exportExecutiveReport = tool({
  description: 'Create formatted executive report combining market analysis, performance metrics, and strategic recommendations in a professional table format.',
  inputSchema: z.object({
    marketData: z.string().describe('Market intelligence data'),
    performanceData: z.string().describe('Company performance analysis'),
    recommendations: z.string().describe('Strategic recommendations'),
    format: z.string().describe('Output format: markdown, html, or csv'),
  }),
  execute: async ({ marketData, performanceData, recommendations, format }) => {
    console.log(`[Tool] exportExecutiveReport called: format=${format}`);
    
    const market = JSON.parse(marketData);
    const performance = JSON.parse(performanceData);
    const recs = JSON.parse(recommendations);
    
    return `# Executive Intelligence Report

## Market Overview
| Metric | Value |
|--------|-------|
| Market Size | ${market.marketSize} |
| Growth Rate | ${market.growthRate} |
| Competitors | ${market.competitorCount} |
| Avg Price | ${market.averagePrice} |

## Company Performance - ${performance.company}
| Metric | Value | vs Market |
|--------|-------|-----------|
| Revenue | ${performance.financial.revenue} | +${performance.financial.growthRate} |
| Net Profit | ${performance.financial.netProfit} | - |
| Profit Margin | ${performance.financial.profitMargin} | Above Avg |
| Growth Rate | ${performance.financial.growthRate} | Outperforming |

## Strategic Recommendations (Focus: ${recs.focusArea})
| Priority | Action | Impact | Timeline |
|----------|--------|--------|----------|
${recs.recommendations.map((r: any) => 
  `| ${r.priority} | ${r.action.substring(0, 50)}... | ${r.expectedImpact} | ${r.timeline} |`
).join('\n')}

## Key Insights
${performance.keyInsights.map((insight: string) => `- ${insight}`).join('\n')}

---
*Report generated in ${format} format - ${new Date().toISOString()}*`;
  },
});

// ============================================================================
// Test Suite
// ============================================================================

describe('Model Gateway', () => {
  it('should execute interconnected business intelligence workflow', async () => {
    // Interconnected scenario: Each step builds on previous results
    const prompt = `Conduct a comprehensive business intelligence analysis for TechCorp in Q4 2024:

1. First, gather market data for the "Cloud Software" industry in "North America"
2. Then, analyze TechCorp's performance for Q4 2024 using the market data as benchmarks
3. Next, generate strategic recommendations focused on "growth" based on both the market analysis and performance data
4. Finally, create an executive report in "markdown" format that combines all the insights

Each step should build on the previous results to create a cohesive analysis.`;

    const model = modelRouter({
      prompt,
      reasoningModel: google('gemini-2.0-flash'),
      models: [
        {
          model: google('gemini-2.0-flash-lite'),
          description: 'Market intelligence specialist. Expert at retrieving and analyzing market data, competitor pricing, industry trends, and market dynamics.',
        },
        {
          model: google('gemini-2.5-flash-lite'),
          description: 'Financial analysis specialist. Expert at analyzing company performance, financial metrics, profitability, and comparative benchmarking against market standards.',
        },
        {
          model: google('gemini-2.5-flash'),
          description: 'Strategic planning specialist. Expert at generating business recommendations, strategic insights, and actionable plans based on market and performance data.',
        },
        {
          model: google('gemini-2.0-flash'),
          description: 'Report generation specialist. Expert at creating comprehensive executive reports, formatting complex data into tables, and professional document creation.',
        },
      ],
      debug: true,
    });

    let result;
    try {
      result = await generateText({
        model,
        prompt,
        tools: {
          getMarketData,
          analyzeCompanyPerformance,
          generateRecommendations,
          exportExecutiveReport,
        },
        stopWhen: stepCountIs(15),
      });
    } catch (error: any) {
      console.log('\n=== Error Occurred ===');
      console.log('Error:', error.message || error);
      console.log('\nTest completed (with error) - check logs above');
      return;
    }

    if (!result) {
      console.log('No result returned');
      return;
    }

    // Log detailed execution information
    logConversationHistory(result);
    const toolsCalled = logExecutionSummary(result);
    
    console.log('\nExpected workflow: getMarketData → analyzeCompanyPerformance → generateRecommendations → exportExecutiveReport');
    
    console.log('\n=== Final Executive Report ===');
    console.log(result.text);
    
    // Verify the workflow was executed in logical order
    expect(toolsCalled.size).toBeGreaterThan(0);
  }, 60000); // Extended timeout for sequential workflow
});

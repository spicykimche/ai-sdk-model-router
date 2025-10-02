# ai-sdk-model-router

Intelligent model routing for the Vercel AI SDK. Automatically selects the best specialized model for each step in multi-step AI workflows based on tool usage history and model capabilities.

## Features

- 🎯 **Automatic Model Selection**: Uses a reasoning model to intelligently route ai-sdk orchestrated generations to specialized models depending on the tools required or the specific use-case requirements
- 🔄 **Context-Aware Routing**: Tracks tool call history to make informed routing decisions
- 🛠️ **Tool-Based Workflows**: Perfect for complex, multi-step workflows where different models excel at different tasks, but you don't want to manually orchestrate the models separately with different agents and generations
- 📊 **Debug Mode**: Built-in verbose logging to understand routing decisions

## Installation

```bash
npm install ai-sdk-model-router
# or
pnpm add ai-sdk-model-router
# or
yarn add ai-sdk-model-router
```

## Quick Start

```typescript
import { modelRouter } from 'ai-sdk-model-router';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

const prompt = `Analyze our Q4 performance and create an executive report`;

const model = modelRouter({
  prompt,
  reasoningModel: google('gemini-2.0-flash'),
  models: [
    {
      model: google('gemini-2.0-flash-lite'),
      description: 'Financial analysis specialist. Expert at analyzing financial data and performance metrics.',
    },
    {
      model: google('gemini-2.5-flash'),
      description: 'Report generation specialist. Expert at creating formatted reports and documents.',
    },
  ],
  debug: true, // Enable to see routing decisions
});

const result = await generateText({
  model,
  prompt,
  tools: {
    analyzeFinancials,
    generateReport,
  },
});
```
## API Reference

### `modelRouter(config)`

Creates a routed model that routes to specialized models.

#### Parameters

- `config.prompt` (string): The user's original input prompt
- `config.reasoningModel` (LanguageModel): The model used for routing decisions
- `config.models` (ModelRouterConfig[]): Array of specialized models with descriptions
- `config.debug` (boolean, optional): Enable debug logging

#### ModelRouterConfig

```typescript
interface ModelRouterConfig {
  model: LanguageModel;      // The specialized model instance
  description: string;        // What this model is best used for
}
```

#### Returns

A `LanguageModel` compatible with Vercel AI SDK's `generateText` and `streamText` (and the experimental `Agent` construct).

## Requirements

- Node.js >= 18.0.0
- Vercel AI SDK >= 5.0.0
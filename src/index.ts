import {  
  generateObject,
  LanguageModel,
} from "ai";
import type { 
  LanguageModelV2,
  LanguageModelV2CallOptions,
} from "@ai-sdk/provider";
import { z } from "zod";

/**
 * Configuration for a model in the router
 */
export interface ModelRouterConfig {
  /** The language model instance */
  model: LanguageModel;
  /** Description of what this model is best used for */
  description: string;
}

/**
 * Options for the router
 */
export interface RouterOptions {
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * AI SDK Model router - uses reasoning model to route to the best model
 * @param reasoningModel - The reasoning model used to select the appropriate model
 * @param models - Array of model configurations with descriptions
 * @param inputPrompt - The user's input prompt/query for model selection
 * @param options - Router configuration options
 */
export const router = (
  reasoningModel: LanguageModel,
  models: ModelRouterConfig[],
  inputPrompt: string,
  options: RouterOptions = {}
): LanguageModel => {
  if (models.length === 0) {
    throw new Error("Router requires at least one model configuration");
  }

  const { debug = false } = options;

  const log = (...args: any[]) => {
    if (debug) console.log('[Router]', ...args);
  };

  // Create a proxy model that delegates to the selected model
  const routerModel: LanguageModelV2 = {
    specificationVersion: 'v2',
    provider: 'model-router',
    modelId: 'model-router',
    supportedUrls: {},
    
    async doGenerate(options: LanguageModelV2CallOptions) {
      const selectedModel = await selectModel(reasoningModel, models, inputPrompt, options, log);
      log('Generating a response...');
      const result = await selectedModel.doGenerate(options);
      log('Response generated.');
      return result;
    },

    async doStream(options: LanguageModelV2CallOptions) {
      const selectedModel = await selectModel(reasoningModel, models, inputPrompt, options, log);
      log('Starting stream...');
      const stream = selectedModel.doStream(options);
      log('Stream started.');
      return stream;
    },
  };

  return routerModel as LanguageModel;
};

async function selectModel(
  reasoningModel: LanguageModel,
  models: ModelRouterConfig[],
  inputPrompt: string,
  options: LanguageModelV2CallOptions,
  log: (...args: any[]) => void
): Promise<LanguageModelV2> {
  // Extract available tools
  const availableTools = options.tools 
    ? Object.entries(options.tools).map(([name, tool]) => {
        const description = 'description' in tool ? tool.description : 'No description';
        return `${name}: ${description}`;
      }).join('\n')
    : 'None';

  // Build model options
  const modelOptions = models
    .map((m, idx) => `${idx + 1}. ${`Model ${idx + 1}`}: ${m.description}`)
    .join('\n');

  // Define the schema for model selection
  const selectionSchema = z.object({
    modelIndex: z.number().int().min(1).max(models.length)
      .describe(`The index of the selected model (1-${models.length})`),
    reasoning: z.string()
      .describe('Brief explanation of why this model was selected'),
  });

  const selectionPrompt = `You are a model router. Select the SINGLE BEST language model to handle the CURRENT request.

User Query:
${inputPrompt}

Available Tools:
${availableTools}

Available Models:
${modelOptions}

CRITICAL INSTRUCTIONS:
- You must select EXACTLY ONE model by number
- Use 1-based indexing: valid numbers are 1, 2, or 3 (NEVER use 0)
- Match the model's specialty to the query and available tools
- If the query has multiple tasks, pick the model best suited for the FIRST or MOST IMPORTANT task
- Example: If asked for weather AND financial report, and Model 1 specializes in weather, select 1

Your response MUST include a modelIndex between 1 and ${models.length}.`;

  log('Selecting model...');

  const result = await generateObject({
    model: reasoningModel,
    schema: selectionSchema,
    prompt: selectionPrompt,
  });

  const selectedIndex = result.object.modelIndex - 1;
  const selectedModel = models[selectedIndex].model as LanguageModelV2;
  const selectedModelName = selectedModel.modelId || `Model ${selectedIndex + 1}`;
  
  log(`Selected: ${selectedModelName} - ${result.object.reasoning}`);
  
  return selectedModel;
}
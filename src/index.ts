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
 * Configuration options for the model router
 */
export interface ModelRouterOptions {
  /** The user's original input prompt*/
  prompt: string;
  /** The reasoning model used to select the appropriate model */
  reasoningModel: LanguageModel;
  /** Array of model configurations with descriptions */
  models: ModelRouterConfig[];
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * AI SDK Model router - uses reasoning model to route to the best model
 * @param config - Router configuration object
 */
export const modelRouter = (config: ModelRouterOptions): LanguageModel => {
  const { prompt, reasoningModel, models, debug = false } = config;
  
  if (models.length === 0) {
    throw new Error("Router requires at least one model configuration");
  }

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
      const selectedModel = await selectModel(reasoningModel, models, prompt, options, log);
      log('Generating a response...');
      const result = await selectedModel.doGenerate(options);
      log('Response generated.');
      return result;
    },

    async doStream(options: LanguageModelV2CallOptions) {
      const selectedModel = await selectModel(reasoningModel, models, prompt, options, log);
      log('Starting stream...');
      const stream = selectedModel.doStream(options);
      log('Stream started.');
      return stream;
    },
  };

  return routerModel as LanguageModel;
};

/**
 * Extract tool call history from conversation messages
 * Only includes tool calls that have been completed with a successful result
 */
function extractToolCallHistory(
  messages: any[] | undefined, 
  maxCalls: number = 10
): string {
  if (!messages || messages.length === 0) {
    return 'None - This is the first request';
  }

  const completedToolCalls: Array<{ toolName: string; args: any }> = [];
  const pendingToolCalls = new Map<string, { toolName: string; args: any }>();

  // Iterate through messages to find tool calls and their results
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;

    if (message.role === 'assistant') {
      // Track tool calls from assistant messages
      for (const part of message.content) {
        if (part.type === 'tool-call') {
          const callId = part.toolCallId || part.id || `${part.toolName}-${Date.now()}`;
          pendingToolCalls.set(callId, {
            toolName: part.toolName,
            args: part.args || part.input,
          });
        }
      }
    } else if (message.role === 'tool') {
      // Match tool results with their calls
      for (const part of message.content) {
        if (part.type === 'tool-result') {
          const callId = part.toolCallId || part.id;
          const toolName = part.toolName;
          
          // Find the matching pending call
          if (callId && pendingToolCalls.has(callId)) {
            const call = pendingToolCalls.get(callId)!;
            completedToolCalls.push(call);
            pendingToolCalls.delete(callId);
          } else if (toolName) {
            // Fallback: match by tool name if no ID match
            for (const [id, call] of pendingToolCalls.entries()) {
              if (call.toolName === toolName) {
                completedToolCalls.push(call);
                pendingToolCalls.delete(id);
                break;
              }
            }
          }
        }
      }
    }
  }

  // Take only the last N completed calls
  const recentCalls = completedToolCalls.slice(-maxCalls);

  if (recentCalls.length === 0) {
    return 'None - No tools have been called yet';
  }

  // Format tool calls with their arguments
  return recentCalls
    .map((call, idx) => {
      const argsPreview = JSON.stringify(call.args, null, 0).substring(0, 100);
      return `${idx + 1}. ${call.toolName}(${argsPreview}${argsPreview.length >= 100 ? '...' : ''})`;
    })
    .join('\n');
}

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

  // Extract tool call history from conversation messages
  let messages: any[] | undefined;
  
  if ('messages' in options) {
    messages = options.messages as any[];
  } else if ('prompt' in options && Array.isArray((options as any).prompt)) {
    messages = (options as any).prompt;
  }
  
  const toolCallHistory = extractToolCallHistory(messages, 10);

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

Tool Call History (completed calls with successful results):
${toolCallHistory}

Available Models:
${modelOptions}

CRITICAL INSTRUCTIONS:
- You must select EXACTLY ONE model by number
- Use 1-based indexing: valid numbers are 1 to ${models.length} (NEVER use 0)
- Match the model's specialty to the query and available tools
- Consider which tools have already been called successfully
- For sequential workflows, select the model best suited for the NEXT logical step
- If the query has multiple tasks, pick the model best suited for the CURRENT or MOST IMPORTANT task
- Example: If getMarketData was called, and now we need financial analysis, select the financial analysis specialist

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

import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { ModelType, AppConfig, ChatMessage, Detection } from "../types";

// Tool definition for the Agent to self-modify
const updateWorkspaceTool: FunctionDeclaration = {
  name: 'update_workspace',
  description: 'Updates the current app template, including its name, description, icon, or system instructions.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'The new name of the application' },
      description: { type: Type.STRING, description: 'The new description of the application' },
      systemInstruction: { type: Type.STRING, description: 'The new system instruction/prompt that defines agent behavior' },
      icon: { type: Type.STRING, description: 'A single emoji to use as the app icon' },
      temperature: { type: Type.NUMBER, description: 'New temperature setting (0.0 to 2.0)' }
    },
  }
};

export const generateAppResponse = async (
  config: AppConfig,
  history: ChatMessage[],
  userMessage: string,
  imageData?: { data: string; mimeType: string },
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const contents: any[] = history.map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const currentParts: any[] = [];
  if (userMessage.trim()) currentParts.push({ text: userMessage });
  if (imageData) currentParts.push({ inlineData: imageData });

  if (currentParts.length === 0) currentParts.push({ text: "..." });

  contents.push({ role: 'user', parts: currentParts });

  try {
    const response = await ai.models.generateContent({
      model: config.model,
      contents: contents,
      config: {
        systemInstruction: config.systemInstruction,
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        maxOutputTokens: config.maxOutputTokens,
        tools: [{ functionDeclarations: [updateWorkspaceTool] }]
      },
    });

    return {
      text: response.text,
      functionCalls: response.functionCalls
    };
  } catch (error: any) {
    if (error.message?.includes('401') || error.message?.includes('UNAUTHENTICATED')) {
      throw new Error('AUTH_ERROR');
    }
    throw error;
  }
};

export const detectObjects = async (imageData: { data: string; mimeType: string }): Promise<Detection[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: "Detect objects in this image. Return labels and [ymin, xmin, ymax, xmax] coordinates (0-1000)." },
          { inlineData: imageData }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER } }
            },
            required: ["label", "box_2d"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (e) {
    return [];
  }
};

export const architectApp = async (prompt: string, currentConfig?: AppConfig): Promise<Partial<AppConfig>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const systemInstruction = `
    Design an AI micro-app based on user requests.
    Return JSON:
    {
      "name": "App name",
      "description": "Short description",
      "systemInstruction": "Detailed prompt instructions",
      "icon": "Emoji icon"
    }
  `;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Refactor this app: ${prompt}. Current state: ${JSON.stringify(currentConfig || {})}`,
      config: { systemInstruction, responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
  } catch (e) {
    return {};
  }
};

import axios from "axios";
import { logger } from "../utils/logger.js";

export type AiSuggestion = { 
  originalText: string; 
  suggestedReplacement: string; 
  confidence: number; 
  reason?: string;
  context?: string;
};

const AI_PROVIDER = process.env.AI_PROVIDER || "none";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";

// Gemini 2.5 Pro API configuration
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiRequest {
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
  }>;
  generationConfig: {
    temperature: number;
    topK: number;
    topP: number;
    maxOutputTokens: number;
  };
  safetySettings: Array<{
    category: string;
    threshold: string;
  }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

async function callGemini(prompt: string, maxTokens = 500, requestId?: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured");
  }

  const timeout = parseInt(process.env.AI_SUGGESTION_TIMEOUT || "10000");

  const requestBody: GeminiRequest = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.3, // Lower temperature for more consistent results
      topK: 40,
      topP: 0.95,
      maxOutputTokens: maxTokens
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  };

  try {
    const response = await axios.post<GeminiResponse>(
      `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        timeout: timeout
      }
    );

    const candidate = response.data.candidates?.[0];
    if (!candidate) {
      throw new Error("No response from Gemini API");
    }

    if (candidate.finishReason !== "STOP") {
      logger.warn("Gemini response not complete", { 
        requestId,
        finishReason: candidate.finishReason,
        safetyRatings: candidate.safetyRatings 
      });
    }

    return candidate.content.parts[0]?.text || "";
  } catch (error: any) {
    logger.error("Gemini API call failed", {
      requestId,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

/**
 * Generate AI-powered replacement suggestions for text content
 */
export async function askAIForSuggestions(
  text: string, 
  context?: {
    contentTypeUid?: string;
    entryUid?: string;
    sampleEntityCount?: number;
    replacementRule?: {
      find: string;
      replace: string;
      mode?: string;
    };
  },
  requestId?: string
): Promise<AiSuggestion[]> {
  if (AI_PROVIDER !== "gemini" || !GEMINI_API_KEY) {
    logger.debug("AI suggestions disabled - no provider configured", { requestId });
    return [];
  }

  if (!text || text.length < 10) {
    logger.debug("Text too short for AI suggestions", { requestId });
    return [];
  }

  const maxSuggestions = parseInt(process.env.AI_MAX_SUGGESTIONS || "5");
  
  // Craft a sophisticated prompt for Gemini 2.5 Pro
  const prompt = `You are an expert content strategist and copywriter specializing in content management systems. Your task is to analyze text content and suggest intelligent, context-aware replacements for potential updates.

CONTEXT:
- Content Type: ${context?.contentTypeUid || "Unknown"}
- Entry ID: ${context?.entryUid || "Unknown"}
- Detected Entities: ${context?.sampleEntityCount || 0}
- Current Replacement Rule: ${context?.replacementRule ? `${context.replacementRule.find} → ${context.replacementRule.replace}` : "None"}

TEXT TO ANALYZE:
"""
${text}
"""

ANALYSIS REQUIREMENTS:
1. Identify potential replacement candidates (brand names, product names, versions, contact info, etc.)
2. Consider the context and suggest appropriate replacements
3. Maintain brand consistency and professional tone
4. Consider version increments, contact updates, and brand evolution

OUTPUT FORMAT:
Return a JSON array of replacement suggestions. Each suggestion must have:
- originalText: The text to be replaced
- suggestedReplacement: The proposed replacement
- confidence: Confidence score (0.0 to 1.0)
- reason: Brief explanation of why this replacement makes sense
- context: Additional context about the replacement

EXAMPLE OUTPUT:
[
  {
    "originalText": "Contact us at support@oldcompany.com",
    "suggestedReplacement": "Contact us at support@newcompany.com",
    "confidence": 0.9,
    "reason": "Update contact email to reflect new company domain",
    "context": "Contact information update"
  },
  {
    "originalText": "Version 2.1.0",
    "suggestedReplacement": "Version 2.2.0",
    "confidence": 0.8,
    "reason": "Increment minor version for feature updates",
    "context": "Version management"
  }
]

IMPORTANT:
- Only suggest replacements that make business sense
- Maintain consistency with existing content style
- Consider the target audience and brand voice
- Return valid JSON only, no additional text
- Maximum ${maxSuggestions} suggestions to avoid overwhelming users`;

  try {
    logger.info("Requesting AI suggestions from Gemini", {
      requestId,
      textLength: text.length,
      context: context?.contentTypeUid,
      model: GEMINI_MODEL
    });

    const rawResponse = await callGemini(prompt, 800, requestId);
    
    // Parse JSON response from Gemini
    const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn("No valid JSON found in Gemini response", { 
        requestId,
        response: rawResponse 
      });
      return [];
    }

    const suggestions = JSON.parse(jsonMatch[0]) as AiSuggestion[];
    
    // Validate and clean suggestions
    const validSuggestions = suggestions
      .filter(s => 
        s.originalText && 
        s.suggestedReplacement && 
        typeof s.confidence === 'number' &&
        s.confidence >= 0 && 
        s.confidence <= 1
      )
      .map(s => ({
        ...s,
        confidence: Math.min(Math.max(s.confidence, 0), 1), // Clamp to 0-1
        reason: s.reason || "AI-generated suggestion",
        context: s.context || "Content optimization"
      }))
      .slice(0, maxSuggestions); // Limit to max suggestions

    logger.info("AI suggestions generated", {
      requestId,
      count: validSuggestions.length,
      avgConfidence: validSuggestions.reduce((sum, s) => sum + s.confidence, 0) / validSuggestions.length
    });

    return validSuggestions;
  } catch (error: any) {
    logger.error("AI suggestion generation failed", {
      requestId,
      error: error.message,
      textLength: text.length,
      context: context?.contentTypeUid
    });
    return [];
  }
}

/**
 * Generate contextual replacement suggestions for specific replacement rules
 */
export async function generateContextualReplacements(
  findText: string,
  replaceText: string,
  context: {
    contentTypeUid?: string;
    entryUid?: string;
    surroundingText?: string;
  },
  requestId?: string
): Promise<AiSuggestion[]> {
  if (AI_PROVIDER !== "gemini" || !GEMINI_API_KEY) {
    logger.debug("Contextual replacements disabled - no provider configured", { requestId });
    return [];
  }

  const prompt = `You are a content management expert. Given a replacement rule, suggest contextually appropriate alternatives.

REPLACEMENT RULE:
- Find: "${findText}"
- Replace with: "${replaceText}"

CONTEXT:
- Content Type: ${context.contentTypeUid || "Unknown"}
- Entry: ${context.entryUid || "Unknown"}
- Surrounding Text: "${context.surroundingText || "Not provided"}"

TASK:
Suggest 2-3 alternative replacements that would be contextually appropriate, considering:
1. Brand consistency
2. Tone and style
3. Target audience
4. Content purpose

Return JSON array with originalText, suggestedReplacement, confidence, reason, and context fields.`;

  try {
    const rawResponse = await callGemini(prompt, 400, requestId);
    const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) return [];
    
    const suggestions = JSON.parse(jsonMatch[0]) as AiSuggestion[];
    return suggestions.filter(s => s.originalText && s.suggestedReplacement);
  } catch (error: any) {
    logger.error("Contextual replacement generation failed", { 
      requestId,
      error: error.message 
    });
    return [];
  }
}

/**
 * Check if AI service is available and configured
 */
export function isAiServiceAvailable(): boolean {
  return AI_PROVIDER === "gemini" && !!GEMINI_API_KEY;
}

/**
 * Get AI service status and configuration
 */
export function getAiServiceStatus() {
  return {
    provider: AI_PROVIDER,
    available: isAiServiceAvailable(),
    model: GEMINI_MODEL,
    hasApiKey: !!GEMINI_API_KEY
  };
}
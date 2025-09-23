'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  RefreshCw, 
  Copy,
  Check,
  AlertTriangle,
  Target,
  Sparkles
} from 'lucide-react';
import { enhancedApi } from '@/lib/enhanced-api';

interface AISuggestion {
  originalText: string;
  suggestedReplacement: string;
  confidence: number;
  reason: string;
  context?: string;
  source?: string;
}

interface AITextAnalyzerProps {
  initialText?: string;
  contentTypeUid?: string;
  onSuggestionApply?: (suggestion: AISuggestion) => void;
}

export function AITextAnalyzer({ 
  initialText = '', 
  contentTypeUid,
  onSuggestionApply 
}: AITextAnalyzerProps) {
  const [inputText, setInputText] = useState(initialText);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<number>>(new Set());

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to analyze');
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      // Analyzing text
      
      const response = await enhancedApi.getSuggestions(inputText, contentTypeUid);
      // AI Response received

      // Type assertion to help TypeScript understand the structure
      const typedResponse = response as {
        ok: boolean;
        data?: { suggestions?: AISuggestion[] };
      };

      if (typedResponse.ok && typedResponse.data && typedResponse.data.suggestions) {
        setSuggestions(typedResponse.data.suggestions);
        // Suggestions found
      } else {
        console.warn('⚠️ No suggestions found:', response);
        setSuggestions([]);
      }
    } catch (err) {
      console.error('❌ Error getting suggestions:', err);
      setError(err instanceof Error ? err.message : 'Failed to get AI suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestion = (suggestion: AISuggestion, index: number) => {
    // Apply suggestion to the text
    const updatedText = inputText.replace(suggestion.originalText, suggestion.suggestedReplacement);
    setInputText(updatedText);
    
    // Mark as applied
    setAppliedSuggestions(prev => new Set([...prev, index]));
    
    // Callback for parent component
    onSuggestionApply?.(suggestion);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(inputText);
  };

  const getSuggestionColor = (source: string = 'ai') => {
    switch (source) {
      case 'ai': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'brandkit': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'contextual': return 'bg-green-100 text-green-800 border-green-200';
      case 'heuristic': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Text Analyzer</h1>
          <p className="text-gray-600">Get intelligent replacement suggestions powered by AI</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>gemini (gemini-2.0-flash-exp) - Available</span>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Enter text to analyze:
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">
                {inputText.length} characters
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyText}
                disabled={!inputText}
                className="flex items-center space-x-1"
              >
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </Button>
            </div>
          </div>
          
          <textarea
            placeholder='Enter any text content here - no need for structured format like "text": "...". Just paste your content directly!'
            value={inputText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputText(e.target.value)}
            className="w-full min-h-[200px] font-mono text-sm p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={50000}
          />
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              <p>💡 Tip: You can enter any text content directly - articles, product descriptions, emails, etc.</p>
            </div>
            
            <Button 
              onClick={handleAnalyze}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4" />
              )}
              <span>{loading ? 'Analyzing...' : 'Get Suggestions'}</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </Card>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              AI Suggestions ({suggestions.length})
            </h3>
            <Badge variant="outline" className="text-sm">
              AI-Powered
            </Badge>
          </div>

          <div className="space-y-4">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg transition-all ${
                  appliedSuggestions.has(index) 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-white border-gray-200 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    {/* Original vs Suggested */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          Original
                        </h4>
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm font-mono">
                          {suggestion.originalText}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          Suggested
                        </h4>
                        <div className="p-2 bg-green-50 border border-green-200 rounded text-sm font-mono">
                          {suggestion.suggestedReplacement}
                        </div>
                      </div>
                    </div>

                    {/* Reason & Context */}
                    <div>
                      <p className="text-sm text-gray-700 mb-1">
                        <span className="font-medium">Reason:</span> {suggestion.reason}
                      </p>
                      {suggestion.context && (
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">Context:</span> {suggestion.context}
                        </p>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center space-x-3">
                      <Badge className={getSuggestionColor(suggestion.source)}>
                        {suggestion.source || 'ai'}
                      </Badge>
                      <span className={`text-sm font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                        {Math.round(suggestion.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="ml-4">
                    {appliedSuggestions.has(index) ? (
                      <div className="flex items-center space-x-2 text-green-600">
                        <Check className="w-4 h-4" />
                        <span className="text-sm font-medium">Applied</span>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleApplySuggestion(suggestion, index)}
                        size="sm"
                        className="flex items-center space-x-2"
                      >
                        <Target className="w-4 h-4" />
                        <span>Apply</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* No Suggestions State */}
      {!loading && suggestions.length === 0 && inputText.trim() && !error && (
        <Card className="p-8">
          <div className="text-center">
            <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Suggestions Found</h3>
            <p className="text-gray-600 mb-4">
              The AI couldn&apos;t find any improvement suggestions for this text. Your content might already be well-optimized!
            </p>
            <Button onClick={handleAnalyze} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="p-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Your Text</h3>
            <p className="text-gray-600">
              AI is examining your content for improvement opportunities...
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
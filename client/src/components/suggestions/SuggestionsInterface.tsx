'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Lightbulb, 
  Brain, 
  Zap, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Send,
  Loader,
  Star,
  TrendingUp,
  Info,
  AlertTriangle,
  Copy,
  Target,
  MessageSquare
} from 'lucide-react';
import { enhancedApi, BrandkitSuggestion, ToneAnalysisResponse } from '@/lib/enhanced-api';

interface Suggestion {
  entity: {
    type: string;
    text: string;
    confidence: number;
    source: string;
  };
  suggestedReplacement: string;
  confidence: number;
  reason: string;
  source: string;
  context: string;
  domainAdjustedConfidence: number;
  relevanceScore: number;
  scoringMetrics: {
    semanticSimilarity: number;
    contextualRelevance: number;
    domainSpecificWeight: number;
    historicalPerformance: number;
    userBehaviorScore: number;
    contentTypeAlignment: number;
    brandConsistency: number;
    urgencyScore: number;
  };
  scoreExplanation: string[];
  suggestionId: string;
  autoApply: boolean;
}

interface SuggestionResult {
  suggestions: Suggestion[];
  textLength: number;
  suggestionCount: number;
}

interface BatchSuggestionResult {
  results: Array<{
    index: number;
    text: string;
    suggestions: Suggestion[];
    suggestionCount: number;
  }>;
  batchSize: number;
  totalSuggestions: number;
  successCount: number;
}

interface SuggestionsInterfaceProps {
  onSuggestionApplied?: (suggestion: Suggestion) => void;
}

export function SuggestionsInterface({ onSuggestionApplied }: SuggestionsInterfaceProps) {
  const [activeMode, setActiveMode] = useState<'single' | 'batch'>('single');
  const [inputText, setInputText] = useState('');
  const [batchTexts, setBatchTexts] = useState<string[]>(['', '']);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [batchResults, setBatchResults] = useState<BatchSuggestionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [brandkitSuggestions, setBrandkitSuggestions] = useState<BrandkitSuggestion[]>([]);
  const [toneAnalysis, setToneAnalysis] = useState<ToneAnalysisResponse | null>(null);
  const [showToneAnalysis, setShowToneAnalysis] = useState(false);

  // Load AI status on component mount
  useEffect(() => {
    loadAiStatus();
  }, []);

  const loadAiStatus = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/suggest/ai-status?environment=${process.env.NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT}&branch=${process.env.NEXT_PUBLIC_CONTENTSTACK_BRANCH}`);
      const result = await response.json();
      if (result.ok) {
        setAiStatus(result.data);
      }
    } catch (err) {
      console.warn('Failed to load AI status:', err);
    }
  };

  const getSingleSuggestions = async () => {
    if (!inputText.trim()) return;
    
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setBrandkitSuggestions([]);
    setToneAnalysis(null);
    
    try {
      // Get AI suggestions
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/suggest?environment=${process.env.NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT}&branch=${process.env.NEXT_PUBLIC_CONTENTSTACK_BRANCH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText,
          contentTypeUid: 'general'
        })
      });
      
      const result = await response.json();
      
      if (result.ok) {
        setSuggestions(result.data.suggestions || []);
      } else {
        setError(result.error || 'Failed to get suggestions');
      }

      // Get brandkit suggestions
      try {
        const brandkitResponse = await enhancedApi.getBrandkitSuggestions(inputText, { contentTypeUid: 'general' });
        if (brandkitResponse.success && brandkitResponse.data.suggestions) {
          setBrandkitSuggestions(brandkitResponse.data.suggestions);
          // Brandkit suggestions loaded
        }
      } catch (err) {
      }

      // Get tone analysis
      try {
        const toneResponse = await enhancedApi.analyzeTone(inputText, { targetTone: 'professional' });
        if (toneResponse.success && toneResponse.data) {
          setToneAnalysis(toneResponse);
          // Tone analysis completed
        }
      } catch (err) {
        console.warn('⚠️ Failed to analyze tone:', err);
      }

    } catch (err) {
      setError('Network error while getting suggestions');
      console.error('Error getting suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  const getBatchSuggestions = async () => {
    const validTexts = batchTexts.filter(text => text.trim());
    if (validTexts.length === 0) return;
    
    setLoading(true);
    setError(null);
    setBatchResults(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/suggest/batch?environment=${process.env.NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT}&branch=${process.env.NEXT_PUBLIC_CONTENTSTACK_BRANCH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: validTexts,
          contentTypeUid: 'general'
        })
      });
      
      const result = await response.json();
      
      if (result.ok) {
        setBatchResults(result.data);
      } else {
        setError(result.error || 'Failed to get batch suggestions');
      }
    } catch (err) {
      setError('Network error while getting batch suggestions');
      console.error('Error getting batch suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case 'ai': return Brain;
      case 'heuristic': return Zap;
      case 'brandkit': return Star;
      default: return Lightbulb;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source.toLowerCase()) {
      case 'ai': return 'text-purple-600 bg-purple-50';
      case 'heuristic': return 'text-blue-600 bg-blue-50';
      case 'brandkit': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const handleApplySuggestion = (suggestion: Suggestion) => {
      // Applying suggestion
    onSuggestionApplied?.(suggestion);
  };

  const addBatchText = () => {
    setBatchTexts([...batchTexts, '']);
  };

  const removeBatchText = (index: number) => {
    setBatchTexts(batchTexts.filter((_, i) => i !== index));
  };

  const updateBatchText = (index: number, value: string) => {
    const newTexts = [...batchTexts];
    newTexts[index] = value;
    setBatchTexts(newTexts);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleApplyBrandkitSuggestion = (suggestion: BrandkitSuggestion) => {
      // Applying brandkit suggestion
    // You can implement specific brandkit suggestion application logic here
  };

  const handleToneAnalysisToggle = () => {
    setShowToneAnalysis(!showToneAnalysis);
  };

  const getToneColor = (tone: string) => {
    switch (tone.toLowerCase()) {
      case 'professional': return 'text-green-600 bg-green-50';
      case 'casual': return 'text-blue-600 bg-blue-50';
      case 'friendly': return 'text-yellow-600 bg-yellow-50';
      case 'formal': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const renderSuggestionCard = (suggestion: Suggestion, index: number) => {
    const SourceIcon = getSourceIcon(suggestion.source);
    
    return (
      <Card key={`${suggestion.suggestionId}-${index}`} className="p-4 border-l-4 border-l-blue-500">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <div className={`p-1 rounded ${getSourceColor(suggestion.source)}`}>
                <SourceIcon className="w-4 h-4" />
              </div>
              <Badge variant="outline" className="text-xs">
                {suggestion.entity.type}
              </Badge>
              <Badge className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}>
                {Math.round(suggestion.confidence * 100)}% confidence
              </Badge>
              {suggestion.autoApply && (
                <Badge variant="outline" className="text-xs text-green-600">
                  Auto-apply ready
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => handleApplySuggestion(suggestion)}
              className="flex items-center space-x-1"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Apply</span>
            </Button>
          </div>

          {/* Original vs Suggested */}
          <div className="space-y-2">
            <div className="p-2 bg-red-50 border border-red-200 rounded">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-red-800">Original:</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(suggestion.entity.text)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-red-900 font-mono text-sm">{suggestion.entity.text}</p>
            </div>
            <div className="p-2 bg-green-50 border border-green-200 rounded">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800">Suggested:</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(suggestion.suggestedReplacement)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-green-900 font-mono text-sm">{suggestion.suggestedReplacement}</p>
            </div>
          </div>

          {/* Reason */}
          <div className="p-2 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center space-x-1 mb-1">
              <Info className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-800">Reason:</span>
            </div>
            <p className="text-blue-900 text-sm">{suggestion.reason}</p>
          </div>

          {/* Metrics */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
              View detailed metrics
            </summary>
            <div className="mt-2 p-2 bg-gray-50 border rounded text-xs space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <div>Semantic Similarity: {Math.round(suggestion.scoringMetrics.semanticSimilarity * 100)}%</div>
                <div>Contextual Relevance: {Math.round(suggestion.scoringMetrics.contextualRelevance * 100)}%</div>
                <div>Domain Weight: {Math.round(suggestion.scoringMetrics.domainSpecificWeight * 100)}%</div>
                <div>Content Alignment: {Math.round(suggestion.scoringMetrics.contentTypeAlignment * 100)}%</div>
                <div>Brand Consistency: {Math.round(suggestion.scoringMetrics.brandConsistency * 100)}%</div>
                <div>Urgency Score: {Math.round(suggestion.scoringMetrics.urgencyScore * 100)}%</div>
              </div>
              {suggestion.scoreExplanation.length > 0 && (
                <div className="mt-2">
                  <strong>Key factors:</strong> {suggestion.scoreExplanation.join(', ')}
                </div>
              )}
            </div>
          </details>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Suggestions</h1>
          <p className="text-gray-600">Get intelligent replacement suggestions powered by AI</p>
        </div>
        
        {/* AI Status */}
        {aiStatus && (
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${aiStatus.available ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {aiStatus.provider} ({aiStatus.model}) - {aiStatus.available ? 'Available' : 'Unavailable'}
            </span>
          </div>
        )}
      </div>

      {/* Mode Toggle */}
      <Card className="p-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Mode:</span>
          <div className="flex space-x-2">
            <Button
              variant={activeMode === 'single' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveMode('single')}
            >
              Single Text
            </Button>
            <Button
              variant={activeMode === 'batch' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveMode('batch')}
            >
              Batch Processing
            </Button>
          </div>
        </div>
      </Card>

      {/* Single Text Mode */}
      {activeMode === 'single' && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter text to analyze:
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Enter your text here to get AI-powered replacement suggestions..."
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <Button 
              onClick={getSingleSuggestions}
              disabled={loading || !inputText.trim()}
              className="flex items-center space-x-2"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{loading ? 'Analyzing...' : 'Get Suggestions'}</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Batch Mode */}
      {activeMode === 'batch' && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Enter multiple texts to analyze:
              </label>
              <Button variant="outline" size="sm" onClick={addBatchText}>
                Add Text
              </Button>
            </div>
            
            <div className="space-y-3">
              {batchTexts.map((text, index) => (
                <div key={index} className="flex space-x-2">
                  <Input
                    value={text}
                    onChange={(e) => updateBatchText(index, e.target.value)}
                    placeholder={`Text ${index + 1}...`}
                    className="flex-1"
                  />
                  {batchTexts.length > 2 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => removeBatchText(index)}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            <Button 
              onClick={getBatchSuggestions}
              disabled={loading || batchTexts.every(text => !text.trim())}
              className="flex items-center space-x-2"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{loading ? 'Processing...' : 'Process Batch'}</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </Card>
      )}

      {/* Single Mode Results */}
      {activeMode === 'single' && suggestions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Suggestions ({suggestions.length})
            </h2>
            <Badge variant="outline" className="flex items-center space-x-1">
              <TrendingUp className="w-3 h-3" />
              <span>AI-Powered</span>
            </Badge>
          </div>
          
          <div className="space-y-4">
            {suggestions.map((suggestion, index) => renderSuggestionCard(suggestion, index))}
          </div>
        </div>
      )}

      {/* Brandkit Suggestions */}
      {activeMode === 'single' && brandkitSuggestions.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-600" />
              <span>Brandkit Suggestions</span>
            </h2>
            <Badge variant="outline" className="flex items-center space-x-1">
              <Target className="w-3 h-3" />
              <span>Brand-Specific</span>
            </Badge>
          </div>
          
          <div className="space-y-4">
            {brandkitSuggestions.map((suggestion, index) => (
              <Card key={index} className="p-4 border-l-4 border-l-yellow-500">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-1 rounded text-yellow-600 bg-yellow-50">
                        <Star className="w-4 h-4" />
                      </div>
                      <Badge className="text-xs text-yellow-600 bg-yellow-50">
                        Brandkit
                      </Badge>
                      <Badge className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}>
                        {Math.round(suggestion.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleApplyBrandkitSuggestion(suggestion)}
                      className="flex items-center space-x-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Apply</span>
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="p-2 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-red-800">Original:</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => copyToClipboard(suggestion.text)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-red-900 font-mono text-sm">{suggestion.text}</p>
                    </div>
                    <div className="p-2 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-800">Suggested:</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => copyToClipboard(suggestion.suggestedReplacement)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-green-900 font-mono text-sm">{suggestion.suggestedReplacement}</p>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600">
                    <p><strong>Reason:</strong> {suggestion.reason}</p>
                    {suggestion.context && (
                      <p><strong>Context:</strong> {suggestion.context}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Tone Analysis */}
      {activeMode === 'single' && toneAnalysis && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <span>Tone Analysis</span>
            </h2>
            <div className="flex items-center space-x-2">
              <Badge className={`text-xs ${getToneColor(toneAnalysis.data.overallTone)}`}>
                {toneAnalysis.data.overallTone}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {Math.round(toneAnalysis.data.confidence * 100)}% confidence
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleToneAnalysisToggle}
              >
                {showToneAnalysis ? 'Hide Details' : 'Show Details'}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Overall Tone: {toneAnalysis.data.overallTone}</h3>
              <p className="text-blue-800 text-sm">Confidence: {Math.round(toneAnalysis.data.confidence * 100)}%</p>
            </div>

            {toneAnalysis.data.suggestions.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">General Suggestions:</h4>
                <ul className="space-y-1">
                  {toneAnalysis.data.suggestions.map((suggestion: string, index: number) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {showToneAnalysis && toneAnalysis.data.issues.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Specific Issues:</h4>
                <div className="space-y-3">
                  {toneAnalysis.data.issues.map((issue: any, index: number) => (
                    <div key={index} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge className={`text-xs ${getSeverityColor(issue.severity)}`}>
                            {issue.severity}
                          </Badge>
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            "{issue.text}"
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">
                        <strong>Issue:</strong> {issue.issue}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Suggestion:</strong> {issue.suggestion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Batch Mode Results */}
      {activeMode === 'batch' && batchResults && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Batch Results ({batchResults.totalSuggestions} total suggestions)
            </h2>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                {batchResults.successCount}/{batchResults.batchSize} processed
              </Badge>
              <Badge variant="outline" className="flex items-center space-x-1">
                <TrendingUp className="w-3 h-3" />
                <span>AI-Powered</span>
              </Badge>
            </div>
          </div>
          
          {batchResults.results.map((result, resultIndex) => (
            <Card key={resultIndex} className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Text {result.index + 1}</h3>
                  <Badge variant="outline">
                    {result.suggestionCount} suggestions
                  </Badge>
                </div>
                
                <div className="p-2 bg-gray-50 border rounded text-sm">
                  <strong>Original text:</strong> {result.text}
                </div>
                
                <div className="space-y-3">
                  {result.suggestions.map((suggestion, suggestionIndex) => 
                    renderSuggestionCard(suggestion, suggestionIndex)
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && suggestions.length === 0 && !batchResults && (
        <Card className="p-12">
          <div className="text-center">
            <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready for AI Suggestions</h3>
            <p className="text-gray-600 mb-4">
              {activeMode === 'single' 
                ? 'Enter text above to get intelligent replacement suggestions' 
                : 'Add multiple texts to process them all at once'
              }
            </p>
            <Badge variant="outline" className="flex items-center space-x-1 mx-auto w-fit">
              <Brain className="w-3 h-3" />
              <span>Powered by {aiStatus?.model || 'AI'}</span>
            </Badge>
          </div>
        </Card>
      )}
    </div>
  );
}
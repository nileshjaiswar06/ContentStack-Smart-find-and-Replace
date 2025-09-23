'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Replace, 
  Zap, 
  Eye, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Brain,
  Target,
  Clock,
  FileText,
  Package,
  Tag
} from 'lucide-react';
import { enhancedApi, ServerPreviewResponse, ServerApplyResponse } from '@/lib/enhanced-api';

interface SmartReplaceInterfaceProps {
  selectedContentType?: string;
  selectedEntries?: string[];
  onPreviewGenerated: (preview: ServerPreviewResponse) => void;
  onChangesApplied: (result: ServerApplyResponse) => void;
}

export function SmartReplaceInterface({
  selectedContentType,
  selectedEntries = [],
  onPreviewGenerated,
  onChangesApplied
}: SmartReplaceInterfaceProps) {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [options, setOptions] = useState({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    applySuggestions: false,
    dryRun: true
  });
  const [preview, setPreview] = useState<ServerPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const contentTypes = [
    { uid: 'article', name: 'Articles', icon: FileText, color: 'text-blue-600' },
    { uid: 'product', name: 'Products', icon: Package, color: 'text-green-600' },
    { uid: 'brands', name: 'Brands', icon: Tag, color: 'text-purple-600' },
  ];

  const getContentTypeInfo = (uid: string) => {
    return contentTypes.find(ct => ct.uid === uid) || contentTypes[0];
  };

  const handleGeneratePreview = async () => {
    if (!findText || !selectedContentType || selectedEntries.length === 0) {
      setError('Please select content type and entries, and enter text to find');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request = {
        target: {
          contentTypeUid: selectedContentType,
          entryUid: selectedEntries[0] // Preview first entry
        },
        rule: {
          find: findText,
          replace: replaceText,
          mode: options.useRegex ? 'regex' as const : 'literal' as const,
          caseSensitive: options.caseSensitive,
          wholeWord: options.wholeWord
        },
        applySuggestions: options.applySuggestions
      };

      const response = await enhancedApi.previewReplace(request);
      setPreview(response);
      onPreviewGenerated(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!preview || !selectedContentType || selectedEntries.length === 0) {
      setError('No preview available to apply');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request = {
        target: {
          contentTypeUid: selectedContentType,
          entryUid: selectedEntries[0]
        },
        rule: {
          find: findText,
          replace: replaceText,
          mode: options.useRegex ? 'regex' as const : 'literal' as const,
          caseSensitive: options.caseSensitive,
          wholeWord: options.wholeWord
        },
        applySuggestions: options.applySuggestions
      };

      const response = await enhancedApi.applyReplace(request);
      onChangesApplied(response);
      
      // Refresh preview after applying
      await handleGeneratePreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
    } finally {
      setLoading(false);
    }
  };

  const handleGetSuggestions = async () => {
    if (!findText) return;

    try {
      const response = await enhancedApi.getSuggestions(findText, selectedContentType);
      setAiSuggestions(response.suggestions || []);
    } catch (err) {
      console.warn('Failed to get AI suggestions:', err);
    }
  };

  useEffect(() => {
    if (findText && selectedContentType && findText.length > 2) {
      const timeoutId = setTimeout(() => {
        handleGetSuggestions();
      }, 2000); // Increased debounce time
      return () => clearTimeout(timeoutId);
    }
  }, [findText, selectedContentType]);

  const getSuggestionColor = (source: string) => {
    switch (source) {
      case 'ai': return 'bg-purple-100 text-purple-800';
      case 'brandkit': return 'bg-blue-100 text-blue-800';
      case 'contextual': return 'bg-green-100 text-green-800';
      case 'heuristic': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Find & Replace</h1>
          <p className="text-gray-600">AI-powered content replacement with intelligent suggestions</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Advanced</span>
          </Button>
        </div>
      </div>

      {/* Content Type Selection */}
      {selectedContentType && (
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${getContentTypeInfo(selectedContentType).color} bg-opacity-20`}>
              {React.createElement(getContentTypeInfo(selectedContentType).icon, { className: "w-5 h-5" })}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{getContentTypeInfo(selectedContentType).name}</h3>
              <p className="text-sm text-gray-500">{selectedEntries.length} entries selected</p>
            </div>
          </div>
        </Card>
      )}

      {/* Main Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Find & Replace Inputs */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Find & Replace</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Find Text
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Enter text to find..."
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Replace With
              </label>
              <div className="relative">
                <Replace className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Enter replacement text..."
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="caseSensitive"
                  checked={options.caseSensitive}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, caseSensitive: !!checked }))}
                />
                <label htmlFor="caseSensitive" className="text-sm text-gray-700">
                  Case sensitive
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="wholeWord"
                  checked={options.wholeWord}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, wholeWord: !!checked }))}
                />
                <label htmlFor="wholeWord" className="text-sm text-gray-700">
                  Whole word only
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useRegex"
                  checked={options.useRegex}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, useRegex: !!checked }))}
                />
                <label htmlFor="useRegex" className="text-sm text-gray-700">
                  Use regular expressions
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="applySuggestions"
                  checked={options.applySuggestions}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, applySuggestions: !!checked }))}
                />
                <label htmlFor="applySuggestions" className="text-sm text-gray-700">
                  Apply AI suggestions
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 pt-4">
              <Button
                onClick={handleGeneratePreview}
                disabled={loading || !findText || !selectedContentType || selectedEntries.length === 0}
                className="flex items-center space-x-2"
              >
                <Eye className="w-4 h-4" />
                <span>Preview</span>
              </Button>
              
              <Button
                onClick={handleApplyChanges}
                disabled={loading || !preview}
                variant="default"
                className="flex items-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Apply</span>
              </Button>
            </div>
          </div>
        </Card>

        {/* AI Suggestions */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">AI Suggestions</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGetSuggestions}
              disabled={!findText}
              className="flex items-center space-x-2"
            >
              <Brain className="w-4 h-4" />
              <span>Refresh</span>
            </Button>
          </div>

          {aiSuggestions.length > 0 ? (
            <div className="space-y-3">
              {aiSuggestions.slice(0, 5).map((suggestion, index) => (
                <div
                  key={index}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => setReplaceText(suggestion.suggestedReplacement)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {suggestion.suggestedReplacement}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {suggestion.reason}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge className={getSuggestionColor(suggestion.source)}>
                          {suggestion.source}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {Math.round(suggestion.confidence * 100)}% confidence
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Target className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Brain className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>Enter text to find AI suggestions</p>
            </div>
          )}
        </Card>
      </div>

      {/* Preview Results */}
      {preview && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Preview Results</h3>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                {preview.totalChanges} changes
              </Badge>
              <Badge variant="outline">
                {preview.replacedCount} replacements
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            {/* Changes Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {preview.changes.map((change, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">{change.field}</p>
                  <p className="text-xs text-gray-500">{change.count} changes</p>
                </div>
              ))}
            </div>

            {/* Before/After Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Before</h4>
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(preview.before, null, 2)}
                  </pre>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">After</h4>
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(preview.after, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
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

      {/* Loading State */}
      {loading && (
        <Card className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Processing...</span>
          </div>
        </Card>
      )}
    </div>
  );
}
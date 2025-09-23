'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  RefreshCw, 
  Copy,
  Target,
  Eye,
  Tag,
  Mail,
  Globe,
  Hash,
  User,
  Package,
  Building,
  Sparkles
} from 'lucide-react';
import { enhancedApi, SpacyNERResponse, SpacyBatchResponse, SpacyEntity, SpacyHealthResponse, SpacyLabelsResponse } from '@/lib/enhanced-api';

interface NEREntity {
  text: string;
  label: string;
  start: number;
  end: number;
  confidence: number;
  canonical_type?: string;
  source?: string;
}

interface NERResult {
  entities: NEREntity[];
  model_used: string;
  processing_time_ms: number;
  text_length: number;
  entity_count: number;
}

interface BatchNERResult {
  results: NERResult[];
  total_processing_time_ms: number;
  batch_size: number;
  fallback?: boolean;
}

interface NERInterfaceProps {
  initialText?: string;
  onEntitySelect?: (entity: NEREntity) => void;
}

export function NERInterface({ initialText = '', onEntitySelect }: NERInterfaceProps) {
  const [inputText, setInputText] = useState(initialText);
  const [batchTexts, setBatchTexts] = useState<string[]>(['', '']);
  const [activeMode, setActiveMode] = useState<'single' | 'batch'>('single');
  const [nerResult, setNerResult] = useState<NERResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchNERResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Spacy-service specific state
  const [selectedModel, setSelectedModel] = useState<string>('en_core_web_trf');
  const [minConfidence, setMinConfidence] = useState<number>(0.7);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [serviceStatus, setServiceStatus] = useState<SpacyHealthResponse | null>(null);
  const [isSpacyAvailable, setIsSpacyAvailable] = useState<boolean>(false);

  // Check spacy-service status on component mount
  useEffect(() => {
    const checkServiceStatus = async () => {
      try {
        const health = await enhancedApi.getSpacyHealth();
        setServiceStatus(health);
        setIsSpacyAvailable(health.status === 'healthy');
        
        if (health.status === 'healthy' && health.available_models) {
          setAvailableModels(health.available_models);
          // Set default model to the first available transformer model, or first available
          const transformerModel = health.available_models.find((m: string) => m.includes('trf'));
          if (transformerModel) {
            setSelectedModel(transformerModel);
          } else if (health.available_models.length > 0) {
            setSelectedModel(health.available_models[0]);
          }
        }
      } catch (error) {
        console.warn('Failed to check spacy-service status:', error);
        setIsSpacyAvailable(false);
      }
    };

    checkServiceStatus();
  }, []);

  const getEntityIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case 'email': return Mail;
      case 'url': return Globe;
      case 'version': return Hash;
      case 'person': return User;
      case 'product': return Package;
      case 'brand': return Building;
      case 'misc': return Tag;
      default: return Target;
    }
  };

  const getEntityColor = (label: string) => {
    switch (label.toLowerCase()) {
      case 'email': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'url': return 'bg-green-100 text-green-800 border-green-200';
      case 'version': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'person': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'product': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'brand': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'misc': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const analyzeText = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to analyze');
      return;
    }

    setLoading(true);
    setError(null);
    setNerResult(null);

    try {
      // Analyzing text with spaCy NER
      
      const response = await enhancedApi.getNEREntities(inputText, selectedModel, minConfidence);
      // spaCy NER Response received

      setNerResult(response);
      // Entities found
    } catch (err) {
      console.error('❌ Error getting NER entities:', err);
      setError(err instanceof Error ? err.message : 'Failed to get NER entities');
    } finally {
      setLoading(false);
    }
  };

  const analyzeBatch = async () => {
    const validTexts = batchTexts.filter(text => text.trim());
    if (validTexts.length === 0) {
      setError('Please enter at least one text to analyze');
      return;
    }

    setLoading(true);
    setError(null);
    setBatchResult(null);

    try {
      // Analyzing batch with spaCy NER
      
      const response = await enhancedApi.getBatchNEREntities(validTexts, selectedModel, minConfidence);
      // spaCy Batch NER Response received

      setBatchResult(response);
      // Batch processing completed
    } catch (err) {
      console.error('❌ Error getting batch NER entities:', err);
      setError(err instanceof Error ? err.message : 'Failed to get batch NER entities');
    } finally {
      setLoading(false);
    }
  };

  const handleEntityClick = (entity: NEREntity) => {
    // Entity selected
    onEntitySelect?.(entity);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

  const renderEntity = (entity: NEREntity, index: number) => {
    const EntityIcon = getEntityIcon(entity.label);
    
    return (
      <div
        key={index}
        className="p-3 border rounded-lg hover:shadow-sm cursor-pointer transition-all"
        onClick={() => handleEntityClick(entity)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <EntityIcon className="w-4 h-4" />
              <Badge className={getEntityColor(entity.label)}>
                {entity.label}
              </Badge>
              {entity.canonical_type && entity.canonical_type !== entity.label && (
                <Badge variant="outline" className="text-xs">
                  {entity.canonical_type}
                </Badge>
              )}
              <span className={`text-sm font-medium ${getConfidenceColor(entity.confidence)}`}>
                {Math.round(entity.confidence * 100)}%
              </span>
            </div>
            <div className="bg-gray-50 p-2 rounded font-mono text-sm">
              {entity.text}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Position: {entity.start}-{entity.end} • Source: {entity.source || 'ner'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(entity.text);
            }}
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Named Entity Recognition</h1>
          <p className="text-gray-600">Extract entities from text using AI-powered NER</p>
        </div>
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="text-sm text-gray-500">
            {isSpacyAvailable ? 'Spacy Service Active' : 'Server NER Active'}
          </span>
        </div>
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

      {/* Model and Settings */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Model:
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={!isSpacyAvailable}
            >
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model} {model.includes('trf') ? '(Transformer)' : '(Statistical)'}
                </option>
              ))}
              {availableModels.length === 0 && (
                <option value="server_fallback">Server Fallback</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Confidence: {Math.round(minConfidence * 100)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
        {serviceStatus && (
          <div className="mt-3 text-xs text-gray-500">
            Service: {isSpacyAvailable ? 'Spacy Service' : 'Server Fallback'} • 
            Available Models: {availableModels.length} • 
            Status: {serviceStatus?.status || 'Unknown'}
          </div>
        )}
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
                placeholder="Enter text to extract entities from..."
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <Button 
              onClick={analyzeText}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              <span>{loading ? 'Analyzing...' : 'Extract Entities'}</span>
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
                  <textarea
                    value={text}
                    onChange={(e) => updateBatchText(index, e.target.value)}
                    placeholder={`Text ${index + 1}...`}
                    className="flex-1 h-20 p-2 border border-gray-300 rounded-lg resize-none"
                  />
                  {batchTexts.length > 2 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => removeBatchText(index)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            <Button 
              onClick={analyzeBatch}
              disabled={loading || batchTexts.every(text => !text.trim())}
              className="flex items-center space-x-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              <span>{loading ? 'Processing...' : 'Process Batch'}</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </Card>
      )}

      {/* Single Mode Results */}
      {activeMode === 'single' && nerResult && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Extracted Entities ({nerResult.entity_count})
              </h2>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  {nerResult.model_used}
                </Badge>
                <span className="text-sm text-gray-500">
                  {nerResult.processing_time_ms}ms
                </span>
              </div>
            </div>
            
            <div className="space-y-3">
              {nerResult.entities.map((entity, index) => renderEntity(entity, index))}
            </div>
          </div>
        </Card>
      )}

      {/* Batch Mode Results */}
      {activeMode === 'batch' && batchResult && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Batch Results ({batchResult.batch_size} texts processed)
            </h2>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                spaCy NER Mode
              </Badge>
              <span className="text-sm text-gray-500">
                {batchResult.total_processing_time_ms}ms
              </span>
            </div>
          </div>
          
          {batchResult.results.map((result, resultIndex) => (
            <Card key={resultIndex} className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Text {resultIndex + 1}</h3>
                  <Badge variant="outline">
                    {result.entity_count} entities
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {result.entities.map((entity, entityIndex) => 
                    renderEntity(entity, entityIndex)
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !nerResult && !batchResult && (
        <Card className="p-12">
          <div className="text-center">
            <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready for Entity Recognition</h3>
            <p className="text-gray-600 mb-4">
              Enter text above to extract entities like names, emails, URLs, versions, and more
            </p>
            <Badge variant="outline" className="flex items-center space-x-1 mx-auto w-fit">
              <Brain className="w-3 h-3" />
              <span>Powered by NER</span>
            </Badge>
          </div>
        </Card>
      )}
    </div>
  );
}
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Zap, 
  CheckCircle,
  AlertTriangle,
  FileText,
  Package,
  Tag,
  Database,
  RefreshCw,
  Eye
} from 'lucide-react';
import { enhancedApi, BulkApplyRequest, BulkPreviewRequest, JobStatusResponse } from '@/lib/enhanced-api';

// Type definitions
interface ContentStackEntry {
  uid: string;
  title?: string;
  name?: string;
}

interface ContentTypeWithEntries {
  uid: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  entries: ContentStackEntry[];
  count: number;
}

interface BulkPreviewResponse {
  totalEntries: number;
  totalChanges: number;
  processedCount: number;
}

interface BulkOperationsInterfaceProps {
  selectedContentType?: string;
  onJobCreated?: (jobId: string) => void;
}

export function BulkOperationsInterface({ selectedContentType: propSelectedContentType, onJobCreated }: BulkOperationsInterfaceProps) {
  const [contentTypes, setContentTypes] = useState<ContentTypeWithEntries[]>([]);
  const [selectedContentType, setSelectedContentType] = useState<string | undefined>(propSelectedContentType);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [options, setOptions] = useState({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    dryRun: true
  });
  const [preview, setPreview] = useState<BulkPreviewResponse | null>(null);
  const [jobs, setJobs] = useState<JobStatusResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contentTypesList = [
    { uid: 'article', name: 'Articles', icon: FileText, color: 'text-blue-600' },
    { uid: 'product', name: 'Products', icon: Package, color: 'text-green-600' },
    { uid: 'brands', name: 'Brands', icon: Tag, color: 'text-purple-600' },
  ];

  useEffect(() => {
    loadContentTypes();
    loadJobs();
  }, []);

  const loadContentTypes = useCallback(async () => {
    try {
      const contentTypeData = [];
      for (const ct of contentTypesList) {
        try {
          console.log(`Loading entries for ${ct.uid}...`);
          const response = await enhancedApi.listEntries(ct.uid);
          console.log(`Response for ${ct.uid}:`, response);
          contentTypeData.push({
            ...ct,
            entries: response.data?.entries || [],
            count: response.data?.count || 0
          });
        } catch (error) {
          console.warn(`Failed to load ${ct.uid}:`, error);
          contentTypeData.push({
            ...ct,
            entries: [],
            count: 0
          });
        }
      }
      console.log('Content types loaded:', contentTypeData);
      setContentTypes(contentTypeData);
    } catch (error) {
      console.error('Failed to load content types:', error);
      setError('Failed to load content types');
    }
  }, []);

  const loadJobs = async () => {
    // Mock job data - in real implementation, you'd fetch from an API
    setJobs([]);
  };

  const handleContentTypeSelect = (contentType: string) => {
    console.log('Selecting content type:', contentType);
    setSelectedContentType(contentType);
    const ct = contentTypes.find(c => c.uid === contentType);
    console.log('Found content type:', ct);
    if (ct) {
      const entryUids = ct.entries.map((entry: ContentStackEntry) => entry.uid);
      console.log('Setting selected entries:', entryUids);
      setSelectedEntries(entryUids);
      
      // If no entries are loaded, create a mock entry for testing
      if (entryUids.length === 0) {
        console.log('No entries found, creating mock entry for testing');
        const mockEntryUid = `${contentType}-mock-entry`;
        setSelectedEntries([mockEntryUid]);
      }
    } else {
      console.warn('Content type not found:', contentType);
    }
  };

  const handleEntryToggle = (entryUid: string) => {
    setSelectedEntries(prev => 
      prev.includes(entryUid) 
        ? prev.filter(id => id !== entryUid)
        : [...prev, entryUid]
    );
  };

  const handleSelectAll = () => {
    const currentContentType = contentTypes.find(ct => ct.uid === selectedContentType);
    if (currentContentType) {
      setSelectedEntries(currentContentType.entries.map((entry: ContentStackEntry) => entry.uid));
    }
  };

  const handleDeselectAll = () => {
    setSelectedEntries([]);
  };

  const handleGeneratePreview = async () => {
    if (!findText) {
      setError('Please enter text to find');
      return;
    }
    if (!selectedContentType) {
      setError('Please select a content type');
      return;
    }
    if (selectedEntries.length === 0) {
      setError('Please select at least one entry');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: BulkPreviewRequest = {
        contentTypeUid: selectedContentType,
        entryUids: selectedEntries,
        rule: {
          find: findText,
          replace: replaceText,
          mode: options.useRegex ? 'regex' : 'literal',
          caseSensitive: options.caseSensitive,
          wholeWord: options.wholeWord
        }
      };

      const response = await enhancedApi.bulkPreview(request);
      setPreview(response as BulkPreviewResponse);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyBulk = async () => {
    if (!findText) {
      setError('Please enter text to find');
      return;
    }
    if (!selectedContentType) {
      setError('Please select a content type');
      return;
    }
    if (selectedEntries.length === 0) {
      setError('Please select at least one entry');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: BulkApplyRequest = {
        contentTypeUid: selectedContentType,
        entryUids: selectedEntries,
        rule: {
          find: findText,
          replace: replaceText,
          mode: options.useRegex ? 'regex' : 'literal',
          caseSensitive: options.caseSensitive,
          wholeWord: options.wholeWord
        },
        dryRun: options.dryRun
      };

      const response = await enhancedApi.bulkApply(request);
      onJobCreated?.(response.jobId);
      
      // Start polling for job status
      pollJobStatus(response.jobId);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start bulk operation');
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    try {
      const status = await enhancedApi.pollJobStatus(jobId);
      setJobs(prev => [...prev.filter(j => j.job.id !== jobId), status]);
    } catch (error) {
      console.error('Failed to poll job status:', error);
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Operations</h1>
          <p className="text-gray-600">Perform operations on multiple entries simultaneously</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={loadContentTypes}
            className="flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Content Type Selection */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Type</h3>
          <div className="space-y-3">
            {contentTypes.map((ct) => {
              const Icon = ct.icon;
              const isSelected = selectedContentType === ct.uid;
              
              return (
                <button
                  key={ct.uid}
                  onClick={() => handleContentTypeSelect(ct.uid)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isSelected 
                      ? 'border-indigo-500 bg-indigo-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${ct.color} bg-opacity-20`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{ct.name}</p>
                      <p className="text-sm text-gray-500">{ct.count} entries</p>
                    </div>
                  </div>
                  {isSelected && <CheckCircle className="w-5 h-5 text-indigo-600" />}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Entry Selection */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Entries</h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeselectAll}
              >
                Deselect All
              </Button>
            </div>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {selectedContentType ? (
              contentTypes
                .find(ct => ct.uid === selectedContentType)
                ?.entries.map((entry: ContentStackEntry) => (
                  <div
                    key={entry.uid}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={selectedEntries.includes(entry.uid)}
                      onCheckedChange={() => handleEntryToggle(entry.uid)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {entry.title || entry.name || entry.uid}
                      </p>
                      <p className="text-xs text-gray-500">
                        UID: {entry.uid}
                      </p>
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Database className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>Select a content type to view entries</p>
              </div>
            )}
          </div>
          
          {selectedEntries.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900">
                {selectedEntries.length} entries selected
              </p>
            </div>
          )}
        </Card>

        {/* Operation Settings */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Operation</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Find Text
              </label>
              <Input
                placeholder="Enter text to find..."
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Replace With
              </label>
              <Input
                placeholder="Enter replacement text..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
              />
            </div>

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
                  id="dryRun"
                  checked={options.dryRun}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, dryRun: !!checked }))}
                />
                <label htmlFor="dryRun" className="text-sm text-gray-700">
                  Dry run (preview only)
                </label>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-4">
              <Button
                onClick={handleGeneratePreview}
                disabled={loading}
                className="flex items-center space-x-2"
              >
                <Eye className="w-4 h-4" />
                <span>Preview</span>
              </Button>
              
              <Button
                onClick={handleApplyBulk}
                disabled={loading}
                variant="default"
                className="flex items-center space-x-2"
              >
                <Zap className="w-4 h-4" />
                <span>Apply</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Preview Results */}
      {preview && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview Results</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">Total Entries</p>
                <p className="text-2xl font-bold text-gray-900">{preview.totalEntries}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">Total Changes</p>
                <p className="text-2xl font-bold text-gray-900">{preview.totalChanges}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">Processed</p>
                <p className="text-2xl font-bold text-gray-900">{preview.processedCount}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Job Status */}
      {jobs.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Status</h3>
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.job.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge className={getJobStatusColor(job.job.status)}>
                      {job.job.status}
                    </Badge>
                    <div>
                      <p className="font-medium text-gray-900">
                        Bulk operation on {(job.job.payload as unknown as BulkApplyRequest).contentTypeUid}
                      </p>
                      <p className="text-sm text-gray-500">
                        {(job.job.payload as unknown as BulkApplyRequest).entryUids?.length || 0} entries • 
                        Created {new Date(job.job.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {job.job.progress}% complete
                    </p>
                    {job.job.result && (
                      <p className="text-xs text-gray-500">
                        {job.job.result.processed} of {job.job.result.total} processed
                      </p>
                    )}
                  </div>
                </div>
                
                {job.job.status === 'processing' && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.job.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
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
    </div>
  );
}
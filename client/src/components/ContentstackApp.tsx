'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ContentstackHeader } from '@/components/layout/ContentstackHeader';
import { ContentstackSidebar } from '@/components/layout/ContentstackSidebar';
import { ContentstackDashboard } from '@/components/dashboard/ContentstackDashboard';
import { ContentTypesView } from '@/components/content-types/ContentTypesView';
import { SmartReplaceInterface } from '@/components/smart-replace/SmartReplaceInterface';
import { BulkOperationsInterface } from '@/components/bulk-operations/BulkOperationsInterface';
import { SuggestionsInterface } from '@/components/suggestions/SuggestionsInterface';
import { AITextAnalyzer } from '@/components/features/AITextAnalyzer';
import { ContentTypeEntry } from '@/lib/enhanced-api';
// import { useRealtimeSync } from '@/lib/realtime-sync';
import { contentstack } from '@/lib/contentstack';

interface ContentType {
  uid: string;
  title: string;
  count: number;
  lastUpdated: string;
  status: 'published' | 'draft' | 'archived';
}

interface DashboardStats {
  totalEntries: number;
  totalContentTypes: number;
  recentChanges: number;
  pendingSuggestions: number;
  lastSync: string;
}

export function ContentstackApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedContentType, setSelectedContentType] = useState<string | undefined>(undefined);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalEntries: 0,
    totalContentTypes: 0,
    recentChanges: 0,
    pendingSuggestions: 0,
    lastSync: new Date().toISOString()
  });
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time sync (disabled for now)
  // const { subscribeToContentUpdates, getConnectionStatus } = useRealtimeSync();

  // Load content types and stats with rate limiting
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    
    try {
      console.log('🔍 Loading data from Contentstack...');
      setConnectionStatus('connecting');
      
      // Get content types from Contentstack using the working approach
      const contentTypesResult = await contentstack.contentType().find();
      console.log('� Content types result:', contentTypesResult);
      
      if (!contentTypesResult.content_types || contentTypesResult.content_types.length === 0) {
        throw new Error('No content types found');
      }

      setConnectionStatus('connected');
      const contentTypeData: ContentType[] = [];
      let totalEntries = 0;
      const recentChanges = 0;

      // Process each content type
      for (const ctRaw of contentTypesResult.content_types) {
        // Assert the type of ctRaw
        const ct = ctRaw as { uid: string; title?: string };
        console.log(`📋 Processing content type: ${ct.uid}`);
        
        try {
          // Get entries for this content type using your server API
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/replace/${ct.uid}?environment=${process.env.NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT}&branch=${process.env.NEXT_PUBLIC_CONTENTSTACK_BRANCH}`);
          const apiResult = await response.json();
          
          if (apiResult.ok && apiResult.data) {
            const entryCount = apiResult.data.count || 0;
            totalEntries += entryCount;
            
            contentTypeData.push({
              uid: ct.uid,
              title: ct.title || ct.uid,
              count: entryCount,
              lastUpdated: new Date().toISOString(),
              status: 'published'
            });
            
            console.log(`✅ ${ct.uid}: ${entryCount} entries`);
          } else {
            console.warn(`⚠️ API error for ${ct.uid}:`, apiResult.error);
            contentTypeData.push({
              uid: ct.uid,
              title: ct.title || ct.uid,
              count: 0,
              lastUpdated: new Date().toISOString(),
              status: 'draft'
            });
          }
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.warn(`⚠️ Failed to load entries for ${ct.uid}:`, err);
          contentTypeData.push({
            uid: ct.uid,
            title: ct.title || ct.uid,
            count: 0,
            lastUpdated: new Date().toISOString(),
            status: 'draft'
          });
        }
      }

      setContentTypes(contentTypeData);
      setStats({
        totalEntries,
        totalContentTypes: contentTypeData.length,
        recentChanges,
        pendingSuggestions: 0,
        lastSync: new Date().toISOString()
      });

      console.log('🎉 Data loading completed!');
      console.log(`📊 Summary: ${contentTypeData.length} content types, ${totalEntries} total entries`);
      
    } catch (err) {
      console.error('❌ Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setConnectionStatus('disconnected');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Auto-refresh with rate limiting
  useEffect(() => {
    loadData();
    
    // Disable real-time sync temporarily to avoid rate limiting
    // const unsubscribe = subscribeToContentUpdates((data) => {
    //   console.log('Real-time update received:', data);
    //   loadData();
    // });
    
    // Manual refresh every 10 minutes to avoid rate limiting
    const interval = setInterval(() => {
      loadData();
    }, 600000); // 10 minutes

    return () => {
      clearInterval(interval);
      // unsubscribe();
    };
  }, [loadData]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'content-types') {
      setSelectedContentType(undefined);
      setSelectedEntries([]);
    }
  };

  const handleContentTypeSelect = (contentType: string) => {
    setSelectedContentType(contentType);
    setSelectedEntries([]);
  };

  const handleEntrySelect = (contentType: string, entry: ContentTypeEntry) => {
    setSelectedContentType(contentType);
    setSelectedEntries(prev => {
      const isSelected = prev.includes(entry.uid);
      if (isSelected) {
        return prev.filter(id => id !== entry.uid);
      } else {
        return [...prev, entry.uid];
      }
    });
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'find':
        setActiveTab('find');
        break;
      case 'replace':
        setActiveTab('replace');
        break;
      case 'bulk':
        setActiveTab('bulk');
        break;
      case 'suggestions':
        setActiveTab('suggestions');
        break;
      case 'sync':
        loadData();
        break;
    }
  };

  const handlePreviewGenerated = (preview: unknown) => {
    console.log('Preview generated:', preview);
  };

  const handleChangesApplied = (result: unknown) => {
    console.log('Changes applied:', result);
    // Refresh data after changes
    loadData();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <ContentstackDashboard
            contentTypes={contentTypes}
            stats={stats}
            onRefresh={loadData}
            onContentTypeClick={handleContentTypeSelect}
            onQuickAction={handleQuickAction}
            isRefreshing={isRefreshing}
          />
        );
      
      case 'content-types':
        return (
          <ContentTypesView
            contentTypes={contentTypes}
            onEntrySelect={handleEntrySelect}
            onRefresh={loadData}
            isRefreshing={isRefreshing}
          />
        );
      
      case 'find':
      case 'replace':
        return (
          <SmartReplaceInterface
            selectedContentType={selectedContentType || undefined}
            selectedEntries={selectedEntries}
            onPreviewGenerated={handlePreviewGenerated}
            onChangesApplied={handleChangesApplied}
          />
        );
      
      case 'bulk':
        return (
          <BulkOperationsInterface
            selectedContentType={selectedContentType}
            onJobCreated={(jobId) => {
              console.log('Bulk job created:', jobId);
              // Refresh data after job creation
              loadData();
            }}
          />
        );
      
      case 'suggestions':
        return (
          <SuggestionsInterface
            onSuggestionApplied={(suggestion) => {
              console.log('Suggestion applied:', suggestion);
              // Could trigger a refresh or other actions
            }}
          />
        );
      
      case 'history':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">History</h1>
              <p className="text-gray-600">View past operations and changes</p>
            </div>
            <div className="text-center py-12">
              <p className="text-gray-500">History interface coming soon...</p>
            </div>
          </div>
        );
      
      case 'analytics':
        return (
          <AITextAnalyzer
            contentTypeUid={selectedContentType}
            onSuggestionApply={(suggestion) => {
              console.log('Suggestion applied:', suggestion);
            }}
          />
        );
      
      case 'settings':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-600">Configure your Contentstack integration</p>
            </div>
            <div className="text-center py-12">
              <p className="text-gray-500">Settings interface coming soon...</p>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Page Not Found</h1>
              <p className="text-gray-600">The requested page could not be found</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <ContentstackHeader
        onRefresh={loadData}
        isRefreshing={isRefreshing}
        connectionStatus={connectionStatus}
        lastSync={stats.lastSync}
      />

      <div className="flex">
        {/* Sidebar */}
        <ContentstackSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          contentTypes={contentTypes}
          onContentTypeSelect={handleContentTypeSelect}
          selectedContentType={selectedContentType}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <p className="text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Selected Content Info */}
            {selectedContentType && selectedEntries.length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      {contentTypes.find(ct => ct.uid === selectedContentType)?.title} • {selectedEntries.length} entries selected
                    </p>
                    <p className="text-xs text-blue-700">
                      Ready for find & replace operations
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedContentType(undefined);
                      setSelectedEntries([]);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* Page Content */}
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
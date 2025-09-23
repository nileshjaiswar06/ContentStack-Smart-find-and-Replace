'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ContentstackHeader } from '@/components/layout/ContentstackHeader';
import { ContentstackSidebar } from '@/components/layout/ContentstackSidebar';
import { ContentstackDashboard } from '@/components/dashboard/ContentstackDashboard';
import { ContentTypesView } from '@/components/content-types/ContentTypesView';
import { SmartReplaceInterface } from '@/components/smart-replace/SmartReplaceInterface';
import { BulkOperationsInterface } from '@/components/bulk-operations/BulkOperationsInterface';
import { enhancedApi, ContentTypeEntry } from '@/lib/enhanced-api';
import { useRealtimeSync } from '@/lib/realtime-sync';
import { contentstackService } from '@/lib/contentstack';
import { debugContentstackConnection } from '@/lib/debug-contentstack';

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

  // Real-time sync
  const { subscribeToContentUpdates, getConnectionStatus } = useRealtimeSync();

  // Load content types and stats with rate limiting
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    
    try {
      // Check connection
      const isHealthy = await enhancedApi.healthCheck();
      setConnectionStatus(isHealthy ? 'connected' : 'disconnected');
      
      if (!isHealthy) {
        throw new Error('Server connection failed');
      }

      // Load content types directly from Contentstack CMS
      const contentTypeData: ContentType[] = [];

      // Debug Contentstack connection first
      console.log('🔍 Testing Contentstack connection...');
      const debugResult = await debugContentstackConnection();
      
      if (!debugResult) {
        throw new Error('Contentstack connection failed. Please check your API credentials.');
      }

      // Get content types from Contentstack SDK
      try {
        const contentTypes = await contentstackService.getContentTypes();
        let totalEntries = 0;
        let recentChanges = 0;

        console.log('Found content types:', contentTypes);

        for (let i = 0; i < contentTypes.length; i++) {
          const contentTypeUid = contentTypes[i];
          
          // Add delay between requests to avoid rate limiting
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          try {
            // Get entries from Contentstack CMS
            const entries = await contentstackService.getEntries(contentTypeUid);
            const entryCount = entries.entries?.length || 0;
            totalEntries += entryCount;
            
            // Get the latest entry for lastUpdated
            const latestEntry = entries.entries?.[0];
            const lastUpdated = latestEntry?.updated_at || latestEntry?.created_at || new Date().toISOString();
            
            contentTypeData.push({
              uid: contentTypeUid,
              title: contentTypeUid.charAt(0).toUpperCase() + contentTypeUid.slice(1) + 's',
              count: entryCount,
              lastUpdated: lastUpdated,
              status: 'published'
            });

            // Count recent changes (last 24 hours)
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recent = entries.entries?.filter((entry: any) => 
              new Date(entry.updated_at || entry.created_at || '') > oneDayAgo
            ).length || 0;
            recentChanges += recent;
          } catch (err) {
            console.warn(`Failed to load ${contentTypeUid}:`, err);
            contentTypeData.push({
              uid: contentTypeUid,
              title: contentTypeUid.charAt(0).toUpperCase() + contentTypeUid.slice(1) + 's',
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
          pendingSuggestions: 0, // Will be updated from real data
          lastSync: new Date().toISOString()
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setConnectionStatus('disconnected');
      }
    } catch (err) {
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
      case 'sync':
        loadData();
        break;
    }
  };

  const handlePreviewGenerated = (preview: any) => {
    console.log('Preview generated:', preview);
  };

  const handleChangesApplied = (result: any) => {
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
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
              <p className="text-gray-600">View usage statistics and performance metrics</p>
            </div>
            <div className="text-center py-12">
              <p className="text-gray-500">Analytics interface coming soon...</p>
            </div>
          </div>
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
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { FindContent } from '@/components/features/FindContent';
import { ReplaceSetup } from '@/components/features/ReplaceSetup';
import { PreviewVerify } from '@/components/features/PreviewVerify';
import { History } from '@/components/features/History';
import { SearchResults } from '@/components/features/SearchResults';
import { ErrorDisplay } from '@/components/common/ErrorDisplay';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useSmartFindReplace } from '@/hooks/useSmartFindReplace';
import { Tab } from '@/types';

export default function SmartFindReplaceApp() {
  const {
    activeTab,
    searchQuery,
    replaceQuery,
    selectedEntries,
    isLoading,
    suggestions,
    replacementPlan,
    filters,
    history,
    error,
    isApiConnected,
    setActiveTab,
    setSearchQuery,
    setReplaceQuery,
    setFilters,
    handleSearch,
    handleGeneratePreview,
    handleApplyChanges,
    toggleApproval,
    handleEntrySelect,
    handleEntryDeselect,
    clearError,
    retryConnection,
  } = useSmartFindReplace();

  const tabs: Tab[] = [
    { id: 'find', label: 'Find Content'},
    { id: 'replace', label: 'Replace Setup' },
    { id: 'preview', label: 'Preview & Verify'},
    { id: 'history', label: 'History'}
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="contentstack-header">
          <div className="max-w-7xl mx-auto px-4">
            <h1 className="text-3xl font-semibold text-gray-900 py-4">Smart Find & Replace</h1>
            <div className="flex items-center text-sm text-gray-500 pb-4">
              <span>Home</span>
              <span className="mx-2 text-gray-300">/</span>
              <span>Smart Find & Replace</span>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* API Connection Status */}
          {!isApiConnected && (
            <Card className="mb-6 p-4 border-yellow-200 bg-yellow-50">
              <div className="flex items-center justify-between">
                <span className="text-yellow-800">Unable to connect to the server. Some features may not work properly.</span>
                <Button
                  variant="outline"
                  onClick={retryConnection}
                  className="ml-2"
                >
                  Retry Connection
                </Button>
              </div>
            </Card>
          )}
          
          {/* Error Display */}
          <ErrorDisplay 
            error={error} 
            onRetry={retryConnection}
            onDismiss={clearError}
            className="mb-6"
          />
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-white shadow-sm">
              {tabs.map(tab => (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="flex items-center gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent value="find" className="mt-6 space-y-6">
              <FindContent
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                filters={filters}
                onFiltersChange={setFilters}
                onSearch={handleSearch}
                isLoading={isLoading}
              />
              
              {suggestions.length > 0 && (
                <SearchResults
                  results={suggestions}
                  selectedEntries={selectedEntries}
                  onEntrySelect={handleEntrySelect}
                  onEntryDeselect={handleEntryDeselect}
                />
              )}
            </TabsContent>

            <TabsContent value="replace" className="mt-6">
              <ReplaceSetup
                replaceQuery={replaceQuery}
                onReplaceQueryChange={setReplaceQuery}
                onGeneratePreview={handleGeneratePreview}
                isLoading={isLoading}
                canGenerate={!!replaceQuery && selectedEntries.length > 0}
              />
            </TabsContent>

            <TabsContent value="preview" className="mt-6">
              <PreviewVerify
                replacementPlan={replacementPlan}
                onToggleApproval={toggleApproval}
                onApplyChanges={handleApplyChanges}
                isLoading={isLoading}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <History history={history} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ErrorBoundary>
  );
}
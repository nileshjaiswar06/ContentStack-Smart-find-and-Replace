import { useState, useCallback, useEffect } from 'react';
import { SearchResult, ReplacementPlan, SearchFilters, HistoryItem } from '../types';
import { api, handleApiError } from '../lib/api';

export const useSmartFindReplace = () => {
  const [activeTab, setActiveTab] = useState('find');
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [replacementPlan, setReplacementPlan] = useState<ReplacementPlan[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    contentType: 'all',
    locale: 'all',
    status: 'all',
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [searchPagination, setSearchPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    hasMore: false
  });

  // Check API connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const isConnected = await api.healthCheck();
        setIsApiConnected(isConnected);
        if (isConnected) {
          // Load initial history
          try {
            const historyData = await api.getHistory();
            setHistory(historyData);
          } catch (error) {
            console.warn('Failed to load history:', error);
          }
        }
      } catch (error) {
        console.error('API connection failed:', error);
        setIsApiConnected(false);
      }
    };
    
    checkConnection();
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.searchContent(
        searchQuery,
        filters,
        searchPagination.page,
        searchPagination.limit
      );
      
      setSuggestions(response.entries);
      setSearchPagination(prev => ({
        ...prev,
        total: response.total,
        hasMore: response.hasMore ?? false
      }));
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filters, searchPagination.page, searchPagination.limit]);

  const handleGeneratePreview = useCallback(async () => {
    if (!searchQuery || !replaceQuery || selectedEntries.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const entryIds = selectedEntries.map(entry => entry.id);
      const response = await api.generatePreview(
        searchQuery,
        replaceQuery,
        entryIds,
        {
          caseSensitive: false, // This should come from UI
          replaceMode: 'all'
        }
      );
      
      setReplacementPlan(response.replacementPlan);
      setActiveTab('preview');
      
      // Add to history
      setHistory(prev => [{
        id: Date.now().toString(),
        action: `Generated preview for ${response.totalMatches} matches`,
        timestamp: 'Just now',
        status: 'info',
        changesCount: response.estimatedChanges
      }, ...prev]);
      
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      console.error('Preview generation failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, replaceQuery, selectedEntries]);

  const handleApplyChanges = useCallback(async () => {
    const approvedChanges = replacementPlan.filter(change => change.approved);
    
    if (approvedChanges.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.applyReplacements(approvedChanges);
      
      // Add to history
      setHistory(prev => [{
        id: Date.now().toString(),
        action: `Applied ${response.changesApplied} changes`,
        timestamp: 'Just now',
        status: 'success',
        changesCount: response.changesApplied,
        details: response.message
      }, ...prev]);
      
      // Clear state
      setReplacementPlan([]);
      setSelectedEntries([]);
      setSearchQuery('');
      setReplaceQuery('');
      
      // Show success message
      alert(`Successfully applied ${response.changesApplied} changes!`);
      
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      console.error('Apply changes failed:', error);
      
      // Add error to history
      setHistory(prev => [{
        id: Date.now().toString(),
        action: `Failed to apply changes: ${errorMessage}`,
        timestamp: 'Just now',
        status: 'error'
      }, ...prev]);
    } finally {
      setIsLoading(false);
    }
  }, [replacementPlan]);

  const toggleApproval = useCallback((index: number) => {
    setReplacementPlan(prev => {
      const newPlan = [...prev];
      newPlan[index].approved = !newPlan[index].approved;
      return newPlan;
    });
  }, []);

  const handleEntrySelect = useCallback((entry: SearchResult) => {
    setSelectedEntries(prev => [...prev, entry]);
  }, []);

  const handleEntryDeselect = useCallback((entryId: string) => {
    setSelectedEntries(prev => prev.filter(entry => entry.id !== entryId));
  }, []);

  return {
    // State
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
    searchPagination,
    
    // Actions
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
    
    // Utility functions
    clearError: () => setError(null),
    retryConnection: async () => {
      try {
        const isConnected = await api.healthCheck();
        setIsApiConnected(isConnected);
        return isConnected;
      } catch {
        setIsApiConnected(false);
        return false;
      }
    }
  };
};
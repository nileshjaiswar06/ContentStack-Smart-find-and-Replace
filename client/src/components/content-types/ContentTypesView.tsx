'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Database, 
  FileText, 
  Package, 
  Tag, 
  Search, 
  Filter, 
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Plus,
  MoreVertical,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { enhancedApi, ContentTypeEntry } from '@/lib/enhanced-api';
import { contentstackService } from '@/lib/contentstack';

interface ContentType {
  uid: string;
  title: string;
  count: number;
  lastUpdated: string;
  status: 'published' | 'draft' | 'archived';
  entries: ContentTypeEntry[];
}

interface ContentTypesViewProps {
  onEntrySelect: (contentType: string, entry: ContentTypeEntry) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function ContentTypesView({ onEntrySelect, onRefresh, isRefreshing = false }: ContentTypesViewProps) {
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [selectedContentType, setSelectedContentType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic content types will be fetched from CMS

  useEffect(() => {
    loadContentTypes();
  }, []);

  const loadContentTypes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const contentTypeData: ContentType[] = [];
      
      // Get content types from Contentstack CMS
      const contentTypes = await contentstackService.getContentTypes();
      
      for (let i = 0; i < contentTypes.length; i++) {
        const contentTypeUid = contentTypes[i];
        
        // Add delay to avoid rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        try {
          // Get entries from Contentstack CMS
          const entries = await contentstackService.getEntries(contentTypeUid);
          const entryList = entries.entries || [];
          
          contentTypeData.push({
            uid: contentTypeUid,
            title: contentTypeUid.charAt(0).toUpperCase() + contentTypeUid.slice(1) + 's',
            count: entryList.length,
            lastUpdated: entryList[0]?.updated_at || new Date().toISOString(),
            status: 'published',
            entries: entryList
          });
        } catch (err) {
          console.warn(`Failed to load ${contentTypeUid}:`, err);
          contentTypeData.push({
            uid: contentTypeUid,
            title: contentTypeUid.charAt(0).toUpperCase() + contentTypeUid.slice(1) + 's',
            count: 0,
            lastUpdated: new Date().toISOString(),
            status: 'draft',
            entries: []
          });
        }
      }
      
      setContentTypes(contentTypeData);
    } catch (err) {
      setError('Failed to load content types');
      console.error('Error loading content types:', err);
    } finally {
      setLoading(false);
    }
  };

  const getContentTypeIcon = (uid: string) => {
    // Dynamic icon selection based on content type
    if (uid.includes('article') || uid.includes('blog')) return FileText;
    if (uid.includes('product')) return Package;
    if (uid.includes('brand')) return Tag;
    return Database;
  };

  const getContentTypeColor = (uid: string) => {
    // Dynamic color selection based on content type
    if (uid.includes('article') || uid.includes('blog')) return 'text-blue-600 bg-blue-50';
    if (uid.includes('product')) return 'text-green-600 bg-green-50';
    if (uid.includes('brand')) return 'text-purple-600 bg-purple-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredContentTypes = contentTypes.filter(ct => {
    const matchesSearch = ct.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ct.uid.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || ct.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleContentTypeClick = (contentType: ContentType) => {
    setSelectedContentType(selectedContentType === contentType.uid ? null : contentType.uid);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading content types...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Content Types</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadContentTypes}>
              Try Again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Types</h1>
          <p className="text-gray-600">Manage your content types and entries</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={onRefresh}
            disabled={isRefreshing}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Add Content Type</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search content types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Content Types List */}
      <div className="space-y-4">
        {filteredContentTypes.map((contentType) => {
          const Icon = getContentTypeIcon(contentType.uid);
          const isExpanded = selectedContentType === contentType.uid;
          
          return (
            <Card key={contentType.uid} className="overflow-hidden">
              {/* Content Type Header */}
              <div
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleContentTypeClick(contentType)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-lg ${getContentTypeColor(contentType.uid)}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{contentType.title}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>{contentType.count} entries</span>
                        <span>•</span>
                        <span>Updated {new Date(contentType.lastUpdated).toLocaleDateString()}</span>
                        <span>•</span>
                        <Badge className={getStatusColor(contentType.status)}>
                          {contentType.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Entries List (Expanded) */}
              {isExpanded && (
                <div className="border-t border-gray-200 bg-gray-50">
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Entries ({contentType.entries.length})</h4>
                    <div className="space-y-2">
                      {contentType.entries.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Database className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p>No entries found</p>
                        </div>
                      ) : (
                        contentType.entries.map((entry) => (
                          <div
                            key={entry.uid}
                            className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm cursor-pointer transition-shadow"
                            onClick={() => onEntrySelect(contentType.uid, entry)}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {entry.title || entry.name || entry.uid}
                                </p>
                                <p className="text-sm text-gray-500">
                                  UID: {entry.uid} • Updated {new Date(entry.updated_at || entry.created_at || '').toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs">
                                v{entry._version || 1}
                              </Badge>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {filteredContentTypes.length === 0 && (
        <Card className="p-12">
          <div className="text-center">
            <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Content Types Found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery ? 'Try adjusting your search criteria' : 'No content types available'}
            </p>
            <Button onClick={loadContentTypes}>
              Refresh
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
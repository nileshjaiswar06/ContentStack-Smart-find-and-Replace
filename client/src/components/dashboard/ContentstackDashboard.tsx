'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  FileText, 
  Package, 
  Tag, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw,
  Zap,
  BarChart3,
  Lightbulb
} from 'lucide-react';
import { BrandkitStatus } from '@/lib/enhanced-api';

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

interface ContentstackDashboardProps {
  contentTypes: ContentType[];
  stats: DashboardStats;
  brandkitStatus?: BrandkitStatus | null;
  onRefresh: () => void;
  onContentTypeClick: (contentType: string) => void;
  onQuickAction: (action: string) => void;
  isRefreshing?: boolean;
}

export function ContentstackDashboard({
  contentTypes,
  stats,
  brandkitStatus,
  onRefresh,
  onContentTypeClick,
  onQuickAction,
  isRefreshing = false
}: ContentstackDashboardProps) {
  const getContentTypeIcon = (uid: string) => {
    switch (uid) {
      case 'article': return FileText;
      case 'product': return Package;
      case 'brands': return Tag;
      default: return Database;
    }
  };

  const getContentTypeColor = (uid: string) => {
    switch (uid) {
      case 'article': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'product': return 'text-green-600 bg-green-50 border-green-200';
      case 'brands': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const quickActions = [
    { id: 'find', label: 'Find Content', icon: FileText, color: 'bg-blue-600' },
    { id: 'replace', label: 'Smart Replace', icon: Zap, color: 'bg-green-600' },
    { id: 'bulk', label: 'Bulk Operations', icon: BarChart3, color: 'bg-purple-600' },
    { id: 'suggestions', label: 'AI Suggestions', icon: Lightbulb, color: 'bg-yellow-600' },
    { id: 'sync', label: 'Sync All', icon: RefreshCw, color: 'bg-indigo-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Manage your content with smart find and replace tools</p>
        </div>
        <Button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Entries</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalEntries}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>+12% from last week</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Content Types</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalContentTypes}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <Clock className="w-4 h-4 mr-1" />
            <span>Last updated: {new Date(stats.lastSync).toLocaleTimeString()}</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Recent Changes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.recentChanges}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span>In the last 24 hours</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">AI Suggestions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingSuggestions}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-purple-600">
            <span>Pending review</span>
          </div>
        </Card>
      </div>

      {/* Brandkit Status */}
      {brandkitStatus && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Brandkit Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Tag className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Brands</p>
                <p className="text-xl font-bold text-gray-900">{brandkitStatus.brands.length}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Database className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Mappings</p>
                <p className="text-xl font-bold text-gray-900">{brandkitStatus.mappingCount}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Products</p>
                <p className="text-xl font-bold text-gray-900">{brandkitStatus.totalProducts}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Last updated: {new Date(brandkitStatus.lastUpdated).toLocaleString()}
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2 hover:bg-gray-50"
                onClick={() => onQuickAction(action.id)}
              >
                <div className={`p-2 rounded-lg ${action.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-medium">{action.label}</span>
              </Button>
            );
          })}
        </div>
      </Card>

      {/* Content Types */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Content Types</h3>
          <Badge variant="secondary">{contentTypes.length} types</Badge>
        </div>
        
        <div className="space-y-3">
          {contentTypes.map((contentType) => {
            const Icon = getContentTypeIcon(contentType.uid);
            return (
              <div
                key={contentType.uid}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onContentTypeClick(contentType.uid)}
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-lg ${getContentTypeColor(contentType.uid)}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{contentType.title}</h4>
                    <p className="text-sm text-gray-500">
                      {contentType.count} entries • Updated {new Date(contentType.lastUpdated).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(contentType.status)}>
                    {contentType.status}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">Bulk replace completed</p>
              <p className="text-xs text-gray-500">Updated 15 entries in Product content type</p>
            </div>
            <span className="text-xs text-gray-400 ml-auto">2m ago</span>
          </div>
          
          <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">AI suggestions available</p>
              <p className="text-xs text-gray-500">3 new suggestions for Article content type</p>
            </div>
            <span className="text-xs text-gray-400 ml-auto">5m ago</span>
          </div>
          
          <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">Content synced</p>
              <p className="text-xs text-gray-500">All content types updated from CMS</p>
            </div>
            <span className="text-xs text-gray-400 ml-auto">10m ago</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
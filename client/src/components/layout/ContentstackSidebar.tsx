'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Layout, 
  Search, 
  Replace, 
  History, 
  Settings,
  Database,
  FileText,
  Package,
  Tag,
  BarChart3,
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  Lightbulb
} from 'lucide-react';

interface ContentstackSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  contentTypes: Array<{
    uid: string;
    title: string;
    count: number;
    lastUpdated: string;
  }>;
  onContentTypeSelect: (contentType: string) => void;
  selectedContentType?: string;
}

export function ContentstackSidebar({ 
  activeTab, 
  onTabChange, 
  contentTypes,
  onContentTypeSelect,
  selectedContentType 
}: ContentstackSidebarProps) {
  const mainTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Layout },
    { id: 'content-types', label: 'Content Types', icon: Database },
    { id: 'find', label: 'Find Content', icon: Search },
    { id: 'replace', label: 'Smart Replace', icon: Replace },
    { id: 'bulk', label: 'Bulk Operations', icon: Zap },
    { id: 'suggestions', label: 'AI Suggestions', icon: Lightbulb },
    { id: 'history', label: 'History', icon: History },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

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
      case 'article': return 'text-blue-600 bg-blue-50';
      case 'product': return 'text-green-600 bg-green-50';
      case 'brands': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4">
        {/* Main Navigation */}
        <nav className="space-y-1">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <Button
                key={tab.id}
                variant={isActive ? "default" : "ghost"}
                className={`w-full justify-start ${
                  isActive 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon className="w-4 h-4 mr-3" />
                {tab.label}
              </Button>
            );
          })}
        </nav>

        {/* Content Types Section */}
        {activeTab === 'content-types' && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Content Types</h3>
              <Badge variant="secondary" className="text-xs">
                {contentTypes.length}
              </Badge>
            </div>
            
            <div className="space-y-1">
              {contentTypes.map((contentType) => {
                const Icon = getContentTypeIcon(contentType.uid);
                const isSelected = selectedContentType === contentType.uid;
                
                return (
                  <button
                    key={contentType.uid}
                    onClick={() => onContentTypeSelect(contentType.uid)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                      isSelected 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-1.5 rounded-md ${getContentTypeColor(contentType.uid)}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {contentType.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          {contentType.count} entries
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(contentType.lastUpdated).toLocaleDateString()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-6 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Quick Stats</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total Entries</span>
              <span className="font-medium">
                {contentTypes.reduce((sum, ct) => sum + ct.count, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Content Types</span>
              <span className="font-medium">{contentTypes.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Last Updated</span>
              <span className="font-medium">
                {contentTypes.length > 0 
                  ? new Date(Math.max(...contentTypes.map(ct => new Date(ct.lastUpdated).getTime()))).toLocaleDateString()
                  : 'Never'
                }
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Activity</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-gray-600">Bulk replace completed</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-gray-600">3 suggestions pending</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600">Auto-sync in 2m</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
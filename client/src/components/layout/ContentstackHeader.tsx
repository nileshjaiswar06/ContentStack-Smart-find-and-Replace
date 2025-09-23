'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Bell, 
  Settings, 
  User, 
  Menu,
  RefreshCw,
  Activity
} from 'lucide-react';

interface ContentstackHeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting';
  lastSync?: string;
}

export function ContentstackHeader({ 
  onRefresh, 
  isRefreshing = false, 
  connectionStatus = 'connected',
  lastSync 
}: ContentstackHeaderProps) {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    if (lastSync) {
      setCurrentTime(new Date(lastSync).toLocaleTimeString());
    }
  }, [lastSync]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'connecting': return 'bg-yellow-100 text-yellow-800';
      case 'disconnected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Logo and Navigation */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">CS</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Contentstack</h1>
                <p className="text-sm text-gray-500">Smart Find & Replace</p>
              </div>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500' : 
                    connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span>{getStatusText()}</span>
                </div>
              </div>
              {lastSync && currentTime && (
                <span className="text-xs text-gray-500">
                  Last sync: {currentTime}
                </span>
              )}
            </div>
          </div>

          {/* Center - Search */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search content types, entries..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center space-x-4">
            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            {/* Notifications */}
            <Button variant="outline" size="sm" className="relative">
              <Bell className="w-4 h-4" />
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs"
              >
                3
              </Badge>
            </Button>

            {/* Activity Monitor */}
            <Button variant="outline" size="sm">
              <Activity className="w-4 h-4" />
            </Button>

            {/* Settings */}
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4" />
            </Button>

            {/* User Menu */}
            <Button variant="outline" size="sm">
              <User className="w-4 h-4" />
            </Button>

            {/* Mobile Menu */}
            <Button variant="outline" size="sm" className="md:hidden">
              <Menu className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
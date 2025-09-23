'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Rocket, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Zap,
  Database,
  Webhook,
  Settings
} from 'lucide-react';
import { enhancedApi, LaunchConfig } from '@/lib/enhanced-api';

interface LaunchIntegrationProps {
  environment?: string;
  branch?: string;
}

export function LaunchIntegration({ 
  environment = 'development', 
  branch = 'main' 
}: LaunchIntegrationProps) {
  const [launchConfig, setLaunchConfig] = useState<LaunchConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadLaunchConfig = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await enhancedApi.getLaunchConfig(environment, branch);
      if (response.success && response.data) {
        setLaunchConfig(response.data);
        // Launch config loaded
      } else {
        setError('Failed to load Launch configuration');
      }
    } catch (err) {
      console.error('❌ Error loading Launch config:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Launch configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLaunchConfig();
  }, [environment, branch]);

  const handleLaunchAction = async (action: string, data?: any) => {
    setActionLoading(action);
    
    try {
      const response = await enhancedApi.executeLaunchAction({ action, data }, environment, branch);
      if (response.success) {
        // Launch action completed
        // Show success message or update UI
      } else {
        console.error(`❌ Launch action ${action} failed:`, response.error);
      }
    } catch (err) {
      console.error(`❌ Launch action ${action} error:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const getCapabilityIcon = (capability: string) => {
    switch (capability.toLowerCase()) {
      case 'contextual replacement': return Zap;
      case 'smart link updates': return ExternalLink;
      case 'named entity replacement': return Database;
      case 'deep content coverage': return Settings;
      case 'brandkit integration': return Database;
      case 'real-time sync': return Webhook;
      default: return CheckCircle;
    }
  };

  const getCapabilityColor = (capability: string) => {
    switch (capability.toLowerCase()) {
      case 'contextual replacement': return 'text-blue-600 bg-blue-50';
      case 'smart link updates': return 'text-green-600 bg-green-50';
      case 'named entity replacement': return 'text-purple-600 bg-purple-50';
      case 'deep content coverage': return 'text-orange-600 bg-orange-50';
      case 'brandkit integration': return 'text-yellow-600 bg-yellow-50';
      case 'real-time sync': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading Launch configuration...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          <span>Error: {error}</span>
        </div>
        <Button 
          onClick={loadLaunchConfig} 
          className="mt-4"
          size="sm"
        >
          Retry
        </Button>
      </Card>
    );
  }

  if (!launchConfig) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Rocket className="w-5 h-5 text-blue-600" />
          <span>Launch Integration</span>
        </h3>
        <Button
          onClick={loadLaunchConfig}
          disabled={loading}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="space-y-6">
        {/* App Information */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">App Information</h4>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium text-blue-900">{launchConfig.app.name}</h5>
              <Badge variant="outline" className="text-xs">
                v{launchConfig.app.version}
              </Badge>
            </div>
            <p className="text-sm text-blue-800 mb-3">{launchConfig.app.description}</p>
            
            <div className="flex flex-wrap gap-2">
              {launchConfig.app.capabilities.map((capability, index) => {
                const Icon = getCapabilityIcon(capability);
                return (
                  <Badge key={index} className={`text-xs ${getCapabilityColor(capability)}`}>
                    <Icon className="w-3 h-3 mr-1" />
                    {capability}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>

        {/* Integration Status */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Integration Status</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Rocket className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">Launch</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <CheckCircle className={`w-3 h-3 ${launchConfig.integration.launch.supported ? 'text-green-600' : 'text-red-600'}`} />
                  <span className="text-xs text-gray-600">Supported</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className={`w-3 h-3 ${launchConfig.integration.launch.ui_embedded ? 'text-green-600' : 'text-red-600'}`} />
                  <span className="text-xs text-gray-600">UI Embedded</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className={`w-3 h-3 ${launchConfig.integration.launch.entry_context ? 'text-green-600' : 'text-red-600'}`} />
                  <span className="text-xs text-gray-600">Entry Context</span>
                </div>
              </div>
            </div>

            <div className="p-3 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Zap className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-900">Automate</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <CheckCircle className={`w-3 h-3 ${launchConfig.integration.automate.supported ? 'text-green-600' : 'text-red-600'}`} />
                  <span className="text-xs text-gray-600">Supported</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className={`w-3 h-3 ${launchConfig.integration.automate.webhook_triggers ? 'text-green-600' : 'text-red-600'}`} />
                  <span className="text-xs text-gray-600">Webhook Triggers</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className={`w-3 h-3 ${launchConfig.integration.automate.real_time_sync ? 'text-green-600' : 'text-red-600'}`} />
                  <span className="text-xs text-gray-600">Real-time Sync</span>
                </div>
              </div>
            </div>

            <div className="p-3 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-gray-900">Brandkit</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <CheckCircle className={`w-3 h-3 ${launchConfig.integration.brandkit.cda_integration ? 'text-green-600' : 'text-red-600'}`} />
                  <span className="text-xs text-gray-600">CDA Integration</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className={`w-3 h-3 ${launchConfig.integration.brandkit.real_time_updates ? 'text-green-600' : 'text-red-600'}`} />
                  <span className="text-xs text-gray-600">Real-time Updates</span>
                </div>
                <div className="text-xs text-gray-600">
                  {launchConfig.integration.brandkit.content_types.length} content types
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h4>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleLaunchAction('sync_brandkit')}
              disabled={actionLoading === 'sync_brandkit'}
              size="sm"
              className="flex items-center space-x-2"
            >
              {actionLoading === 'sync_brandkit' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              <span>Sync Brandkit</span>
            </Button>
            
            <Button
              onClick={() => handleLaunchAction('test_connection')}
              disabled={actionLoading === 'test_connection'}
              size="sm"
              variant="outline"
              className="flex items-center space-x-2"
            >
              {actionLoading === 'test_connection' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Test Connection</span>
            </Button>
          </div>
        </div>

        {/* Endpoints */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Available Endpoints</h4>
          <div className="space-y-2">
            {Object.entries(launchConfig.endpoints).map(([key, endpoint]) => (
              <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {key.replace('_', ' ')}
                </span>
                <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                  {endpoint}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
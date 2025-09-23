// Configuration for Contentstack integration
export const config = {
  // Contentstack API Configuration
  contentstack: {
    apiKey: process.env.NEXT_PUBLIC_CONTENTSTACK_API_KEY || 'blt8adc59db5fcbca1c',
    deliveryToken: process.env.NEXT_PUBLIC_CONTENTSTACK_DELIVERY_TOKEN || 'your_delivery_token_here',
    previewToken: process.env.NEXT_PUBLIC_CONTENTSTACK_PREVIEW_TOKEN || 'your_preview_token_here',
    managementToken: process.env.NEXT_PUBLIC_CONTENTSTACK_MANAGEMENT_TOKEN || 'your_management_token_here',
    environment: process.env.NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT || 'development',
    branch: process.env.NEXT_PUBLIC_CONTENTSTACK_BRANCH || 'main',
    region: 'eu', // Based on your server configuration
    livePreviewHost: process.env.NEXT_PUBLIC_CONTENTSTACK_LIVE_PREVIEW_HOST || 'api.contentstack.io',
  },
  
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001',
    timeout: 30000,
    retries: 3,
  },
  
  // UI Configuration
  ui: {
    refreshInterval: 30000, // 30 seconds
    maxSuggestions: 10,
    maxEntriesPerPage: 50,
    enableRealTime: true,
  },
  
  // Feature Flags
  features: {
    enableAI: true,
    enableBulkOperations: true,
    enableRealTimeSync: true,
    enableLivePreview: true,
    enableAnalytics: false,
  }
};

// Validate configuration
export const validateConfig = () => {
  const errors: string[] = [];
  
  if (config.contentstack.apiKey === 'your_contentstack_api_key') {
    errors.push('Contentstack API Key not configured');
  }
  
  if (config.contentstack.deliveryToken === 'your_contentstack_delivery_token') {
    errors.push('Contentstack Delivery Token not configured');
  }
  
  if (config.api.baseUrl === 'http://localhost:3001') {
    console.warn('Using default API URL. Make sure your server is running on localhost:3001');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export default config;
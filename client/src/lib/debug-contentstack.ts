import { contentstack } from './contentstack';

// Debug function to test Contentstack connection
export async function debugContentstackConnection() {
  
  // Log current configuration
  // Current configuration
    apiKey: process.env.NEXT_PUBLIC_CONTENTSTACK_API_KEY || 'NOT_SET',
    deliveryToken: process.env.NEXT_PUBLIC_CONTENTSTACK_DELIVERY_TOKEN || 'NOT_SET',
    environment: process.env.NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT || 'NOT_SET',
    region: 'eu'
  });
  
  try {
    // Test 1: Check if we can get content types
    // Step 1: Fetching content types
    const contentTypesResult = await contentstack.contentType().find();
    // Content types result received
    // Found content types
    
    if ((contentTypesResult as any).content_types && (contentTypesResult as any).content_types.length > 0) {
      // Content type UIDs
      
      // Test 2: Try to get entries for the first content type
      const firstContentType = (contentTypesResult as any).content_types[0].uid;
      // Step 2: Fetching entries
      
      try {
        const entriesResult = await contentstack.contentType(firstContentType).entry().find();
        // Entries result received
        // Found entries
        
        if ((entriesResult as any).entries && (entriesResult as any).entries.length > 0) {
          const firstEntry = (entriesResult as any).entries[0];
          // Sample entry
            uid: firstEntry.uid,
            title: firstEntry.title || firstEntry.name,
            contentType: firstEntry._content_type_uid
          });
        }
      } catch (entryError) {
        console.error('❌ Error fetching entries:', entryError);
      }
    }
    
    // Contentstack connection test completed
    return true;
  } catch (error: any) {
    console.error('❌ Contentstack connection failed:', error);
    
    if (error.response) {
      console.error('📊 Error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      if (error.response.status === 400) {
        console.error('🔧 400 Error: This usually means invalid API credentials');
        console.error('💡 Please check:');
        console.error('   1. Your delivery token is correct');
        console.error('   2. Your environment name is correct');
        console.error('   3. Your API key is correct');
        console.error('   4. Create a .env.local file in the client directory');
      }
    }
    
    console.error('🔧 Please check your API credentials in .env.local');
    return false;
  }
}

// Function to test with different configurations
export async function testWithConfig(apiKey: string, deliveryToken: string, environment: string, region: string) {
  // Testing with custom config
  
  const testConfig = {
    apiKey,
    deliveryToken,
    environment,
    region: region as any,
  };
  
  try {
    const testStack = require('@contentstack/delivery-sdk').stack(testConfig);
    const result = await testStack.contentType().find();
    // Test successful with config
    // Found content types
    return true;
  } catch (error) {
    console.error('❌ Test failed with config:', testConfig);
    console.error('Error:', error);
    return false;
  }
}
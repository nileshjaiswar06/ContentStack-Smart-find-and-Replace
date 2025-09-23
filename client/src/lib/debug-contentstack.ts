import { contentstack } from './contentstack';

// Debug function to test Contentstack connection
export async function debugContentstackConnection() {
  console.log('🔍 Debugging Contentstack Connection...');
  
  // Log current configuration
  console.log('📋 Current configuration:', {
    apiKey: process.env.NEXT_PUBLIC_CONTENTSTACK_API_KEY || 'NOT_SET',
    deliveryToken: process.env.NEXT_PUBLIC_CONTENTSTACK_DELIVERY_TOKEN || 'NOT_SET',
    environment: process.env.NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT || 'NOT_SET',
    region: 'eu'
  });
  
  try {
    // Test 1: Check if we can get content types
    console.log('📋 Step 1: Fetching content types...');
    const contentTypesResult = await contentstack.contentType().find();
    console.log('✅ Content types result:', contentTypesResult);
    console.log('📊 Found content types:', contentTypesResult.entries?.length || 0);
    
    if (contentTypesResult.entries && contentTypesResult.entries.length > 0) {
      console.log('📝 Content type UIDs:', contentTypesResult.entries.map((ct: any) => ct.uid));
      
      // Test 2: Try to get entries for the first content type
      const firstContentType = contentTypesResult.entries[0].uid;
      console.log(`📄 Step 2: Fetching entries for ${firstContentType}...`);
      
      try {
        const entriesResult = await contentstack.contentType(firstContentType).entry().find();
        console.log('✅ Entries result:', entriesResult);
        console.log('📊 Found entries:', entriesResult.entries?.length || 0);
        
        if (entriesResult.entries && entriesResult.entries.length > 0) {
          console.log('📝 Sample entry:', {
            uid: entriesResult.entries[0].uid,
            title: entriesResult.entries[0].title || entriesResult.entries[0].name,
            contentType: entriesResult.entries[0]._content_type_uid
          });
        }
      } catch (entryError) {
        console.error('❌ Error fetching entries:', entryError);
      }
    }
    
    console.log('🎉 Contentstack connection test completed!');
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
  console.log('🧪 Testing with custom config...');
  
  const testConfig = {
    apiKey,
    deliveryToken,
    environment,
    region: region as any,
  };
  
  try {
    const testStack = require('@contentstack/delivery-sdk').stack(testConfig);
    const result = await testStack.contentType().find();
    console.log('✅ Test successful with config:', testConfig);
    console.log('📊 Found content types:', result.entries?.length || 0);
    return true;
  } catch (error) {
    console.error('❌ Test failed with config:', testConfig);
    console.error('Error:', error);
    return false;
  }
}
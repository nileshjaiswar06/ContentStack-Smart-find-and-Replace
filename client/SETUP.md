# Client Setup Guide

## Environment Configuration

Create a `.env.local` file in the client directory with the following content:

```env
# Contentstack Configuration
NEXT_PUBLIC_CONTENTSTACK_API_KEY=blt8adc59db5fcbca1c
NEXT_PUBLIC_CONTENTSTACK_DELIVERY_TOKEN=your_delivery_token_here
NEXT_PUBLIC_CONTENTSTACK_PREVIEW_TOKEN=your_preview_token_here
NEXT_PUBLIC_CONTENTSTACK_MANAGEMENT_TOKEN=your_management_token_here
NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT=development
NEXT_PUBLIC_CONTENTSTACK_BRANCH=main
NEXT_PUBLIC_CONTENTSTACK_LIVE_PREVIEW_HOST=api.contentstack.io

# API Configuration
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

## Getting Your Contentstack Tokens

1. Go to your Contentstack dashboard
2. Navigate to Settings > Tokens
3. Copy the following tokens:
   - **Delivery Token**: For reading content
   - **Preview Token**: For preview content
   - **Management Token**: For writing content

## Running the Application

1. **Start your server** (should be running on localhost:3001)
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Create .env.local** with your tokens
4. **Start the client**:
   ```bash
   npm run dev
   ```
5. **Open** `http://localhost:3000`

## Features

- **Real-time Content Sync**: Fetches content directly from Contentstack CMS
- **Smart Find & Replace**: AI-powered content replacement
- **Bulk Operations**: Process multiple entries at once
- **Live Preview**: See changes before applying

## Troubleshooting

- **429 Rate Limit Errors**: The app includes rate limiting and retry logic
- **Connection Issues**: Check that your server is running on localhost:3001
- **Token Errors**: Verify your Contentstack tokens are correct
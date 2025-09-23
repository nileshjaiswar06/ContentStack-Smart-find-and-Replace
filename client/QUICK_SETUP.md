# Quick Setup Guide

## Step 1: Create Environment File

Create a file named `.env.local` in the `client` directory with your Contentstack credentials:

```env
NEXT_PUBLIC_CONTENTSTACK_API_KEY=blt8adc59db5fcbca1c
NEXT_PUBLIC_CONTENTSTACK_DELIVERY_TOKEN=your_delivery_token_here
NEXT_PUBLIC_CONTENTSTACK_PREVIEW_TOKEN=your_preview_token_here
NEXT_PUBLIC_CONTENTSTACK_MANAGEMENT_TOKEN=your_management_token_here
NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT=development
NEXT_PUBLIC_CONTENTSTACK_BRANCH=main
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

## Step 2: Get Your Tokens

1. Go to your Contentstack dashboard
2. Navigate to **Settings > Tokens**
3. Copy the tokens and replace the placeholder values in `.env.local`

## Step 3: Run the Application

```bash
# Make sure your server is running on localhost:3001
cd client
npm run dev
```

## Step 4: Check Console

Open browser console to see:
- Connection test results
- Content types found
- Entry counts for each type

## Troubleshooting

- **412 errors**: Check your delivery token
- **0 entries**: Verify your environment and branch settings
- **Connection failed**: Ensure API key is correct

The app will now fetch real data from your Contentstack CMS instead of showing hardcoded values.
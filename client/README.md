# Contentstack Smart Find & Replace Client

A modern, real-time client application for Contentstack CMS with AI-powered smart find and replace functionality.

## Features

### 🚀 Real-time Integration
- **Dynamic Content Sync**: Automatically fetches new entries and content types from Contentstack CMS
- **Live Updates**: Real-time synchronization with your Contentstack instance
- **Auto-refresh**: Content updates every 30 seconds with manual refresh option

### 🤖 AI-Powered Smart Replace
- **Intelligent Suggestions**: AI-generated replacement suggestions based on context
- **Multiple Sources**: Suggestions from AI, brand kit, contextual analysis, and heuristics
- **Confidence Scoring**: Each suggestion includes confidence levels and reasoning
- **Auto-apply**: High-confidence suggestions can be automatically applied

### 📊 Content Management
- **Content Types View**: Browse and manage all your content types
- **Entry Management**: View, select, and manage individual entries
- **Bulk Operations**: Perform operations on multiple entries simultaneously
- **Preview & Verify**: Preview changes before applying them

### 🎨 Contentstack UI Design
- **Professional Interface**: Clean, modern design matching Contentstack's UI patterns
- **Responsive Layout**: Works seamlessly on desktop and mobile devices
- **Intuitive Navigation**: Easy-to-use sidebar and tab-based navigation
- **Status Indicators**: Real-time connection status and operation feedback

## Getting Started

### Prerequisites
- Node.js 18+ 
- Your Contentstack server running on `http://localhost:3001`
- Contentstack API credentials

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env.local` file in the client directory:
   ```env
   # Contentstack Configuration
   NEXT_PUBLIC_CONTENTSTACK_API_KEY=your_contentstack_api_key
   NEXT_PUBLIC_CONTENTSTACK_DELIVERY_TOKEN=your_contentstack_delivery_token
   NEXT_PUBLIC_CONTENTSTACK_PREVIEW_TOKEN=your_contentstack_preview_token
   NEXT_PUBLIC_CONTENTSTACK_MANAGEMENT_TOKEN=your_contentstack_management_token
   NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT=development
   NEXT_PUBLIC_CONTENTSTACK_BRANCH=main
   
   # API Configuration
   NEXT_PUBLIC_API_BASE=http://localhost:3001
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to `http://localhost:3000`

## Usage

### Dashboard
- View overview of all content types and entries
- Monitor recent changes and AI suggestions
- Quick access to common operations

### Content Types
- Browse all available content types
- View entry counts and last updated times
- Select entries for find/replace operations

### Smart Find & Replace
1. **Select Content Type**: Choose the content type you want to work with
2. **Select Entries**: Pick specific entries or work with all entries
3. **Enter Find Text**: Specify what you want to find
4. **Get AI Suggestions**: Review AI-generated replacement suggestions
5. **Preview Changes**: See exactly what will be changed before applying
6. **Apply Changes**: Execute the replacement with confidence

### Bulk Operations
- Perform find/replace operations on multiple entries
- Monitor job progress in real-time
- Support for dry-run mode for safe testing

## Architecture

### Components
- **ContentstackApp**: Main application component with routing
- **ContentstackHeader**: Top navigation and status indicators
- **ContentstackSidebar**: Left navigation and content type listing
- **ContentstackDashboard**: Overview and quick actions
- **ContentTypesView**: Content type and entry management
- **SmartReplaceInterface**: AI-powered find and replace
- **BulkOperationsInterface**: Multi-entry operations

### Services
- **Enhanced API Client**: Communicates with your server endpoints
- **Contentstack Service**: Direct integration with Contentstack SDK
- **Real-time Sync**: Handles live updates and synchronization
- **Configuration**: Centralized app configuration

### Key Features
- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Modern, responsive styling
- **Radix UI**: Accessible component primitives
- **React Query**: Efficient data fetching and caching
- **Real-time Updates**: WebSocket-like polling for live updates

## API Integration

The client integrates with your server's REST API endpoints:

- `GET /health` - Health check
- `GET /api/replace/:contentType` - List entries
- `POST /api/replace/preview` - Preview changes
- `PUT /api/replace/apply` - Apply changes
- `POST /api/replace/bulk-preview` - Bulk preview
- `PUT /api/replace/bulk-apply` - Bulk apply
- `GET /api/replace/job/:jobId` - Job status
- `POST /api/replace/suggest` - AI suggestions

## Configuration

### Environment Variables
All configuration is handled through environment variables. See the `.env.local.example` file for all available options.

### Feature Flags
Enable/disable features through the configuration:
- `enableAI`: AI-powered suggestions
- `enableBulkOperations`: Bulk operations interface
- `enableRealTimeSync`: Real-time content updates
- `enableLivePreview`: Contentstack Live Preview integration

## Development

### Project Structure
```
src/
├── app/                 # Next.js app directory
├── components/          # React components
│   ├── layout/         # Layout components
│   ├── dashboard/      # Dashboard components
│   ├── content-types/  # Content type management
│   ├── smart-replace/  # Find/replace interface
│   └── bulk-operations/ # Bulk operations
├── lib/                # Utilities and services
│   ├── api.ts         # API client
│   ├── contentstack.ts # Contentstack integration
│   ├── realtime-sync.ts # Real-time updates
│   └── config.ts      # Configuration
├── hooks/              # Custom React hooks
└── types/              # TypeScript type definitions
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Check the documentation
- Review the API integration guide
- Open an issue on GitHub

---

Built with ❤️ for Contentstack CMS integration
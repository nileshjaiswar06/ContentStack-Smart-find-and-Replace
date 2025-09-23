# Contentstack Smart Find & Replace Platform

A comprehensive, AI-powered content management platform that integrates with Contentstack CMS to provide intelligent find and replace operations, real-time content synchronization, and advanced text analysis capabilities.

## 🚀 Project Overview

This project is a full-stack application designed to enhance content management workflows by providing intelligent content analysis, automated suggestions, and bulk operations for Contentstack CMS. The platform combines modern web technologies with advanced AI/ML capabilities to deliver a powerful content management experience.

### What This Project Does

- **Smart Content Analysis**: Uses spaCy NLP models for named entity recognition and text analysis
- **AI-Powered Suggestions**: Provides intelligent replacement suggestions based on context and brand guidelines
- **Real-time Synchronization**: Keeps content in sync with Contentstack CMS in real-time
- **Bulk Operations**: Enables efficient processing of multiple content entries simultaneously
- **Brand Integration**: Integrates with brand kits for consistent content styling
- **Advanced Preview**: Shows detailed before/after comparisons before applying changes
- **Workflow Automation**: Automates repetitive content management tasks

## 🏗️ Architecture & Technology Choices

### Why Docker?

**Docker was chosen for several critical reasons:**

1. **Microservices Architecture**: The application consists of three distinct services (Next.js frontend, Node.js backend, Python spaCy service) that need to communicate seamlessly
2. **Dependency Isolation**: Each service has different runtime requirements (Node.js vs Python) and dependencies that could conflict
3. **Consistent Environment**: Ensures the application runs identically across development, staging, and production environments
4. **Scalability**: Easy to scale individual services independently based on demand
5. **Service Discovery**: Docker Compose handles service networking and health checks automatically
6. **Development Efficiency**: Developers can start the entire stack with a single command
7. **Production Readiness**: Docker containers are production-ready and can be deployed to any container orchestration platform

### Why spaCy Service?

**spaCy was selected for the NLP service for these reasons:**

1. **Industry Standard**: spaCy is the most widely used and well-maintained NLP library in Python
2. **High Performance**: Optimized for production use with efficient processing pipelines
3. **Multiple Model Support**: Supports both fast models (en_core_web_sm) and accurate transformer models (en_core_web_trf)
4. **Custom Entity Recognition**: Allows training custom models for brand-specific entities
5. **Confidence Scoring**: Provides confidence scores for entity recognition decisions
6. **Batch Processing**: Efficiently processes multiple texts simultaneously
7. **Production Ready**: Includes monitoring, metrics, and circuit breaker patterns
8. **Extensibility**: Easy to add custom entity rulers and training data

### Technology Stack Rationale

#### Frontend (Next.js + TypeScript)
- **Next.js**: Chosen for its excellent developer experience, built-in optimizations, and seamless integration with React
- **TypeScript**: Provides type safety and better developer experience for large-scale applications
- **Tailwind CSS**: Rapid UI development with consistent design system
- **Radix UI**: Accessible, unstyled UI components for better user experience

#### Backend (Node.js + Express + TypeScript)
- **Node.js**: JavaScript runtime for consistency with frontend and excellent async processing
- **Express.js**: Lightweight, flexible web framework with extensive middleware ecosystem
- **TypeScript**: Type safety and better maintainability for complex business logic
- **BullMQ**: Redis-based job queue for handling bulk operations and background tasks

#### NLP Service (Python + FastAPI + spaCy)
- **FastAPI**: Modern, fast web framework with automatic API documentation
- **spaCy**: Production-ready NLP library with excellent performance
- **Prometheus**: Metrics collection for monitoring and observability
- **Pydantic**: Data validation and serialization for robust API contracts

## 📁 Project Structure

```
contentstack/
├── client/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/           # Next.js app router pages
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility libraries and API clients
│   │   └── types/         # TypeScript type definitions
│   └── package.json
├── server/                 # Node.js backend API
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── services/      # Business logic services
│   │   ├── middlewares/   # Express middleware
│   │   ├── jobs/          # Background job processing
│   │   └── utils/         # Utility functions
│   │       ├── deepReplace.ts      # Enhanced deep content replacement
│   │       ├── tableParser.ts      # Table field processing
│   │       ├── componentParser.ts  # Component field processing
│   │       ├── customFieldParser.ts # Custom field processing
│   │       └── __tests__/          # Unit tests for parsers
│   └── package.json
├── spacy-service/          # Python NLP microservice
│   ├── app.py             # FastAPI application
│   ├── entity_ruler.py    # Custom entity recognition
│   ├── requirements.txt   # Python dependencies
│   └── Dockerfile
├── docker-compose.yml      # Multi-service orchestration
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- Contentstack CMS account with API credentials
- Git (for cloning the repository)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd contentstack
   ```

2. **Configure environment variables**
   ```bash
   # Copy environment template
   cp server/env.example server/.env
   
   # Edit server/.env with your Contentstack credentials
   # Required variables:
   # - CONTENTSTACK_API_KEY
   # - CONTENTSTACK_DELIVERY_TOKEN
   # - CONTENTSTACK_MANAGEMENT_TOKEN
   # - CONTENTSTACK_ENVIRONMENT
   ```

3. **Start all services**
   ```bash
   # Using Docker Compose (recommended)
   docker-compose up --build
   
   # Or using the provided start script
   ./start.sh  # Linux/Mac
   start.bat   # Windows
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - spaCy Service: http://localhost:8001
   - API Documentation: http://localhost:8001/docs
   - Redis: localhost:6379

### Development Setup

For development with hot reloading:

```bash
# Terminal 1: Start backend services
docker-compose up spacy-service server

# Terminal 2: Start frontend with hot reload
cd client
npm install
npm run dev
```

## 🔧 Configuration

### Environment Variables

#### Server Configuration (`server/.env`)
```env
# Contentstack Configuration
CONTENTSTACK_API_KEY=your_api_key
CONTENTSTACK_DELIVERY_TOKEN=your_delivery_token
CONTENTSTACK_MANAGEMENT_TOKEN=your_management_token
CONTENTSTACK_ENVIRONMENT=development
CONTENTSTACK_BRANCH=main

# Service Configuration
SERVER_PORT=3001
SPACY_SERVICE_URL=http://spacy-service:8000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Redis Configuration (for job queues)
REDIS_URL=redis://localhost:6379

# Security
API_RATE_LIMIT_READ=100
API_RATE_LIMIT_WRITE=20
```

#### Client Configuration (`client/.env.local`)
```env
# Contentstack Configuration
NEXT_PUBLIC_CONTENTSTACK_API_KEY=your_api_key
NEXT_PUBLIC_CONTENTSTACK_DELIVERY_TOKEN=your_delivery_token
NEXT_PUBLIC_CONTENTSTACK_PREVIEW_TOKEN=your_preview_token
NEXT_PUBLIC_CONTENTSTACK_MANAGEMENT_TOKEN=your_management_token
NEXT_PUBLIC_CONTENTSTACK_ENVIRONMENT=development
NEXT_PUBLIC_CONTENTSTACK_BRANCH=main

# API Configuration
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

## 🎯 Key Features

### 1. Smart Find & Replace
- **Context-Aware Search**: Uses AI to understand content context for better matching
- **Preview Mode**: See exactly what will change before applying modifications
- **Bulk Operations**: Process multiple entries simultaneously
- **Rich Text Support**: Handles complex HTML and markdown content
- **Enhanced Deep Content Coverage**: 
  - **Table Support**: Full table field processing with row and cell-level replacements
  - **Nested Components**: Handles unlimited nesting depth for custom components
  - **Component Groups**: Processes arrays of components efficiently
  - **Custom Fields**: Supports all Contentstack field types (JSON, Group, Reference, File, Date, Number, Boolean)
  - **Real-time Processing**: Works with live Contentstack data, not hardcoded content

### 2. AI-Powered Suggestions
- **Multiple Sources**: Suggestions from AI analysis, brand guidelines, and contextual patterns
- **Confidence Scoring**: Each suggestion includes confidence levels and reasoning
- **Auto-Apply**: High-confidence suggestions can be automatically applied
- **Learning System**: Improves suggestions based on user feedback

### 3. Named Entity Recognition
- **Dual Model Support**: Fast model for quick processing, transformer model for accuracy
- **Custom Entities**: Train models on brand-specific entities and terminology
- **Batch Processing**: Efficiently process multiple texts simultaneously
- **Confidence Metrics**: Detailed confidence scores for each recognized entity

### 4. Real-time Synchronization
- **Live Updates**: Content changes are reflected in real-time
- **Conflict Resolution**: Handles concurrent modifications gracefully
- **Status Monitoring**: Visual indicators for connection and sync status
- **Auto-refresh**: Automatic content updates every 30 seconds

### 5. Brand Integration
- **Brand Kit Support**: Integrates with external brand management systems
- **Style Consistency**: Ensures content follows brand guidelines
- **Asset Management**: Handles brand assets and media files
- **Template System**: Pre-defined content templates for consistency

### 6. Enhanced Deep Content Coverage
- **Table Processing**: 
  - Full table field support with row and cell-level replacements
  - Preserves table structure and metadata
  - Handles complex table layouts and nested content
- **Nested Components**: 
  - Unlimited nesting depth for custom components
  - Component-specific processing logic
  - Preserves component metadata and relationships
- **Component Groups**: 
  - Efficient processing of component arrays
  - Batch operations on multiple components
  - Maintains component group integrity
- **Custom Field Types**: 
  - JSON fields with deep object traversal
  - Group fields with nested property processing
  - Reference fields with metadata updates
  - File fields with filename and description updates
  - Date, Number, and Boolean field support
- **Real-time Data Processing**: 
  - Works with live Contentstack data
  - No hardcoded or mock data dependencies
  - Handles production content structures

## 🔄 API Endpoints

### Core API Routes
- `GET /health` - Main server health check
- `GET /api/health` - API health check

### Replace Operations (`/api/replace`)
- `GET /api/replace/` - API documentation
- `GET /api/replace/snapshots` - List available snapshots
- `GET /api/replace/:contentTypeUid` - List entries of a content type
- `POST /api/replace/preview` - Preview changes before applying
- `PUT /api/replace/apply` - Apply changes to an entry
- `POST /api/replace/bulk-preview` - Preview changes for multiple entries
- `PUT /api/replace/bulk-apply` - Apply changes to multiple entries
- `GET /api/replace/job/:jobId` - Get job status
- `POST /api/replace/rollback` - Rollback changes using snapshots

### NER (Named Entity Recognition) (`/api/ner`)
- `POST /api/ner/` - Extract entities from single text
- `POST /api/ner/batch` - Extract entities from multiple texts
- `GET /api/ner/health` - NER service health check

### AI Suggestions (`/api/suggest`)
- `POST /api/suggest/` - Get AI-powered replacement suggestions
- `POST /api/suggest/batch` - Get suggestions for multiple texts
- `GET /api/suggest/health` - Suggestions service health check
- `GET /api/suggest/ai-status` - AI service status

### Brandkit (`/api/brandkit`)
- `POST /api/brandkit/suggestions` - Get brand-based suggestions
- `POST /api/brandkit/analyze-tone` - Analyze content tone
- `POST /api/brandkit/sync` - Sync brandkit data
- `GET /api/brandkit/providers` - List available providers
- `GET /api/brandkit/status` - Brandkit service status

### Launch Integration (`/api/launch`)
- `GET /api/launch/app` - Main Launch app UI (embedded in Contentstack)
- `GET /api/launch/config` - App configuration and capabilities
- `POST /api/launch/action` - Handle actions from Launch UI

### Webhooks (`/api/webhooks`)
- `POST /api/webhooks/entry` - Entry change webhooks
- `POST /api/webhooks/asset` - Asset change webhooks
- `POST /api/webhooks/publish` - Publish event webhooks
- `POST /api/webhooks/automate` - Automate workflow webhooks
- `GET /api/webhooks/status` - Webhook service status

### Automate Workflows (`/api/automate`)
- `GET /api/automate/workflows` - List all workflows
- `GET /api/automate/workflows/:id` - Get specific workflow
- `POST /api/automate/workflows` - Create new workflow
- `PUT /api/automate/workflows/:id` - Update workflow
- `DELETE /api/automate/workflows/:id` - Delete workflow
- `POST /api/automate/execute` - Execute workflow

## 🐳 Docker Services

### spaCy Service (Port 8001)
- **Purpose**: Named Entity Recognition and text analysis
- **Technology**: Python + FastAPI + spaCy
- **Features**: Dual model support, batch processing, custom entities
- **Health Check**: `/health` endpoint with model status

### Server (Port 3001)
- **Purpose**: Main API server and business logic
- **Technology**: Node.js + Express + TypeScript
- **Features**: Contentstack integration, job queues, real-time sync, enhanced deep content coverage
- **Health Check**: `/health` endpoint

### Client (Port 3000)
- **Purpose**: Frontend user interface
- **Technology**: Next.js + React + TypeScript
- **Features**: Real-time UI, responsive design, Contentstack integration
- **Health Check**: Built-in Next.js health monitoring

### Redis (Port 6379)
- **Purpose**: Job queue and caching
- **Technology**: Redis 7-alpine
- **Features**: Background job processing, session storage
- **Health Check**: Built-in Redis health monitoring

## 📊 Monitoring & Observability

### Metrics Collection
- **Prometheus Integration**: Comprehensive metrics for all services
- **Request Tracking**: Request counts, durations, and error rates
- **Entity Recognition Metrics**: Processing times and accuracy scores
- **Circuit Breaker Monitoring**: Service health and failure tracking

### Logging
- **Structured Logging**: JSON-formatted logs with request correlation IDs
- **Request Tracing**: End-to-end request tracking across services
- **Error Tracking**: Detailed error logging with stack traces
- **Performance Monitoring**: Processing time and resource usage tracking

## 🚀 Deployment

### Production Deployment
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

### Environment-Specific Configuration
- **Development**: Hot reloading, debug logging, local services
- **Staging**: Production-like environment with test data
- **Production**: Optimized builds, security hardening, monitoring

## 🔒 Security Features

- **API Rate Limiting**: Prevents abuse with configurable rate limits
- **CORS Protection**: Restricts cross-origin requests to allowed domains
- **Input Validation**: Comprehensive validation of all API inputs
- **Authentication**: API key-based authentication for service communication
- **Security Headers**: Helmet.js for security header management
- **Request Sanitization**: Input sanitization to prevent injection attacks

## 🧪 Testing

### Running Tests
```bash
# Backend tests
cd server
npm test

# Frontend tests
cd client
npm test

# Integration tests
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Test Coverage
- **Unit Tests**: Individual component and service testing
- **Integration Tests**: Cross-service communication testing
- **End-to-End Tests**: Full user workflow testing
- **Performance Tests**: Load testing and benchmarking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests for new features
- Update documentation for API changes
- Follow the existing code style and patterns

## 📚 Documentation

- [Architecture Overview](docs/architecture.md)
- [NER Configuration Guide](docs/ner-configuration.md)
- [High Accuracy NER Implementation](docs/high-accuracy-ner-implementation.md)
- [Launch & Automate Integration](docs/launch-automate-integration.md)

## 🐛 Troubleshooting

### Common Issues

1. **Service Connection Errors**
   - Check that all services are running: `docker-compose ps`
   - Verify environment variables are set correctly
   - Check service health endpoints

2. **Contentstack API Errors**
   - Verify API credentials in environment variables
   - Check Contentstack API status
   - Review rate limiting settings

3. **spaCy Model Errors**
   - Ensure models are downloaded: `python -m spacy download en_core_web_sm`
   - Check model availability in health endpoint
   - Verify Python dependencies are installed

### Debug Mode
```bash
# Enable debug logging
DEBUG=true docker-compose up

# View service logs
docker-compose logs -f [service-name]
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Contentstack**: For providing the excellent CMS platform
- **spaCy**: For the powerful NLP library and models
- **Next.js Team**: For the amazing React framework
- **FastAPI**: For the modern Python web framework
- **Docker**: For containerization and orchestration tools

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the documentation in the `docs/` folder
- Review the troubleshooting section above

---


# Smart Find & Replace - Docker Setup

This document explains how to run the entire Smart Find & Replace application using Docker.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed
- Docker Compose v3.8+

### Single Command Startup
```bash
docker-compose up --build
```

This will start all three services:
- **Client** (Next.js): http://localhost:3000
- **Server** (Node.js): http://localhost:3001  
- **Spacy Service** (Python): http://localhost:8000

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client        │    │   Server        │    │   Spacy Service │
│   (Next.js)     │───▶│   (Node.js)     │───▶│   (Python)      │
│   Port: 3000    │    │   Port: 3001    │    │   Port: 8000    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Services

### 1. Client (Frontend)
- **Technology**: Next.js 14 with TypeScript
- **Port**: 3000
- **Features**: 
  - Full-page application (no sidebar)
  - Verify-before-replace workflow
  - Field-level content selection
  - Side-by-side diff preview

### 2. Server (Backend)
- **Technology**: Node.js with Express
- **Port**: 3001
- **Features**:
  - REST API endpoints
  - Contentstack integration
  - NER service proxy
  - Batch processing

### 3. Spacy Service (NER)
- **Technology**: Python with FastAPI
- **Port**: 8000
- **Features**:
  - Named Entity Recognition
  - Custom entity patterns
  - Performance optimization

## 🔧 Docker Commands

### Start All Services
```bash
docker-compose up --build
```

### Start in Background
```bash
docker-compose up -d --build
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f client
docker-compose logs -f server
docker-compose logs -f spacy-service
```

### Stop Services
```bash
docker-compose down
```

### Rebuild Specific Service
```bash
docker-compose up --build client
```

### Clean Up
```bash
# Remove containers and networks
docker-compose down

# Remove everything including volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## 🏥 Health Checks

All services include health check endpoints:

- **Client**: http://localhost:3000 (Next.js built-in)
- **Server**: http://localhost:3001/health
- **Spacy Service**: http://localhost:8000/health

## 🔍 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the port
   netstat -tulpn | grep :3000
   
   # Kill the process
   sudo kill -9 <PID>
   ```

2. **Docker Build Fails**
   ```bash
   # Clean Docker cache
   docker system prune -a
   
   # Rebuild without cache
   docker-compose build --no-cache
   ```

3. **Services Not Starting**
   ```bash
   # Check service status
   docker-compose ps
   
   # Check logs
   docker-compose logs <service-name>
   ```

### Development Mode

For development with hot reload:

```bash
# Start only backend services
docker-compose up spacy-service server

# Run client locally
cd client
npm run dev
```

## 📊 Monitoring

### Service Status
```bash
docker-compose ps
```

### Resource Usage
```bash
docker stats
```

### Logs with Timestamps
```bash
docker-compose logs -f -t
```

## 🚀 Production Deployment

### Environment Variables
Create `.env` files for each service:

**server/.env**
```env
NODE_ENV=production
PORT=3001
SPACY_SERVICE_URL=http://spacy-service:8000
CONTENTSTACK_API_KEY=your_api_key
CONTENTSTACK_DELIVERY_TOKEN=your_delivery_token
```

**client/.env.local**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Production Build
```bash
# Build production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

## 🔒 Security Notes

- All services run in isolated containers
- Internal communication uses Docker network
- External ports are only exposed for necessary services
- Health checks ensure service availability

## 📈 Performance

- **Client**: Optimized Next.js build with static generation
- **Server**: Node.js with connection pooling and caching
- **Spacy Service**: Python with model caching and async processing

## 🎯 Features Demonstrated

1. **Verify Before Replace**: Users can preview and approve changes
2. **Field-Level Control**: Select specific fields to modify
3. **Diff Preview**: Side-by-side comparison of original vs replacement
4. **Enterprise UI**: Full-page application with professional design
5. **Microservices**: Scalable architecture with separate services
6. **Health Monitoring**: Built-in health checks and monitoring

This setup demonstrates enterprise-grade content management capabilities suitable for hackathon judging.
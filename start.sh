#!/bin/bash

# Smart Find & Replace - Startup Script
echo "Starting Smart Find & Replace Application..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "docker-compose is not installed. Please install Docker Compose."
    exit 1
fi

echo "Building and starting all services..."
echo "   - Client (Next.js): http://localhost:3000"
echo "   - Server (Node.js): http://localhost:3001"
echo "   - Spacy Service (Python): http://localhost:8000"
echo ""

# Start all services
docker-compose up --build

echo ""
echo "All services started successfully!"
echo "Open http://localhost:3000 in your browser to use the application."
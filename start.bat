@echo off
REM Smart Find & Replace - Startup Script for Windows

echo Starting Smart Find & Replace Application...

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo docker-compose is not installed. Please install Docker Compose.
    pause
    exit /b 1
)

echo Building and starting all services...
echo    - Client (Next.js): http://localhost:3000
echo    - Server (Node.js): http://localhost:3001
echo    - Spacy Service (Python): http://localhost:8000
echo.

REM Start all services
docker-compose up --build

echo.
echo All services started successfully!
echo Open http://localhost:3000 in your browser to use the application.
pause
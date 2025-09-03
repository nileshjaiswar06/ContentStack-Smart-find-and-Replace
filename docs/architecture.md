# Architecture Overview

## System Architecture

The Smart Find & Replace tool is built with a modern, scalable architecture that separates concerns between the frontend and backend.

### Frontend (Next.js)

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React hooks and context
- **API Communication**: Axios for HTTP requests

### Backend (Express.js)

- **Framework**: Express.js
- **Language**: TypeScript
- **Runtime**: Node.js
- **API Design**: RESTful endpoints
- **Error Handling**: Centralized error middleware

## Key Components

### Client Components

- **ReplaceForm**: Main interface for find/replace operations
- **PreviewDiff**: Shows before/after comparison
- **EntrySelector**: Allows selection of content entries

### Server Services

- **ContentstackService**: Handles Contentstack API interactions
- **BrandkitService**: Manages asset operations (optional)
- **RichTextParser**: Processes rich text content
- **DiffPreview**: Generates comparison views

## Data Flow

1. User selects entries and defines find/replace criteria
2. Frontend sends request to backend API
3. Backend fetches content from Contentstack
4. Backend processes content and generates preview
5. Frontend displays preview to user
6. User confirms changes
7. Backend applies changes to Contentstack
8. Frontend shows success/error status

## Security Considerations

- Environment variables for API keys
- Input validation and sanitization
- Rate limiting for API calls
- Error handling without exposing sensitive data

## Scalability

- Modular service architecture
- Stateless backend design
- Efficient content processing
- Caching strategies for frequently accessed data
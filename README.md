# Smart Find & Replace

A powerful tool for finding and replacing content across Contentstack entries with preview capabilities.

## Features

- Smart content search across multiple entries
- Batch find and replace operations
- Preview changes before applying
- Rich text content support
- Brandkit integration for asset management
- Fast and efficient processing

## Architecture

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Backend**: Express.js with TypeScript
- **CMS**: Contentstack
- **Asset Management**: Brandkit (optional)

## Quick Start

1. Clone the repository
2. Install dependencies for both client and server
3. Configure environment variables
4. Start the development servers

```bash
# Install client dependencies
cd client && npm install

# Install server dependencies
cd ../server && npm install

# Start development servers
npm run dev:client  # Frontend on :3000
npm run dev:server  # Backend on :3001
```

## Environment Setup

Copy `.env.example` to `.env` and fill in your Contentstack credentials:

```bash
cp .env.example .env
```

## Documentation

- [Architecture Overview](docs/architecture.md)
- [Demo Plan](docs/demo-plan.md)

## License

See [LICENSE](LICENSE) for details.
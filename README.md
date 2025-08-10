# UX Nevesht - Farsi UX Writing AI Assistant

A RAG-powered AI assistant for generating Farsi microcopy and UX writing for Snapp's design team.

## Features

- 📝 Generate contextual Farsi microcopy using uploaded guideline documents
- 🔄 RAG (Retrieval Augmented Generation) with vector similarity search
- 📱 RTL Farsi support with proper typography
- 🗂️ Document management (upload, list, delete markdown files)
- 💬 Chat interface for interactive copy generation
- 🎯 Multiple copy variations for each request
- 💰 Cost-optimized with GPT-4o-mini and smart token usage

## Tech Stack

- **Monorepo**: Turborepo
- **Frontend**: React with Next.js, RTL support
- **Backend**: Node.js with Express
- **Database**: Supabase with PostgreSQL + pgvector
- **AI**: OpenRouter (GPT-4o-mini) + OpenAI embeddings
- **Storage**: Supabase Storage

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Start development: `npm run dev`

## Architecture

```
uxNevesht/
├── apps/
│   ├── web/          # React frontend
│   └── api/          # Node.js backend
└── packages/
    ├── ui/           # Shared UI components
    ├── database/     # Database schemas and utilities
    ├── ai/           # AI and embedding utilities
    └── config/       # Shared configurations
```

## Development

- `npm run dev` - Start all apps in development mode
- `npm run build` - Build all apps
- `npm run lint` - Run linting
- `npm run type-check` - Run TypeScript checks

## Environment Setup

Create `.env.local` files in both `apps/web` and `apps/api` with the required environment variables. See the respective `.env.example` files for details.

## Contributing

This project is designed for Snapp's UX writing team. Please follow the established patterns and maintain RTL Farsi support throughout. # uxNevesht

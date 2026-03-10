# CredX AI — Autonomous Credit Intelligence Platform

## Project Overview

An AI-powered autonomous credit intelligence system designed for corporate lending with explainable ML, research agents, and real-time risk analytics.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or bun package manager

### Installation and Development

Follow these steps to set up the project locally:

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd CredX-ai-platform

# Step 3: Install dependencies
npm i
# or using bun
bun install

# Step 4: Start the development server
npm run dev
# or using bun
bun run dev
```

The development server will automatically reload on code changes, providing instant preview at `http://localhost:5173`.

## Project Structure

```
src/
├── components/        # Reusable UI components
├── pages/            # Page components for different routes
├── hooks/            # Custom React hooks
├── lib/              # Utility functions
└── test/             # Test files
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## Technologies Used

This project is built with:

- **Vite** - Fast build tool and dev server
- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **shadcn-ui** - High-quality UI component library
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **React Query** - Data fetching and caching
- **Framer Motion** - Animation library

## Features

- Dashboard with real-time analytics
- Document analyzer for financial documents
- Corporate research capabilities
- Credit risk assessment
- CAM (Corrected Cash Adjustment Model) generation
- AI Copilot for intelligent assistance

## Deployment

To build for production:

```sh
npm run build
```

The optimized build will be created in the `dist` directory.


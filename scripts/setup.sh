#!/usr/bin/env bash
set -euo pipefail

echo "═══════════════════════════════════════════"
echo "  CodePad - Local Development Setup"
echo "═══════════════════════════════════════════"

# Check prerequisites
check_command() {
  if ! command -v "$1" &>/dev/null; then
    echo "ERROR: $1 is required but not installed."
    exit 1
  fi
  echo "  ✓ $1 found"
}

echo ""
echo "Checking prerequisites..."
check_command node
check_command npm
check_command docker
check_command go

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "ERROR: Node.js 20+ required (found v$NODE_VERSION)"
  exit 1
fi

# Copy env file
if [ ! -f .env ]; then
  echo ""
  echo "Creating .env from .env.example..."
  cp .env.example .env
  echo "  ✓ .env created (update with your values)"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Build shared packages
echo ""
echo "Building shared packages..."
npm run build --workspace=@codepad/shared
npm run build --workspace=@codepad/database

# Start infrastructure
echo ""
echo "Starting PostgreSQL and Redis..."
docker compose -f infra/docker/docker-compose.yml up -d postgres redis

# Wait for services
echo "Waiting for services to be ready..."
sleep 3

echo ""
echo "═══════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Start development:"
echo "    npm run dev          # All services"
echo "    npm run docker:up    # Full Docker stack"
echo ""
echo "  Services:"
echo "    Frontend:      http://localhost:3000"
echo "    API:           http://localhost:8080"
echo "    Exec Engine:   http://localhost:8081"
echo "    Collaboration: ws://localhost:8082"
echo "    PostgreSQL:    localhost:5432"
echo "    Redis:         localhost:6379"
echo "═══════════════════════════════════════════"

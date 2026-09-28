#!/bin/bash
set -e

echo "=========================================="
echo "  Deploying InfraOps360 on Hostinger VPS  "
echo "=========================================="

# 1. Check & Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing Docker Engine..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm -f get-docker.sh
fi

# 2. Check & Install Docker Compose Plugin if needed
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose Plugin..."
    apt-get update && apt-get install -y docker-compose-plugin
fi

# 3. Create .env from template if missing
if [ ! -f .env ]; then
    echo "Copying .env.production.example to .env..."
    cp .env.production.example .env
fi

# 4. Pull, build, and bring up containers
echo "Stopping old containers (if any)..."
docker compose -f docker-compose.prod.yml down --remove-orphans || true

echo "Building production images..."
docker compose -f docker-compose.prod.yml build

echo "Starting services in detached mode..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "=========================================="
echo "  InfraOps360 Services are now RUNNING!   "
echo "=========================================="
docker compose -f docker-compose.prod.yml ps

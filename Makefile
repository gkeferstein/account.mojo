.PHONY: help dev prod down logs migrate seed studio clean install build test

# Default target
help:
	@echo "accounts.mojo - MOJO Customer Account Portal"
	@echo ""
	@echo "Usage:"
	@echo "  make install     Install all dependencies"
	@echo "  make dev         Start development environment"
	@echo "  make prod        Start production environment"
	@echo "  make down        Stop all services"
	@echo "  make logs        Show container logs"
	@echo "  make migrate     Run database migrations"
	@echo "  make seed        Seed database with demo data"
	@echo "  make studio      Open Prisma Studio"
	@echo "  make build       Build all packages"
	@echo "  make test        Run tests"
	@echo "  make clean       Clean up containers and volumes"
	@echo ""

# Install dependencies
install:
	npm install
	cd apps/api && npm install
	cd apps/web && npm install
	cd packages/shared && npm install

# Build all packages
build:
	npm run build:shared
	npm run build:api
	npm run build:web

# Development
dev:
	docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up --build

dev-detached:
	docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up --build -d

# Production
prod:
	docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up --build -d

# Stop services
down:
	docker compose -f infra/docker-compose.yml down

# Logs
logs:
	docker compose -f infra/docker-compose.yml logs -f

logs-api:
	docker logs -f accounts-api

logs-web:
	docker logs -f accounts-web

# Database operations
migrate:
	docker exec accounts-api npx prisma migrate deploy

migrate-dev:
	cd apps/api && npx prisma migrate dev

seed:
	docker exec accounts-api npx tsx prisma/seed.ts

studio:
	cd apps/api && npx prisma studio

# Generate Prisma client
generate:
	cd apps/api && npx prisma generate

# Tests
test:
	npm run test

# Clean up
clean:
	docker compose -f infra/docker-compose.yml down -v
	rm -rf apps/api/node_modules apps/api/dist
	rm -rf apps/web/node_modules apps/web/.next
	rm -rf packages/shared/node_modules packages/shared/dist
	rm -rf node_modules

# Network setup (run once)
network:
	docker network create mojo-accounts-network || true

# Connect Traefik to network
traefik-connect:
	docker network connect mojo-accounts-network mojo-traefik || true



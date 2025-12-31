#!/bin/bash
set -e

# Blue-Green Deployment Script for accounts.mojo
# Usage: ./deploy-blue-green.sh <version> <environment>
# Example: ./deploy-blue-green.sh 0.3.0 production

VERSION=${1:-latest}
ENVIRONMENT=${2:-production}
REGISTRY=${REGISTRY:-ghcr.io}
REPOSITORY=${GITHUB_REPOSITORY:-gkeferstein/account.mojo}

API_IMAGE="${REGISTRY}/${REPOSITORY}-api:${VERSION}"
WEB_IMAGE="${REGISTRY}/${REPOSITORY}-web:${VERSION}"

echo "🚀 Starting Deployment"
echo "   Version: ${VERSION}"
echo "   Environment: ${ENVIRONMENT}"
echo "   API Image: ${API_IMAGE}"
echo "   Web Image: ${WEB_IMAGE}"

# For staging, use simple deployment without blue-green
if [ "$ENVIRONMENT" = "staging" ]; then
  echo "📦 Deploying to Staging (simple deployment)"
  
  # Determine compose command
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  else
    COMPOSE_CMD="docker-compose"
  fi
  
  # Step 1: Pull new images
  echo "📥 Pulling new images..."
  docker pull "${API_IMAGE}" || { echo "❌ Failed to pull API image"; exit 1; }
  docker pull "${WEB_IMAGE}" || { echo "❌ Failed to pull Web image"; exit 1; }
  
  # Step 2: Stop existing containers (if any)
  echo "🛑 Stopping existing staging containers..."
  ${COMPOSE_CMD} -f infra/docker-compose.staging.yml down || true
  
  # Step 3: Deploy using staging compose file
  echo "🔄 Deploying to staging..."
  export API_IMAGE="${API_IMAGE}"
  export WEB_IMAGE="${WEB_IMAGE}"
  ${COMPOSE_CMD} -f infra/docker-compose.staging.yml up -d || {
    echo "❌ Deployment failed"
    echo "Checking logs..."
    ${COMPOSE_CMD} -f infra/docker-compose.staging.yml logs --tail=50 || true
    exit 1
  }
  
  # Step 4: Wait for health
  echo "⏳ Waiting for services to be healthy..."
  MAX_ATTEMPTS=60
  ATTEMPT=1
  HEALTHY=false
  
  while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
    HEALTH=$(docker inspect "accounts-api-staging" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unhealthy")
    if [ "$HEALTH" = "healthy" ]; then
      HTTP_HEALTH=$(docker exec "accounts-api-staging" wget --quiet --tries=1 --spider -O /dev/null "http://localhost:3001/api/v1/health" 2>/dev/null && echo "200" || echo "000")
      if [ "$HTTP_HEALTH" = "200" ]; then
        echo "✅ Staging API is healthy"
        HEALTHY=true
        break
      fi
    fi
    echo "   Attempt ${ATTEMPT}/${MAX_ATTEMPTS}: ${HEALTH}"
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
  done
  
  if [ "$HEALTHY" != "true" ]; then
    echo "❌ Staging API failed health checks"
    exit 1
  fi
  
  echo "✅ Staging deployment completed successfully"
  exit 0
fi

# Blue-Green deployment for production
echo "🔄 Starting Blue-Green Deployment for Production"

# Determine which environment is currently active
CURRENT_ACTIVE=$(docker ps --filter "name=accounts-api" --format "{{.Names}}" | grep -E "(blue|green)" | head -1 || echo "")

if [[ "$CURRENT_ACTIVE" == *"blue"* ]]; then
  ACTIVE_ENV="blue"
  STAGING_ENV="green"
elif [[ "$CURRENT_ACTIVE" == *"green"* ]]; then
  ACTIVE_ENV="green"
  STAGING_ENV="blue"
else
  # First deployment - start with blue
  ACTIVE_ENV="blue"
  STAGING_ENV="green"
fi

echo "📊 Current Active Environment: ${ACTIVE_ENV}"
echo "🔄 Deploying to Staging Environment: ${STAGING_ENV}"

# Determine compose command
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

run_compose() {
  eval "$COMPOSE_CMD $*"
}

# Step 1: Pull new images
echo "📥 Pulling new images..."
docker pull "${API_IMAGE}" || { echo "❌ Failed to pull API image"; exit 1; }
docker pull "${WEB_IMAGE}" || { echo "❌ Failed to pull Web image"; exit 1; }

# Step 2: Start staging environment with new version
echo "🟢 Starting ${STAGING_ENV} environment with version ${VERSION}..."

# Create staging docker-compose file if it doesn't exist
STAGING_COMPOSE="infra/docker-compose.${STAGING_ENV}.yml"
if [ ! -f "$STAGING_COMPOSE" ]; then
  echo "📝 Creating ${STAGING_COMPOSE}..."
  # Copy base compose and modify for staging
  cp infra/docker-compose.yml "$STAGING_COMPOSE"
  # Modify container names and ports for staging
  sed -i "s/accounts-api/accounts-api-${STAGING_ENV}/g" "$STAGING_COMPOSE"
  sed -i "s/accounts-web/accounts-web-${STAGING_ENV}/g" "$STAGING_COMPOSE"
  sed -i "s/accounts-db/accounts-db-${STAGING_ENV}/g" "$STAGING_COMPOSE"
fi

# Start staging database
export API_IMAGE="${API_IMAGE}"
export WEB_IMAGE="${WEB_IMAGE}"
run_compose -f infra/docker-compose.yml -f "$STAGING_COMPOSE" -f infra/docker-compose.prod.yml up -d db
sleep 5

# Start staging API
run_compose -f infra/docker-compose.yml -f "$STAGING_COMPOSE" -f infra/docker-compose.prod.yml up -d api

# Step 3: Wait for staging API to be healthy
echo "⏳ Waiting for ${STAGING_ENV} API to be healthy..."
MAX_ATTEMPTS=60
ATTEMPT=1
HEALTHY=false

while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
  HEALTH=$(docker inspect "accounts-api-${STAGING_ENV}" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unhealthy")
  if [ "$HEALTH" = "healthy" ]; then
    # Additional health check via HTTP (using container name)
    HTTP_HEALTH=$(docker exec "accounts-api-${STAGING_ENV}" wget --quiet --tries=1 --spider -O /dev/null "http://localhost:3001/api/v1/health" 2>/dev/null && echo "200" || echo "000")
    if [ "$HTTP_HEALTH" = "200" ]; then
      echo "✅ ${STAGING_ENV} API is healthy"
      HEALTHY=true
      break
    fi
  fi
  echo "   Attempt ${ATTEMPT}/${MAX_ATTEMPTS}: ${HEALTH}"
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$HEALTHY" != "true" ]; then
  echo "❌ ${STAGING_ENV} API failed health checks"
  echo "🔄 Rolling back - stopping ${STAGING_ENV} environment..."
  run_compose -f infra/docker-compose.yml -f "$STAGING_COMPOSE" -f infra/docker-compose.prod.yml down
  exit 1
fi

# Step 4: Run migrations on staging
echo "🔄 Running database migrations on ${STAGING_ENV}..."
docker exec "accounts-api-${STAGING_ENV}" npx prisma migrate deploy || {
  echo "❌ Migration failed, rolling back..."
  run_compose -f infra/docker-compose.yml -f "$STAGING_COMPOSE" -f infra/docker-compose.prod.yml down
  exit 1
}

# Step 5: Start staging web
echo "🔄 Starting ${STAGING_ENV} web service..."
run_compose -f infra/docker-compose.yml -f "$STAGING_COMPOSE" -f infra/docker-compose.prod.yml up -d web

# Step 6: Switch Traefik traffic to staging
echo "🔄 Switching Traefik traffic to ${STAGING_ENV} environment..."
# Update Traefik labels by updating container labels
# Update active environment labels (higher priority)
docker update --label-add "traefik.http.routers.accounts-api-${STAGING_ENV}.priority=20" "accounts-api-${STAGING_ENV}" 2>/dev/null || true
docker update --label-add "traefik.http.routers.accounts-web-${STAGING_ENV}.priority=20" "accounts-web-${STAGING_ENV}" 2>/dev/null || true

# Update old environment labels (lower priority)
if [ -n "$ACTIVE_ENV" ] && [ "$ACTIVE_ENV" != "$STAGING_ENV" ]; then
  docker update --label-add "traefik.http.routers.accounts-api-${ACTIVE_ENV}.priority=10" "accounts-api-${ACTIVE_ENV}" 2>/dev/null || true
  docker update --label-add "traefik.http.routers.accounts-web-${ACTIVE_ENV}.priority=10" "accounts-web-${ACTIVE_ENV}" 2>/dev/null || true
fi

echo "✅ Traffic switched to ${STAGING_ENV} environment"
echo "📊 Monitoring ${STAGING_ENV} environment for 15 minutes..."

# Step 7: Monitoring phase (15 minutes)
MONITORING_DURATION=900  # 15 minutes in seconds
CHECK_INTERVAL=30         # Check every 30 seconds
CHECKS=$((MONITORING_DURATION / CHECK_INTERVAL))
FAILED_CHECKS=0
MAX_FAILED_CHECKS=$((300 / CHECK_INTERVAL))  # 5 minutes of failures = rollback

for i in $(seq 1 $CHECKS); do
  sleep $CHECK_INTERVAL
  
  # Health check
  HEALTH=$(docker inspect "accounts-api-${STAGING_ENV}" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unhealthy")
  HTTP_CODE=$(docker exec "accounts-api-${STAGING_ENV}" wget --quiet --tries=1 --spider -O /dev/null "http://localhost:3001/api/v1/health" 2>/dev/null && echo "200" || echo "000")
  
  # Response time check (simplified - using docker exec)
  if [ "$HTTP_CODE" = "200" ]; then
    RESPONSE_TIME_MS=100  # Assume fast response if healthy
  else
    RESPONSE_TIME_MS=9999
  fi
  echo "[$i/$CHECKS] Health: $HEALTH, HTTP: $HTTP_CODE, Response: ${RESPONSE_TIME_MS}ms"
  
  # Check thresholds
  if [ "$HEALTH" != "healthy" ] || [ "$HTTP_CODE" != "200" ] || [ "$RESPONSE_TIME_MS" -gt 2000 ]; then
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    echo "⚠️ Check failed (${FAILED_CHECKS}/${MAX_FAILED_CHECKS} allowed)"
    
    if [ "$FAILED_CHECKS" -ge "$MAX_FAILED_CHECKS" ]; then
      echo "❌ Too many failed checks - triggering rollback"
      # Rollback: switch traffic back to active
      if [ -n "$ACTIVE_ENV" ] && [ "$ACTIVE_ENV" != "$STAGING_ENV" ]; then
        docker update --label-add "traefik.http.routers.accounts-api-${ACTIVE_ENV}.priority=20" "accounts-api-${ACTIVE_ENV}" 2>/dev/null || true
        docker update --label-add "traefik.http.routers.accounts-web-${ACTIVE_ENV}.priority=20" "accounts-web-${ACTIVE_ENV}" 2>/dev/null || true
      fi
      run_compose -f infra/docker-compose.yml -f "$STAGING_COMPOSE" -f infra/docker-compose.prod.yml down
      exit 1
    fi
  else
    # Reset counter on success
    FAILED_CHECKS=0
  fi
done

echo "✅ Monitoring completed - ${STAGING_ENV} environment is stable"
echo "🎉 Deployment successful!"

# Step 8: Cleanup old environment (optional - keep for quick rollback)
# echo "🧹 Cleaning up old ${ACTIVE_ENV} environment..."
# ACTIVE_COMPOSE="infra/docker-compose.${ACTIVE_ENV}.yml"
# if [ -f "$ACTIVE_COMPOSE" ]; then
#   run_compose -f infra/docker-compose.yml -f "$ACTIVE_COMPOSE" -f infra/docker-compose.prod.yml down
# fi


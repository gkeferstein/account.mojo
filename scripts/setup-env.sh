#!/bin/bash
# =============================================================================
# Setup Environment Variables for account.mojo
# =============================================================================
# Dieses Script sorgt dafür, dass alle .env-Dateien korrekt konfiguriert sind.
# 
# Verwendung:
#   ./scripts/setup-env.sh
#
# Das Script:
# 1. Prüft ob .env existiert, sonst kopiert es env.example
# 2. Synchronisiert Clerk-Keys zwischen .env und .env.local
# 3. Validiert alle erforderlichen Umgebungsvariablen
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_ENV="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/env.example"
WEB_ENV_LOCAL="$PROJECT_ROOT/apps/web/.env.local"
API_ENV="$PROJECT_ROOT/apps/api/.env"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 account.mojo - Environment Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Create .env from env.example if it doesn't exist
if [ ! -f "$ROOT_ENV" ]; then
    echo -e "${YELLOW}⚠️  Root .env nicht gefunden. Kopiere von env.example...${NC}"
    cp "$ENV_EXAMPLE" "$ROOT_ENV"
    echo -e "${GREEN}✓ .env erstellt${NC}"
fi

# Step 2: Check if web/.env.local exists and has real Clerk keys
if [ -f "$WEB_ENV_LOCAL" ]; then
    WEB_CLERK_SECRET=$(grep "^CLERK_SECRET_KEY=" "$WEB_ENV_LOCAL" 2>/dev/null | cut -d'=' -f2)
    WEB_CLERK_PUB=$(grep "^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=" "$WEB_ENV_LOCAL" 2>/dev/null | cut -d'=' -f2)
    
    if [ -n "$WEB_CLERK_SECRET" ] && [ "$WEB_CLERK_SECRET" != "sk_test_xxxx" ]; then
        echo "📋 Clerk-Keys gefunden in apps/web/.env.local"
        
        # Check if root .env has placeholder values
        ROOT_CLERK_SECRET=$(grep "^CLERK_SECRET_KEY=" "$ROOT_ENV" 2>/dev/null | cut -d'=' -f2)
        
        if [ "$ROOT_CLERK_SECRET" = "sk_test_xxxx" ] || [ -z "$ROOT_CLERK_SECRET" ]; then
            echo -e "${YELLOW}⚠️  Root .env hat Platzhalter-Werte. Synchronisiere...${NC}"
            
            # Update root .env with real keys
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sed -i '' "s|^CLERK_SECRET_KEY=.*|CLERK_SECRET_KEY=$WEB_CLERK_SECRET|" "$ROOT_ENV"
                sed -i '' "s|^CLERK_PUBLISHABLE_KEY=.*|CLERK_PUBLISHABLE_KEY=$WEB_CLERK_PUB|" "$ROOT_ENV"
                sed -i '' "s|^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=.*|NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$WEB_CLERK_PUB|" "$ROOT_ENV"
            else
                # Linux
                sed -i "s|^CLERK_SECRET_KEY=.*|CLERK_SECRET_KEY=$WEB_CLERK_SECRET|" "$ROOT_ENV"
                sed -i "s|^CLERK_PUBLISHABLE_KEY=.*|CLERK_PUBLISHABLE_KEY=$WEB_CLERK_PUB|" "$ROOT_ENV"
                sed -i "s|^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=.*|NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$WEB_CLERK_PUB|" "$ROOT_ENV"
            fi
            
            echo -e "${GREEN}✓ Clerk-Keys synchronisiert${NC}"
        else
            echo -e "${GREEN}✓ Root .env hat bereits echte Clerk-Keys${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  apps/web/.env.local nicht gefunden${NC}"
    echo "   Bitte erstelle diese Datei mit deinen Clerk-Keys:"
    echo "   CLERK_SECRET_KEY=sk_test_..."
    echo "   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_..."
fi

# Step 3: Ensure API can read the keys (symlink or copy)
if [ ! -f "$API_ENV" ]; then
    echo "📋 Erstelle apps/api/.env als Symlink zur Root .env..."
    ln -sf "$ROOT_ENV" "$API_ENV" 2>/dev/null || cp "$ROOT_ENV" "$API_ENV"
    echo -e "${GREEN}✓ apps/api/.env erstellt${NC}"
fi

# Step 4: Validate required environment variables
echo ""
echo "🔍 Validiere Umgebungsvariablen..."

REQUIRED_VARS=(
    "DATABASE_URL"
    "CLERK_SECRET_KEY"
    "CLERK_PUBLISHABLE_KEY"
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
)

MISSING_VARS=()
PLACEHOLDER_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    value=$(grep "^$var=" "$ROOT_ENV" 2>/dev/null | cut -d'=' -f2)
    
    if [ -z "$value" ]; then
        MISSING_VARS+=("$var")
    elif [[ "$value" == *"xxxx"* ]] || [[ "$value" == *"your_"* ]]; then
        PLACEHOLDER_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Fehlende Variablen:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
fi

if [ ${#PLACEHOLDER_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Variablen mit Platzhalter-Werten:${NC}"
    for var in "${PLACEHOLDER_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "   Bitte ersetze diese Werte in .env mit echten Keys!"
fi

if [ ${#MISSING_VARS[@]} -eq 0 ] && [ ${#PLACEHOLDER_VARS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ Alle erforderlichen Variablen sind gesetzt${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Environment Setup abgeschlossen${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"


#!/bin/bash

echo "🎨 Background System Health Check"
echo "================================="

# Check if Next.js is running
if curl -s -f -o /dev/null http://localhost:3000; then
    echo "✅ Next.js is running on http://localhost:3000"
else
    echo "❌ Next.js is not running"
fi

# Check if Strapi is running  
if curl -s -f -o /dev/null http://localhost:1337; then
    echo "✅ Strapi is running on http://localhost:1337"
else
    echo "❌ Strapi is not running"
fi

# Check if demo page is accessible
if curl -s -f -o /dev/null http://localhost:3000/demo/backgrounds; then
    echo "✅ Demo page is accessible at http://localhost:3000/demo/backgrounds"
else
    echo "❌ Demo page is not accessible"
fi

# Check background component files
echo ""
echo "📁 Checking Background System Files:"
echo "=================================="

FILES=(
    "launchpad/next/components/backgrounds/DynamicBackground.tsx"
    "launchpad/next/components/backgrounds/BackgroundPreview.tsx"
    "launchpad/next/components/ui/ThemeToggle.tsx"
    "launchpad/next/context/ThemeContext.tsx"
    "launchpad/next/lib/backgrounds/utils.ts"
    "launchpad/strapi/src/components/background/settings.json"
    "launchpad/strapi/src/api/page/content-types/page/schema.json"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (missing)"
    fi
done

echo ""
echo "🔗 Quick Links:"
echo "==============="
echo "Demo Page: http://localhost:3000/demo/backgrounds"
echo "Strapi Admin: http://localhost:1337/admin"
echo "Strapi Pages: http://localhost:1337/admin/content-manager/collection-types/api::page.page"
echo ""
echo "💡 To fix permissions:"
echo "1. Go to Strapi Admin → Settings → Roles & Permissions → Public"
echo "2. Expand 'Page' section and check 'find' and 'findOne'"
echo "3. Save changes"

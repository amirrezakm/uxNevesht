#!/bin/bash

echo "🚀 Setting up UX Nevesht Environment Files"

# Create API .env file
cat > apps/api/.env << 'EOF'
# تنظیمات دیتابیس Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# سرویس‌های هوش مصنوعی
OPENAI_API_KEY=your_openai_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# تنظیمات سرور
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
EOF

# Create Web .env.local file
cat > apps/web/.env.local << 'EOF'
# تنظیمات API
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF

echo "✅ Environment files created!"
echo ""
echo "📝 Please edit the following files and add your actual API keys:"
echo "   - apps/api/.env"
echo "   - apps/web/.env.local"
echo ""
echo "🔑 You need:"
echo "   1. Supabase Project URL and Keys"
echo "   2. OpenAI API Key"
echo "   3. OpenRouter API Key"
echo ""
echo "🔗 Get your keys from:"
echo "   - Supabase: https://supabase.com/dashboard"
echo "   - OpenAI: https://platform.openai.com/api-keys"
echo "   - OpenRouter: https://openrouter.ai/keys"

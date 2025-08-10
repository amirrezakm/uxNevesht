#!/usr/bin/env ts-node

import { validateEnvironment, validateApiKeys } from '../utils/validation';
import { supabase } from '@ux-nevesht/database';
import { EmbeddingsService, LLMService } from '@ux-nevesht/ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

async function performStartupChecks(): Promise<void> {
  console.log('🔍 UX Nevesht Startup Checks');
  console.log('=============================\n');

  const results: CheckResult[] = [];

  // 1. Environment Variables
  console.log('1️⃣ Checking Environment Variables...');
  try {
    validateEnvironment();
    validateApiKeys();
    results.push({
      name: 'Environment',
      status: 'pass',
      message: 'All environment variables are valid'
    });
    console.log('   ✅ Environment variables OK\n');
  } catch (error) {
    results.push({
      name: 'Environment',
      status: 'fail',
      message: 'Environment validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('   ❌ Environment validation failed\n');
  }

  // 2. Supabase Connection
  console.log('2️⃣ Testing Supabase Connection...');
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);

    if (error) {
      throw error;
    }

    results.push({
      name: 'Supabase',
      status: 'pass',
      message: 'Successfully connected to Supabase'
    });
    console.log('   ✅ Supabase connection OK\n');
  } catch (error) {
    results.push({
      name: 'Supabase',
      status: 'fail',
      message: 'Failed to connect to Supabase',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('   ❌ Supabase connection failed\n');
  }

  // 3. Database Schema
  console.log('3️⃣ Checking Database Schema...');
  try {
    const requiredTables = ['documents', 'document_chunks', 'chat_sessions'];
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', requiredTables);

    if (error) {
      throw error;
    }

    const foundTables = tables?.map(t => t.table_name) || [];
    const missingTables = requiredTables.filter(table => !foundTables.includes(table));

    if (missingTables.length === 0) {
      results.push({
        name: 'Database Schema',
        status: 'pass',
        message: 'All required tables exist'
      });
      console.log('   ✅ Database schema OK\n');
    } else {
      results.push({
        name: 'Database Schema',
        status: 'fail',
        message: `Missing tables: ${missingTables.join(', ')}`,
        details: 'Run database setup script'
      });
      console.log(`   ❌ Missing tables: ${missingTables.join(', ')}\n`);
    }
  } catch (error) {
    results.push({
      name: 'Database Schema',
      status: 'fail',
      message: 'Failed to check database schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('   ❌ Database schema check failed\n');
  }

  // 4. pgvector Extension
  console.log('4️⃣ Checking pgvector Extension...');
  try {
    const { data, error } = await supabase
      .from('pg_extension')
      .select('extname')
      .eq('extname', 'vector');

    if (error) {
      results.push({
        name: 'pgvector',
        status: 'warn',
        message: 'Could not verify pgvector extension',
        details: 'This might be normal depending on Supabase permissions'
      });
      console.log('   ⚠️  Could not verify pgvector (this might be normal)\n');
    } else if (data && data.length > 0) {
      results.push({
        name: 'pgvector',
        status: 'pass',
        message: 'pgvector extension is enabled'
      });
      console.log('   ✅ pgvector extension OK\n');
    } else {
      results.push({
        name: 'pgvector',
        status: 'fail',
        message: 'pgvector extension not found',
        details: 'Enable pgvector in Supabase dashboard'
      });
      console.log('   ❌ pgvector extension not found\n');
    }
  } catch (error) {
    results.push({
      name: 'pgvector',
      status: 'warn',
      message: 'Could not check pgvector',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('   ⚠️  pgvector check failed\n');
  }

  // 5. Storage Bucket
  console.log('5️⃣ Checking Storage Bucket...');
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      results.push({
        name: 'Storage',
        status: 'warn',
        message: 'Could not list storage buckets',
        details: error.message
      });
      console.log('   ⚠️  Could not check storage buckets\n');
    } else {
      const hasDocuments = buckets?.some((b: any) => b.name === 'documents');
      
      if (hasDocuments) {
        results.push({
          name: 'Storage',
          status: 'pass',
          message: 'Documents storage bucket exists'
        });
        console.log('   ✅ Storage bucket OK\n');
      } else {
        results.push({
          name: 'Storage',
          status: 'fail',
          message: 'Documents storage bucket not found',
          details: 'Create "documents" bucket in Supabase dashboard'
        });
        console.log('   ❌ Documents bucket not found\n');
      }
    }
  } catch (error) {
    results.push({
      name: 'Storage',
      status: 'warn',
      message: 'Storage check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log('   ⚠️  Storage check failed\n');
  }

  // 6. OpenAI Embeddings (if API key available)
  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your_')) {
    console.log('6️⃣ Testing OpenAI Embeddings...');
    try {
      const embeddings = new EmbeddingsService(process.env.OPENAI_API_KEY);
      const result = await embeddings.generateEmbedding('تست ساده برای تولید embedding برای بررسی سیستم');
      
      if (result && result.length === 1536) {
        results.push({
          name: 'OpenAI Embeddings',
          status: 'pass',
          message: 'OpenAI embeddings working'
        });
        console.log('   ✅ OpenAI embeddings OK\n');
      } else {
        results.push({
          name: 'OpenAI Embeddings',
          status: 'fail',
          message: 'Invalid embedding response'
        });
        console.log('   ❌ Invalid embedding response\n');
      }
    } catch (error) {
      results.push({
        name: 'OpenAI Embeddings',
        status: 'fail',
        message: 'OpenAI embeddings failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log('   ❌ OpenAI embeddings failed\n');
    }
  } else {
    console.log('6️⃣ Skipping OpenAI test (API key not configured)\n');
  }

  // 7. OpenRouter LLM (if API key available)
  if (process.env.OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY.includes('your_')) {
    console.log('7️⃣ Testing OpenRouter LLM...');
    try {
      const llm = new LLMService(process.env.OPENROUTER_API_KEY);
      const response = await llm.generateResponse([
        { role: 'user', content: 'Hi' }
      ], { maxTokens: 5 });
      
      if (response && response.length > 0) {
        results.push({
          name: 'OpenRouter LLM',
          status: 'pass',
          message: 'OpenRouter LLM working'
        });
        console.log('   ✅ OpenRouter LLM OK\n');
      } else {
        results.push({
          name: 'OpenRouter LLM',
          status: 'fail',
          message: 'Empty LLM response'
        });
        console.log('   ❌ Empty LLM response\n');
      }
    } catch (error) {
      results.push({
        name: 'OpenRouter LLM',
        status: 'fail',
        message: 'OpenRouter LLM failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log('   ❌ OpenRouter LLM failed\n');
    }
  } else {
    console.log('7️⃣ Skipping OpenRouter test (API key not configured)\n');
  }

  // Summary
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;

  console.log('📊 Startup Check Summary');
  console.log('========================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warned}`);
  console.log(`📈 Success Rate: ${Math.round((passed / results.length) * 100)}%\n`);

  if (failed === 0) {
    console.log('🎉 All critical checks passed! Your system is ready to start.');
  } else if (failed <= 2) {
    console.log('⚠️  Some checks failed, but the system might still work.');
    console.log('   Please review the failed checks and fix them if possible.');
  } else {
    console.log('❌ Multiple critical checks failed. Please fix these issues before starting.');
    console.log('\n🔧 Common Solutions:');
    console.log('   1. Check your .env file and ensure all API keys are correct');
    console.log('   2. Run the database setup script: npm run setup-db');
    console.log('   3. Enable pgvector extension in Supabase dashboard');
    console.log('   4. Create "documents" storage bucket in Supabase');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  performStartupChecks().catch(console.error);
}

export { performStartupChecks };

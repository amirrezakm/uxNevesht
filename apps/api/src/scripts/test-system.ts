#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { supabase } from '@ux-nevesht/database';
import { EmbeddingsService, LLMService } from '@ux-nevesht/ai';
import { DocumentProcessor } from '../services/documentProcessor';
import { RAGService } from '../services/ragService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

async function runTests(): Promise<void> {
  const results: TestResult[] = [];
  
  console.log('🧪 UX Nevesht System Tests');
  console.log('============================\n');

  // Test 1: Environment Variables
  console.log('1️⃣ Testing Environment Variables...');
  const envResult = testEnvironmentVariables();
  results.push(envResult);
  console.log(`   ${envResult.status === 'pass' ? '✅' : '❌'} ${envResult.message}\n`);

  // Test 2: Supabase Connection
  console.log('2️⃣ Testing Supabase Connection...');
  const supabaseResult = await testSupabaseConnection();
  results.push(supabaseResult);
  console.log(`   ${supabaseResult.status === 'pass' ? '✅' : '❌'} ${supabaseResult.message}\n`);

  // Test 3: Database Schema
  console.log('3️⃣ Testing Database Schema...');
  const schemaResult = await testDatabaseSchema();
  results.push(schemaResult);
  console.log(`   ${schemaResult.status === 'pass' ? '✅' : '❌'} ${schemaResult.message}\n`);

  // Test 4: OpenAI Embeddings
  console.log('4️⃣ Testing OpenAI Embeddings...');
  const embeddingsResult = await testEmbeddings();
  results.push(embeddingsResult);
  console.log(`   ${embeddingsResult.status === 'pass' ? '✅' : '❌'} ${embeddingsResult.message}\n`);

  // Test 5: OpenRouter LLM
  console.log('5️⃣ Testing OpenRouter LLM...');
  const llmResult = await testLLM();
  results.push(llmResult);
  console.log(`   ${llmResult.status === 'pass' ? '✅' : '❌'} ${llmResult.message}\n`);

  // Test 6: Document Processing
  console.log('6️⃣ Testing Document Processing...');
  const docResult = await testDocumentProcessing();
  results.push(docResult);
  console.log(`   ${docResult.status === 'pass' ? '✅' : '❌'} ${docResult.message}\n`);

  // Test 7: RAG System
  console.log('7️⃣ Testing RAG System...');
  const ragResult = await testRAGSystem();
  results.push(ragResult);
  console.log(`   ${ragResult.status === 'pass' ? '✅' : '❌'} ${ragResult.message}\n`);

  // Summary
  console.log('📊 Test Summary');
  console.log('================');
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warned}`);
  console.log(`📈 Success Rate: ${Math.round((passed / results.length) * 100)}%\n`);

  if (failed > 0) {
    console.log('❌ Failed Tests:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`   - ${r.name}: ${r.message}`);
      if (r.details) console.log(`     ${r.details}`);
    });
    console.log('');
  }

  if (warned > 0) {
    console.log('⚠️  Warnings:');
    results.filter(r => r.status === 'warn').forEach(r => {
      console.log(`   - ${r.name}: ${r.message}`);
      if (r.details) console.log(`     ${r.details}`);
    });
    console.log('');
  }

  console.log('🔧 Recommendations:');
  if (failed > 0 || warned > 0) {
    console.log('   1. Check your .env files and ensure all API keys are correct');
    console.log('   2. Make sure your Supabase project is active and has pgvector enabled');
    console.log('   3. Verify your OpenAI and OpenRouter API keys have sufficient credits');
    console.log('   4. Run the database setup script: npm run setup-db');
  } else {
    console.log('   🎉 All tests passed! Your system is ready to use.');
  }
}

function testEnvironmentVariables(): TestResult {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'OPENAI_API_KEY',
    'OPENROUTER_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key] || process.env[key]?.includes('your_'));
  
  if (missing.length === 0) {
    return {
      name: 'Environment Variables',
      status: 'pass',
      message: 'All required environment variables are set'
    };
  } else {
    return {
      name: 'Environment Variables',
      status: 'fail',
      message: `Missing or invalid environment variables: ${missing.join(', ')}`,
      details: 'Please check your .env files and set proper API keys'
    };
  }
}

async function testSupabaseConnection(): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);

    if (error) {
      return {
        name: 'Supabase Connection',
        status: 'fail',
        message: `Connection failed: ${error.message}`,
        details: 'Check your SUPABASE_URL and keys'
      };
    }

    return {
      name: 'Supabase Connection',
      status: 'pass',
      message: 'Successfully connected to Supabase'
    };
  } catch (error) {
    return {
      name: 'Supabase Connection',
      status: 'fail',
      message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: 'Check your internet connection and Supabase credentials'
    };
  }
}

async function testDatabaseSchema(): Promise<TestResult> {
  try {
    const requiredTables = ['documents', 'document_chunks', 'chat_sessions'];
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', requiredTables);

    if (error) {
      return {
        name: 'Database Schema',
        status: 'fail',
        message: `Schema check failed: ${error.message}`,
        details: 'Run: npm run setup-db'
      };
    }

    const foundTables = tables?.map(t => t.table_name) || [];
    const missingTables = requiredTables.filter(table => !foundTables.includes(table));

    if (missingTables.length === 0) {
      return {
        name: 'Database Schema',
        status: 'pass',
        message: 'All required tables exist'
      };
    } else {
      return {
        name: 'Database Schema',
        status: 'fail',
        message: `Missing tables: ${missingTables.join(', ')}`,
        details: 'Run: npm run setup-db'
      };
    }
  } catch (error) {
    return {
      name: 'Database Schema',
      status: 'fail',
      message: `Schema check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: 'Ensure database connection is working first'
    };
  }
}

async function testEmbeddings(): Promise<TestResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.includes('your_')) {
      return {
        name: 'OpenAI Embeddings',
        status: 'fail',
        message: 'OpenAI API key not configured',
        details: 'Set OPENAI_API_KEY in your .env file'
      };
    }

    const embeddings = new EmbeddingsService(apiKey);
    const testText = 'تست ساده برای تولید embedding';
    
    const result = await embeddings.generateEmbedding(testText);
    
    if (result && result.length === 1536) {
      return {
        name: 'OpenAI Embeddings',
        status: 'pass',
        message: 'Successfully generated embedding'
      };
    } else {
      return {
        name: 'OpenAI Embeddings',
        status: 'fail',
        message: 'Invalid embedding response',
        details: `Expected 1536 dimensions, got ${result?.length || 0}`
      };
    }
  } catch (error) {
    return {
      name: 'OpenAI Embeddings',
      status: 'fail',
      message: `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: 'Check your OpenAI API key and credits'
    };
  }
}

async function testLLM(): Promise<TestResult> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey.includes('your_')) {
      return {
        name: 'OpenRouter LLM',
        status: 'fail',
        message: 'OpenRouter API key not configured',
        details: 'Set OPENROUTER_API_KEY in your .env file'
      };
    }

    const llm = new LLMService(apiKey);
    const messages = [
      { role: 'user' as const, content: 'سلام، یک کلمه ساده بگو' }
    ];
    
    const response = await llm.generateResponse(messages, { maxTokens: 10 });
    
    if (response && response.length > 0) {
      return {
        name: 'OpenRouter LLM',
        status: 'pass',
        message: 'Successfully generated LLM response'
      };
    } else {
      return {
        name: 'OpenRouter LLM',
        status: 'fail',
        message: 'Empty LLM response',
        details: 'Check your OpenRouter API key'
      };
    }
  } catch (error) {
    return {
      name: 'OpenRouter LLM',
      status: 'fail',
      message: `LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: 'Check your OpenRouter API key and credits'
    };
  }
}

async function testDocumentProcessing(): Promise<TestResult> {
  try {
    // Create a test document
    const testContent = `# راهنمای تست
    
این یک سند تست برای بررسی سیستم پردازش اسناد است.

## بخش اول
متن تست برای chunk کردن.

## بخش دوم  
متن دیگری برای تست vectorization.`;

    const testDoc = {
      id: 'test-doc-' + Date.now(),
      title: 'تست سند',
      content: testContent,
      file_path: 'test.md',
      file_size: testContent.length,
      processed: false,
      created_at: new Date().toISOString(),
    };

    // Insert test document
    const { error: insertError } = await supabase
      .from('documents')
      .insert(testDoc);

    if (insertError) {
      return {
        name: 'Document Processing',
        status: 'fail',
        message: `Failed to insert test document: ${insertError.message}`,
        details: 'Check database connection and schema'
      };
    }

    // Test document processor
    const processor = new DocumentProcessor();
    await processor.processDocument(testDoc.id);

    // Check if chunks were created
    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('*')
      .eq('document_id', testDoc.id);

    // Clean up
    await supabase.from('document_chunks').delete().eq('document_id', testDoc.id);
    await supabase.from('documents').delete().eq('id', testDoc.id);

    if (chunksError) {
      return {
        name: 'Document Processing',
        status: 'fail',
        message: `Failed to retrieve chunks: ${chunksError.message}`,
        details: 'Check database schema and embeddings service'
      };
    }

    if (chunks && chunks.length > 0) {
      return {
        name: 'Document Processing',
        status: 'pass',
        message: `Successfully processed document and created ${chunks.length} chunks`
      };
    } else {
      return {
        name: 'Document Processing',
        status: 'warn',
        message: 'Document processed but no chunks created',
        details: 'This might indicate an issue with text chunking'
      };
    }
  } catch (error) {
    return {
      name: 'Document Processing',
      status: 'fail',
      message: `Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: 'Check all previous tests first'
    };
  }
}

async function testRAGSystem(): Promise<TestResult> {
  try {
    // This test requires existing documents in the database
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id')
      .eq('processed', true)
      .limit(1);

    if (docsError) {
      return {
        name: 'RAG System',
        status: 'fail',
        message: `Failed to check documents: ${docsError.message}`,
        details: 'Check database connection'
      };
    }

    if (!documents || documents.length === 0) {
      return {
        name: 'RAG System',
        status: 'warn',
        message: 'No processed documents found for RAG testing',
        details: 'Upload and process some documents first'
      };
    }

    const ragService = new RAGService();
    const testQuery = 'تست سیستم RAG';
    
    const result = await ragService.getRelevantContext(testQuery);
    
    if (result && typeof result === 'object') {
      return {
        name: 'RAG System',
        status: 'pass',
        message: `RAG system working - found ${result.chunks?.length || 0} relevant chunks`
      };
    } else {
      return {
        name: 'RAG System',
        status: 'fail',
        message: 'RAG system returned invalid response',
        details: 'Check vector search functionality'
      };
    }
  } catch (error) {
    return {
      name: 'RAG System',
      status: 'fail',
      message: `RAG system failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: 'Check embeddings and vector search setup'
    };
  }
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };

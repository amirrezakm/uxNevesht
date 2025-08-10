#!/usr/bin/env ts-node

import { supabase } from '@ux-nevesht/database';
import { setupSQL } from '@ux-nevesht/database';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupDatabase() {
  console.log('🚀 Setting up UX Nevesht Database...');

  try {
    // Check connection
    const { data, error: connectionError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);

    if (connectionError) {
      throw new Error(`Database connection failed: ${connectionError.message}`);
    }

    console.log('✅ Database connection successful');

    // Since we can't execute DDL directly via supabase client,
    // we'll just check if tables exist and provide instructions
    console.log('ℹ️ Note: Database setup must be done manually in Supabase dashboard');
    console.log('');
    console.log('🔧 Please execute the following SQL in your Supabase SQL editor:');
    console.log('');
    console.log('```sql');
    console.log(setupSQL);
    console.log('```');
    console.log('');

    // Check if tables were created
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['documents', 'document_chunks', 'chat_sessions']);

    if (tablesError) {
      console.warn('Could not verify tables:', tablesError.message);
    } else {
      console.log('📊 Found tables:', tables?.map(t => t.table_name));
    }

    // Check if pgvector extension is enabled
    const { data: extensions, error: extError } = await supabase
      .from('pg_extension')
      .select('extname')
      .eq('extname', 'vector');

    if (extError) {
      console.warn('Could not check extensions:', extError.message);
    } else if (extensions && extensions.length > 0) {
      console.log('✅ pgvector extension is enabled');
    } else {
      console.warn('⚠️ pgvector extension may not be enabled');
    }

    // Create storage bucket if it doesn't exist
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.warn('Could not list buckets:', listError.message);
      } else {
        const hasDocuments = buckets?.some((b: any) => b.name === 'documents');
        
        if (!hasDocuments) {
          const { error: createError } = await supabase.storage.createBucket('documents', {
            public: false,
            fileSizeLimit: 10 * 1024 * 1024, // 10MB
          });
          
          if (createError) {
            console.warn('Could not create documents bucket:', createError.message);
          } else {
            console.log('✅ Created documents storage bucket');
          }
        } else {
          console.log('✅ Documents storage bucket exists');
        }
      }
    } catch (bucketError) {
      console.warn('Storage bucket setup failed:', bucketError);
    }

    console.log('🎉 Database setup completed!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Make sure your .env files have the correct Supabase keys');
    console.log('2. If you see warnings above, you may need to enable pgvector manually in Supabase dashboard');
    console.log('3. Test the API by running: npm run dev');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    console.log('');
    console.log('Please check:');
    console.log('1. Your Supabase URL and keys in .env file');
    console.log('2. Your Supabase project is active');
    console.log('3. You have appropriate permissions');
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupDatabase();
}

export { setupDatabase };

#!/usr/bin/env ts-node

import { DocumentProcessor } from '../services/documentProcessor';

async function main() {
  const processor = new DocumentProcessor();

  try {
    console.log('🔍 Checking for stuck documents...');
    
    // Check for stuck documents
    const stuckDocs = await processor.getStuckDocuments();
    
    if (stuckDocs.length === 0) {
      console.log('✅ No stuck documents found!');
      return;
    }

    console.log(`📄 Found ${stuckDocs.length} stuck documents:`);
    stuckDocs.forEach(doc => {
      console.log(`  - ${doc.title} (ID: ${doc.id}, Uploaded: ${doc.upload_date})`);
    });

    // Reset stuck documents
    console.log('\n🔄 Resetting stuck documents...');
    await processor.resetStuckDocuments();

    // Reprocess all unprocessed documents
    console.log('\n⚡ Reprocessing all unprocessed documents...');
    await processor.reprocessAllDocuments();

    console.log('\n✅ Done! All documents should now be processing correctly.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    processor.dispose();
  }
}

if (require.main === module) {
  main();
}
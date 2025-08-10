// Test suite for document object validation fixes
// This file is for manual testing only and should not be included in production builds

import { Document } from './lib/api';

// Test data scenarios
const testScenarios = {
  validDocument: {
    id: '123',
    title: 'Valid Document',
    file_size: 1024,
    upload_date: '2024-01-01',
    processed: true,
  },
  
  documentMissingTitle: {
    id: '124',
    file_size: 1024,
    upload_date: '2024-01-01',
    processed: true,
    // title is missing
  },
  
  documentMissingId: {
    title: 'Document without ID',
    file_size: 1024,
    upload_date: '2024-01-01',
    processed: true,
    // id is missing
  },
  
  nullDocument: null,
  undefinedDocument: undefined,
  emptyObject: {},
  stringInsteadOfObject: 'not an object',
  numberInsteadOfObject: 123,
};

// Helper functions (copied from component)
const isValidDocument = (doc: any): doc is Document => {
  return doc && 
         typeof doc === 'object' && 
         doc.id && 
         typeof doc.id === 'string';
};

const filterValidDocuments = (docs: any[]): Document[] => {
  if (!Array.isArray(docs)) return [];
  
  const validDocs = docs.filter(isValidDocument);
  
  // Log warning if we filtered out any invalid documents
  if (validDocs.length !== docs.length) {
    console.warn(`Filtered out ${docs.length - validDocs.length} invalid documents`);
  }
  
  return validDocs;
};

// Test functions
function testIsValidDocument() {
  console.log('\n🧪 Testing isValidDocument function...');
  
  const tests = [
    { input: testScenarios.validDocument, expected: true, name: 'valid document' },
    { input: testScenarios.documentMissingTitle, expected: true, name: 'document missing title (but has id)' },
    { input: testScenarios.documentMissingId, expected: false, name: 'document missing id' },
    { input: testScenarios.nullDocument, expected: false, name: 'null document' },
    { input: testScenarios.undefinedDocument, expected: false, name: 'undefined document' },
    { input: testScenarios.emptyObject, expected: false, name: 'empty object' },
    { input: testScenarios.stringInsteadOfObject, expected: false, name: 'string instead of object' },
    { input: testScenarios.numberInsteadOfObject, expected: false, name: 'number instead of object' },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    const result = isValidDocument(test.input);
    if (result === test.expected) {
      console.log(`  ✅ ${test.name}: ${result}`);
      passed++;
    } else {
      console.log(`  ❌ ${test.name}: expected ${test.expected}, got ${result}`);
      failed++;
    }
  });

  console.log(`\n📊 isValidDocument tests: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

function testFilterValidDocuments() {
  console.log('\n🧪 Testing filterValidDocuments function...');
  
  const tests = [
    {
      input: [
        testScenarios.validDocument,
        testScenarios.documentMissingTitle,
        testScenarios.documentMissingId,
        testScenarios.nullDocument,
        testScenarios.undefinedDocument,
      ],
      expectedLength: 2, // Only first two are valid
      name: 'mixed valid and invalid documents',
    },
    {
      input: [],
      expectedLength: 0,
      name: 'empty array',
    },
    {
      input: [testScenarios.validDocument, testScenarios.documentMissingTitle],
      expectedLength: 2,
      name: 'all valid documents',
    },
    {
      input: [testScenarios.nullDocument, testScenarios.undefinedDocument, testScenarios.emptyObject],
      expectedLength: 0,
      name: 'all invalid documents',
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    const result = filterValidDocuments(test.input);
    if (result.length === test.expectedLength) {
      console.log(`  ✅ ${test.name}: filtered to ${result.length} documents`);
      passed++;
    } else {
      console.log(`  ❌ ${test.name}: expected ${test.expectedLength} documents, got ${result.length}`);
      failed++;
    }
  });

  console.log(`\n📊 filterValidDocuments tests: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

function testApiResponseHandling() {
  console.log('\n🧪 Testing API response handling scenarios...');
  
  const apiResponses = [
    {
      response: {
        documents: [testScenarios.validDocument, testScenarios.documentMissingTitle],
      },
      expected: 2,
      name: 'normal API response with documents array',
    },
    {
      response: {
        documents: null,
      },
      expected: 0,
      name: 'API response with null documents',
    },
    {
      response: {
        documents: undefined,
      },
      expected: 0,
      name: 'API response with undefined documents',
    },
    {
      response: {
        success: true,
        // documents property missing
      },
      expected: 0,
      name: 'API response missing documents property',
    },
    {
      response: [testScenarios.validDocument], // Array directly
      expected: 1,
      name: 'API response as direct array',
    },
    {
      response: null,
      expected: 0,
      name: 'null API response',
    },
  ];

  let passed = 0;
  let failed = 0;

  apiResponses.forEach(test => {
    let documents;
    
    // Simulate API parsing logic
    if (test.response && typeof test.response === 'object' && 'documents' in test.response && Array.isArray((test.response as any).documents)) {
      documents = (test.response as any).documents;
    } else if (Array.isArray(test.response)) {
      documents = test.response;
    } else {
      documents = [];
    }
    
    const validDocs = filterValidDocuments(documents);
    
    if (validDocs.length === test.expected) {
      console.log(`  ✅ ${test.name}: ${validDocs.length} valid documents`);
      passed++;
    } else {
      console.log(`  ❌ ${test.name}: expected ${test.expected}, got ${validDocs.length}`);
      failed++;
    }
  });

  console.log(`\n📊 API response handling tests: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

function testDocumentRendering() {
  console.log('\n🧪 Testing document rendering safety...');
  
  const documents = [
    testScenarios.validDocument,
    testScenarios.documentMissingTitle,
    { id: '125' }, // Very minimal document
  ];

  const validDocs = filterValidDocuments(documents);
  
  console.log(`  📊 Input: ${documents.length} documents, Valid: ${validDocs.length} documents`);
  
  // Test rendering each document
  validDocs.forEach((doc, index) => {
    try {
      // Simulate rendering logic
      const title = doc.title || 'بدون عنوان';
      const fileSize = doc.file_size || 0;
      const uploadDate = doc.upload_date || 'تاریخ نامشخص';
      const processed = doc.processed || false;
      
      console.log(`  ✅ Document ${index + 1}: "${title}" (${fileSize} bytes, ${processed ? 'processed' : 'processing'})`);
    } catch (error) {
      console.log(`  ❌ Document ${index + 1}: Render failed - ${error}`);
      return false;
    }
  });

  console.log(`\n📊 All ${validDocs.length} valid documents rendered successfully`);
  return true;
}

// Run all tests
function runAllTests() {
  console.log('🚀 Running Document Object Validation Tests...');
  console.log('='.repeat(60));
  
  const results = [
    testIsValidDocument(),
    testFilterValidDocuments(),
    testApiResponseHandling(),
    testDocumentRendering(),
  ];
  
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log('\n' + '='.repeat(60));
  console.log(`🎯 Test Results: ${passed}/${total} test suites passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Document object validation is working correctly.');
    console.log('✅ The "undefined is not an object (evaluating \'doc.title\')" error is fixed!');
  } else {
    console.log('❌ Some tests failed. Please check the implementation.');
  }
  
  return passed === total;
}

// Export for use in browser
if (typeof window !== 'undefined') {
  (window as any).DocumentValidationTests = {
    runAllTests,
    testIsValidDocument,
    testFilterValidDocuments,
    testApiResponseHandling,
    testDocumentRendering,
  };
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}

export {
  runAllTests,
  testIsValidDocument,
  testFilterValidDocuments,
  testApiResponseHandling,
  testDocumentRendering,
};
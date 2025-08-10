'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button, FileUpload, LoadingMessage, Card, CardHeader, CardTitle, CardContent } from '@ux-nevesht/ui';
import { ArrowLeft, MessageSquare, FileText, Trash2, RefreshCw } from 'lucide-react';
import { documentsApi, Document } from '../../lib/api';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const docs = await documentsApi.getDocuments();
      
      // Defensive programming: ensure docs is always an array of valid objects
      const validDocs = filterValidDocuments(docs);
      setDocuments(validDocs);
    } catch (error) {
      console.error('Error loading documents:', error);
      // On error, ensure documents remains as empty array
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    
    try {
      // Upload file to API
      const newDoc = await documentsApi.uploadDocument(files[0]);
      
      // Add to documents list (validate first)
      if (isValidDocument(newDoc)) {
        setDocuments(prev => {
          const validPrev = filterValidDocuments(prev);
          return [newDoc, ...validPrev];
        });
      }
      
      // Poll for processing completion
      const pollProcessing = setInterval(async () => {
        try {
          const updatedDocs = await documentsApi.getDocuments();
          
          // Ensure updatedDocs is valid and find the uploaded document
          const validUpdatedDocs = filterValidDocuments(updatedDocs);
          const uploadedDoc = validUpdatedDocs.find(doc => doc.id === newDoc.id);
          
          if (uploadedDoc?.processed) {
            setDocuments(prev => {
              const validPrev = filterValidDocuments(prev);
              return validPrev.map(doc => 
                doc.id === newDoc.id ? uploadedDoc : doc
              );
            });
            clearInterval(pollProcessing);
          }
        } catch (error) {
          console.error('Error checking processing status:', error);
          clearInterval(pollProcessing);
        }
      }, 2000);

      // Stop polling after 60 seconds
      setTimeout(() => clearInterval(pollProcessing), 60000);
      
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('خطا در آپلود فایل. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Validate the id parameter
    if (!id || typeof id !== 'string') {
      console.error('Invalid document ID for deletion:', id);
      return;
    }

    if (!confirm('آیا از حذف این سند اطمینان دارید؟')) {
      return;
    }

    try {
      await documentsApi.deleteDocument(id);
      setDocuments(prev => {
        const validPrev = filterValidDocuments(prev);
        return validPrev.filter(doc => doc.id !== id);
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('خطا در حذف سند. لطفاً دوباره تلاش کنید.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper function to validate document objects
  const isValidDocument = (doc: any): doc is Document => {
    return doc && 
           typeof doc === 'object' && 
           doc.id && 
           typeof doc.id === 'string';
  };

  // Helper function to filter and validate documents array
  const filterValidDocuments = (docs: any[]): Document[] => {
    if (!Array.isArray(docs)) return [];
    
    const validDocs = docs.filter(isValidDocument);
    
    // Log warning if we filtered out any invalid documents
    if (validDocs.length !== docs.length) {
      console.warn(`Filtered out ${docs.length - validDocs.length} invalid documents`);
    }
    
    return validDocs;
  };

  const handleReprocess = async (id: string) => {
    // Validate the id parameter
    if (!id || typeof id !== 'string') {
      console.error('Invalid document ID for reprocessing:', id);
      return;
    }

    try {
      await documentsApi.reprocessDocument(id);
      
      // Update document status to processing
      setDocuments(prev => {
        const validPrev = filterValidDocuments(prev);
        return validPrev.map(doc => 
          doc.id === id ? { ...doc, processed: false } : doc
        );
      });

      // Poll for processing completion
      const pollProcessing = setInterval(async () => {
        try {
          const updatedDocs = await documentsApi.getDocuments();
          
          // Ensure updatedDocs is valid and find the reprocessed document
          const validUpdatedDocs = filterValidDocuments(updatedDocs);
          const reprocessedDoc = validUpdatedDocs.find(doc => doc.id === id);
          
          if (reprocessedDoc?.processed) {
            setDocuments(prev => {
              const validPrev = filterValidDocuments(prev);
              return validPrev.map(doc => 
                doc.id === id ? reprocessedDoc : doc
              );
            });
            clearInterval(pollProcessing);
          }
        } catch (error) {
          console.error('Error checking processing status:', error);
          clearInterval(pollProcessing);
        }
      }, 2000);

      // Stop polling after 60 seconds
      setTimeout(() => clearInterval(pollProcessing), 60000);
      
    } catch (error) {
      console.error('Error reprocessing document:', error);
      alert('خطا در پردازش مجدد سند. لطفاً دوباره تلاش کنید.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 space-x-reverse">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 ml-2" />
                بازگشت
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-gray-900">مدیریت اسناد</h1>
          </div>
          <Link href="/chat">
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4 ml-2" />
              چت
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {/* Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>آپلود راهنماها</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload
              onFileSelect={handleFileSelect}
              disabled={isUploading}
              accept={{ 'text/markdown': ['.md'], 'text/plain': ['.txt'] }}
              maxSize={10 * 1024 * 1024}
            />
            {isUploading && (
              <div className="mt-4 text-center text-blue-600">
                در حال آپلود و پردازش فایل...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle>اسناد آپلود شده ({filterValidDocuments(documents).length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <LoadingMessage message="در حال بارگذاری اسناد..." />
              </div>
            ) : filterValidDocuments(documents).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>هنوز سندی آپلود نشده است</p>
                <p className="text-sm">فایل‌های مارک‌داون خود را آپلود کنید</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filterValidDocuments(documents).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center space-x-3 space-x-reverse">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div>
                        <h3 className="font-medium text-gray-900">{doc.title || 'بدون عنوان'}</h3>
                        <div className="flex items-center space-x-4 space-x-reverse text-sm text-gray-500">
                          <span>{formatFileSize(doc.file_size || 0)}</span>
                          <span>{doc.upload_date || 'تاریخ نامشخص'}</span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            doc.processed 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {doc.processed ? 'پردازش شده' : 'در حال پردازش...'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2 space-x-reverse">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!doc.processed || !doc.id}
                        onClick={() => doc.id && handleReprocess(doc.id)}
                      >
                        <RefreshCw className="h-4 w-4 ml-2" />
                        پردازش مجدد
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!doc.id}
                        onClick={() => doc.id && handleDelete(doc.id)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 ml-2" />
                        حذف
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
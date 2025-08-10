import * as React from 'react';
import { useDropzone } from 'react-dropzone';
import { cn, formatFileSize } from '../lib/utils';
import { Upload, X, FileText } from 'lucide-react';

export interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

export const FileUpload = React.forwardRef<HTMLDivElement, FileUploadProps>(
  ({ onFileSelect, accept = { 'text/markdown': ['.md'], 'text/plain': ['.txt'] }, maxSize = 10 * 1024 * 1024, multiple = false, disabled = false, className }, ref) => {
    const [uploadedFiles, setUploadedFiles] = React.useState<File[]>([]);

    const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
      accept,
      maxSize,
      multiple,
      disabled,
      onDrop: (acceptedFiles) => {
        setUploadedFiles(acceptedFiles);
        onFileSelect(acceptedFiles);
      },
    });

    const removeFile = (index: number) => {
      const newFiles = uploadedFiles.filter((_, i) => i !== index);
      setUploadedFiles(newFiles);
      onFileSelect(newFiles);
    };

    const hasErrors = fileRejections.length > 0;

    return (
      <div className={cn('w-full', className)} ref={ref}>
        <div
          {...getRootProps()}
          className={cn(
            'upload-area relative rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors',
            isDragActive && 'drag-over',
            hasErrors && 'border-red-300 bg-red-50',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center space-y-2">
            <Upload className="h-8 w-8 text-gray-400" />
            <div className="text-sm">
              {isDragActive ? (
                <p className="text-blue-600">فایل‌ها را اینجا رها کنید...</p>
              ) : (
                <div>
                  <p className="text-gray-600">
                    فایل‌های مارک‌داون/متنی را اینجا بکشید یا{' '}
                    <span className="text-blue-600 underline cursor-pointer">انتخاب کنید</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    حداکثر حجم: {formatFileSize(maxSize)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* File Rejections */}
        {hasErrors && (
          <div className="mt-2 space-y-1">
            {fileRejections.map(({ file, errors }) => (
              <div key={file.name} className="text-sm text-red-600">
                <span className="font-medium">{file.name}</span>
                {errors.map((error) => (
                  <div key={error.code} className="text-xs">
                    {error.code === 'file-too-large' && 'فایل بیش از حد بزرگ است'}
                    {error.code === 'file-invalid-type' && 'نوع فایل پشتیبانی نمی‌شود'}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-700">فایل‌های انتخاب شده:</h4>
            {uploadedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between rounded-md bg-gray-50 p-2"
              >
                <div className="flex items-center space-x-2 space-x-reverse">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="rounded-full p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

FileUpload.displayName = 'FileUpload'; 
'use client';

import { useState, useRef } from 'react';

interface PaperMetadata {
  title: string;
  authors: string;
  journal: string;
  year: string;
  doi: string;
  sourceType: string;
}

interface GenerationResult {
  success: boolean;
  gammaMarkdown?: string;
  educationalDocPath?: string;
  error?: string;
}

export default function Home() {
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [paperMetadata, setPaperMetadata] = useState<PaperMetadata | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState('');

  // PDF Upload states
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!input.trim()) return;

    setSearching(true);
    setError('');
    setPaperMetadata(null);
    setResult(null);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        setPaperMetadata(data.metadata);
      } else {
        setError(data.error || 'Failed to find paper');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
    } finally {
      setSearching(false);
    }
  };

  const handleGenerate = async () => {
    if (!paperMetadata && !uploadedFile) return;

    setGenerating(true);
    setProgress('Starting generation...');
    setError('');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: uploadedFile || input.trim(),
          isPdfUpload: !!uploadedFile
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResult(data);
        setProgress('Complete!');
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');
    setUploadedFile(null);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          if (data.success) {
            setUploadedFile(data.filePath);
            setPaperMetadata({
              title: file.name.replace('.pdf', ''),
              authors: 'From uploaded PDF',
              journal: 'Unknown',
              year: new Date().getFullYear().toString(),
              doi: '',
              sourceType: 'PDF Upload'
            });
          } else {
            setError(data.error || 'Upload failed');
          }
        } else {
          setError('Upload failed');
        }
        setUploading(false);
      };

      xhr.onerror = () => {
        setError('Upload failed - network error');
        setUploading(false);
      };

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Journal Club Generator
          </h1>
          <p className="text-gray-600">
            Enter a DOI, paper URL, or upload a PDF to generate presentation materials
          </p>
        </div>

        {/* Main Input Section */}
        <div className="bg-white rounded-xl shadow-lg p-5 mb-6">
          {/* Search by DOI/URL */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Option 1: DOI or Paper URL
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g., 10.1056/NEJMoa1234567 or https://japi.org/article/..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                disabled={!!uploadedFile}
              />
              <button
                onClick={handleSearch}
                disabled={searching || !input.trim() || !!uploadedFile}
                className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-500">OR</span>
            </div>
          </div>

          {/* PDF Upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Option 2: Upload PDF directly
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
              } ${uploadedFile ? 'border-green-500 bg-green-50' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />

              {uploading ? (
                <div className="py-2">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-blue-600 font-medium">Uploading... {uploadProgress}%</span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{uploadProgress < 100 ? 'Please wait...' : 'Processing...'}</p>
                </div>
              ) : uploadedFile ? (
                <div className="py-2">
                  <svg className="mx-auto h-8 w-8 text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-green-700 font-medium">Upload successful!</p>
                  <p className="text-sm text-gray-600">Ready to generate documents</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setPaperMetadata(null); }}
                    className="mt-2 text-xs text-red-600 hover:text-red-800"
                  >
                    Remove and try different file
                  </button>
                </div>
              ) : (
                <div className="py-2">
                  <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-600 font-medium">Drop PDF here or click to browse</p>
                  <p className="text-xs text-gray-500 mt-1">Have a PDF? Upload it directly!</p>
                </div>
              )}
            </div>
          </div>

          {/* Help Section - Compact */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800">
              Need help? Click for examples
            </summary>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm">
              <p className="text-blue-800 mb-3">
                <strong>What is a DOI?</strong> A unique code like <code className="bg-blue-100 px-1 rounded">10.xxxx/xxxxx</code> found on papers first page.
              </p>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <p className="font-medium text-blue-900 mb-1">DOI Examples (click to use):</p>
                  <ul className="space-y-1 text-blue-700 text-xs">
                    <li className="cursor-pointer hover:text-blue-900" onClick={() => setInput('10.1056/NEJMoa2302392')}>
                      <code className="bg-white px-1 rounded">10.1056/NEJMoa2302392</code>
                    </li>
                    <li className="cursor-pointer hover:text-blue-900" onClick={() => setInput('10.1016/S0140-6736(23)00806-1')}>
                      <code className="bg-white px-1 rounded">10.1016/S0140-6736(23)00806-1</code>
                    </li>
                    <li className="cursor-pointer hover:text-blue-900" onClick={() => setInput('10.1001/jama.2023.4900')}>
                      <code className="bg-white px-1 rounded">10.1001/jama.2023.4900</code>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-blue-900 mb-1">Open Access URLs:</p>
                  <ul className="space-y-1 text-blue-700 text-xs">
                    <li className="cursor-pointer hover:text-blue-900" onClick={() => setInput('https://www.japi.org/article/view/2340')}>
                      JAPI, PubMed Central, MDPI, BMC, PLOS
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Paper Preview */}
        {paperMetadata && !result && (
          <div className="bg-white rounded-xl shadow-lg p-5 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Paper Found</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-500">Title:</span>
                <p className="text-gray-900">{paperMetadata.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-gray-500">Authors:</span>
                  <p className="text-gray-900">{paperMetadata.authors}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Source:</span>
                  <p className="text-gray-900">{paperMetadata.sourceType}</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-4 w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? 'Generating...' : 'Generate Documents'}
            </button>

            {generating && (
              <div className="mt-3 text-center text-gray-600 text-sm">
                <div className="animate-pulse">{progress}</div>
                <p className="text-xs text-gray-500 mt-1">This takes about 10-15 seconds...</p>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {result && result.success && (
          <div className="bg-white rounded-xl shadow-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">Generation Complete!</h2>
            </div>

            <div className="space-y-3">
              <div className="border border-gray-200 rounded-lg p-3">
                <h3 className="font-medium text-gray-900 mb-1 text-sm">Gamma Markdown</h3>
                <p className="text-xs text-gray-600 mb-2">
                  {result.gammaMarkdown?.length?.toLocaleString()} characters
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(result.gammaMarkdown || '')}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                  >
                    Copy
                  </button>
                  <a
                    href="https://gamma.app/create"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                  >
                    Open Gamma.app
                  </a>
                </div>
              </div>

              {result.educationalDocPath && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <h3 className="font-medium text-gray-900 mb-1 text-sm">Educational Document</h3>
                  <a
                    href={`/api/download?file=${encodeURIComponent(result.educationalDocPath)}`}
                    className="inline-block px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
                  >
                    Download .docx
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setInput('');
                setPaperMetadata(null);
                setResult(null);
                setUploadedFile(null);
                setError('');
              }}
              className="mt-4 text-blue-600 hover:text-blue-800 font-medium text-sm"
            >
              Generate Another Paper
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

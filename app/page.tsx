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
  gammaPptUrl?: string;
  educationalDocPath?: string;
  error?: string;
}

export default function Home() {
  const [input, setInput] = useState('');
  const [email, setEmail] = useState('');
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
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setGenerating(true);
    setProgress('Starting generation...');
    setError('');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: uploadedFile || input.trim(),
          isPdfUpload: !!uploadedFile,
          email: email.trim()
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
  };

  return (
    <div className="min-h-screen bg-animated">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 mb-4">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
            <span className="text-teal-400 text-sm font-medium">Research Paper Analysis</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">
            Journal Club <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">Generator</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Transform research papers into beautiful presentations with AI-powered analysis
          </p>
        </div>

        {/* Main Card */}
        <div className="glass-card rounded-2xl p-6 mb-6 animate-fade-in-up delay-100" style={{ opacity: 0 }}>
          {/* DOI/URL Search */}
          <div className="mb-5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search by DOI or URL
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="10.1056/NEJMoa... or https://japi.org/article/..."
                className="flex-1 px-4 py-3 input-modern rounded-xl text-sm mono"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                disabled={!!uploadedFile}
              />
              <button
                onClick={handleSearch}
                disabled={searching || !input.trim() || !!uploadedFile}
                className="px-6 py-3 btn-accent rounded-xl text-sm disabled:cursor-not-allowed"
              >
                {searching ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Searching
                  </span>
                ) : 'Search'}
              </button>
            </div>
          </div>

          {/* Paper Found - RIGHT HERE after search */}
          {paperMetadata && !result && (
            <div className="mb-5 p-4 bg-green-500/10 border border-green-500/30 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Paper Found</h2>
                  <p className="text-slate-500 text-xs">{paperMetadata.sourceType}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4 p-3 bg-slate-900/50 rounded-lg">
                <div>
                  <p className="text-slate-500 text-[10px] uppercase tracking-wider">Title</p>
                  <p className="text-white text-sm font-medium leading-tight">{paperMetadata.title}</p>
                </div>
                <div className="flex gap-4 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-500 text-[10px] uppercase tracking-wider">Authors</p>
                    <p className="text-slate-300 truncate">
                      {paperMetadata.authors.split(',').slice(0, 2).join(', ')}
                      {paperMetadata.authors.split(',').length > 2 && ' et al.'}
                    </p>
                  </div>
                  {paperMetadata.doi && (
                    <div className="flex-shrink-0 max-w-[180px]">
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider">DOI</p>
                      <p className="text-teal-400 mono text-[11px] truncate">{paperMetadata.doi}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Email Input */}
              <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email for Download Links
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-2 input-modern rounded-lg text-sm"
                />
                <p className="text-slate-500 text-xs mt-2">We'll email you the download links for both documents</p>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating || !email.trim()}
                className="w-full py-3 btn-warm rounded-xl text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {progress}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Documents
                  </span>
                )}
              </button>

              <button
                onClick={() => { setInput(''); setPaperMetadata(null); }}
                className="w-full mt-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                Search different paper
              </button>
            </div>
          )}

          {/* Divider - hide when paper found */}
          {!paperMetadata && (
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-slate-800/50 text-slate-500 text-sm">or upload directly</span>
            </div>
          </div>
          )}

          {/* PDF Upload Zone - hide when paper found */}
          {!paperMetadata && (
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload PDF
            </label>
            <div
              className={`upload-zone rounded-xl p-5 text-center cursor-pointer transition-all duration-300 ${
                dragActive ? 'drag-active' : ''
              } ${uploadedFile ? 'uploaded' : ''}`}
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
                <div className="py-3">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <svg className="animate-spin h-5 w-5 text-teal-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-teal-400 font-semibold mono">{uploadProgress}%</span>
                  </div>
                  <div className="progress-bar w-full h-2 rounded-full">
                    <div className="progress-bar-fill h-full rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <p className="text-slate-500 text-xs mt-2">{uploadProgress < 100 ? 'Uploading...' : 'Processing...'}</p>
                </div>
              ) : uploadedFile ? (
                <div className="py-3">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-green-400 font-semibold">Upload Complete!</p>
                  <p className="text-slate-400 text-sm">Ready to generate</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setPaperMetadata(null); }}
                    className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="py-3">
                  <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-300 font-medium">Drop your PDF here</p>
                  <p className="text-slate-500 text-sm">or click to browse</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Help Section - hide when paper found */}
          {!paperMetadata && (
          <details className="mt-4" open>
            <summary className="cursor-pointer text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How to find paper information (click examples to use)
            </summary>
            <div className="mt-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 space-y-4">
              {/* What is DOI */}
              <div className="p-3 bg-teal-500/10 rounded-lg border border-teal-500/20">
                <p className="text-slate-300 text-sm">
                  <strong className="text-teal-400">What is a DOI?</strong> A DOI (Digital Object Identifier) is a unique code for any paper.
                  Look for it on the paper&apos;s first page, usually near the title or in the footer.
                  It looks like: <code className="mono text-teal-400 bg-slate-900/50 px-1.5 py-0.5 rounded">10.xxxx/xxxxx</code>
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* DOI Examples */}
                <div>
                  <p className="text-slate-300 font-medium mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                    DOI Examples
                  </p>
                  <div className="space-y-1">
                    {[
                      { doi: '10.1056/NEJMoa2302392', label: 'NEJM' },
                      { doi: '10.1016/S0140-6736(23)00806-1', label: 'Lancet' },
                      { doi: '10.1001/jama.2023.4900', label: 'JAMA' }
                    ].map((item) => (
                      <button
                        key={item.doi}
                        onClick={() => setInput(item.doi)}
                        className="block w-full text-left px-3 py-2 rounded-lg bg-slate-900/50 text-teal-400 hover:bg-teal-500/10 transition-colors mono text-xs border border-slate-700/50 hover:border-teal-500/30"
                      >
                        <span className="text-slate-500 text-[10px] block">{item.label}</span>
                        {item.doi}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paper Title Examples */}
                <div>
                  <p className="text-slate-300 font-medium mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                    Search by Paper Title
                  </p>
                  <div className="space-y-1">
                    {[
                      'Semaglutide and Cardiovascular Outcomes in Obesity',
                      'GLP-1 agonists in type 2 diabetes',
                      'Effect of SGLT2 inhibitors on heart failure'
                    ].map((title) => (
                      <button
                        key={title}
                        onClick={() => setInput(title)}
                        className="block w-full text-left px-3 py-2 rounded-lg bg-slate-900/50 text-orange-400 hover:bg-orange-500/10 transition-colors text-xs border border-slate-700/50 hover:border-orange-500/30"
                      >
                        {title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Open Access URLs */}
              <div>
                <p className="text-slate-300 font-medium mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  Open Access Paper URLs (full text available)
                </p>
                <div className="grid md:grid-cols-2 gap-2">
                  {[
                    { name: 'JAPI', url: 'https://www.japi.org/article/view/2340' },
                    { name: 'PubMed Central', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10234567/' },
                    { name: 'MDPI', url: 'https://www.mdpi.com/2077-0383/12/5/1234' },
                    { name: 'BMC', url: 'https://bmcmedicine.biomedcentral.com/articles/10.1186/s12916-023-02900-1' },
                    { name: 'PLOS', url: 'https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1004000' }
                  ].map((source) => (
                    <button
                      key={source.name}
                      onClick={() => setInput(source.url)}
                      className="text-left px-3 py-2 rounded-lg bg-slate-900/50 hover:bg-purple-500/10 transition-colors border border-slate-700/50 hover:border-purple-500/30"
                    >
                      <span className="text-purple-400 font-medium text-xs">{source.name}</span>
                      <span className="text-slate-500 text-[10px] block truncate">{source.url}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-slate-500 text-xs text-center pt-2 border-t border-slate-700/50">
                Click any example above to auto-fill the search box
              </p>
            </div>
          </details>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="glass-card rounded-xl p-4 mb-6 border-red-500/30 bg-red-500/10 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && result.success && (
          <div className="glass-card rounded-2xl p-6 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Generation Complete!</h2>
                <p className="text-slate-500 text-sm">Your documents are ready</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Email Confirmation */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Check your email!</p>
                    <p className="text-blue-300 text-xs">{email}</p>
                  </div>
                </div>
                <p className="text-blue-200 text-sm leading-relaxed">
                  We're generating your documents and will send download links to your email within a few minutes. You'll receive:
                </p>
                <ul className="mt-3 space-y-2 text-blue-200 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span>
                    <span>PowerPoint presentation (Gamma)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span>
                    <span>Educational Word document</span>
                  </li>
                </ul>
                <p className="text-blue-300 text-xs mt-3 border-t border-blue-500/20 pt-3">
                  Links expire after 48 hours. If you don't see the email, check your spam folder.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setInput('');
                setPaperMetadata(null);
                setResult(null);
                setUploadedFile(null);
                setError('');
              }}
              className="mt-5 text-teal-400 hover:text-teal-300 font-medium text-sm transition-colors flex items-center gap-2 mx-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Generate Another
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-slate-600 text-sm">
          Powered by AI analysis
        </div>
      </div>
    </div>
  );
}

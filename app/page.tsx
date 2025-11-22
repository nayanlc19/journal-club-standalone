'use client';

import { useState } from 'react';

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
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [paperMetadata, setPaperMetadata] = useState<PaperMetadata | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState('');

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
    if (!paperMetadata) return;

    setGenerating(true);
    setProgress('Starting generation...');
    setError('');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Journal Club Generator
          </h1>
          <p className="text-lg text-gray-600">
            Enter a DOI or paper URL to generate presentation materials
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            DOI or Paper URL
          </label>
          <div className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., 10.1056/NEJMoa1234567 or https://japi.org/article/..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={searching || !input.trim()}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Help Section */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <h3 className="font-semibold text-blue-900 mb-3">How to find paper information:</h3>

            {/* What is DOI */}
            <div className="mb-4">
              <p className="text-sm text-blue-800 mb-2">
                <strong>What is a DOI?</strong> A DOI (Digital Object Identifier) is a unique code for any paper.
                Look for it on the paper&apos;s first page, usually near the title or in the footer. It looks like: <code className="bg-blue-100 px-1 rounded">10.xxxx/xxxxx</code>
              </p>
            </div>

            {/* Examples */}
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              {/* DOI Examples */}
              <div>
                <p className="font-medium text-blue-900 mb-2">DOI Examples:</p>
                <ul className="space-y-1 text-blue-700">
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

              {/* Title Examples */}
              <div>
                <p className="font-medium text-blue-900 mb-2">Paper Title Examples:</p>
                <ul className="space-y-1 text-blue-700 text-xs">
                  <li className="cursor-pointer hover:text-blue-900" onClick={() => setInput('Semaglutide and Cardiovascular Outcomes in Obesity')}>
                    Semaglutide and Cardiovascular Outcomes in Obesity
                  </li>
                  <li className="cursor-pointer hover:text-blue-900" onClick={() => setInput('GLP-1 agonists in type 2 diabetes')}>
                    GLP-1 agonists in type 2 diabetes
                  </li>
                  <li className="cursor-pointer hover:text-blue-900" onClick={() => setInput('Effect of SGLT2 inhibitors on heart failure')}>
                    Effect of SGLT2 inhibitors on heart failure
                  </li>
                </ul>
              </div>
            </div>

            {/* Publisher URLs */}
            <div className="mt-4">
              <p className="font-medium text-blue-900 mb-2">Open Access Paper URLs (click to try):</p>
              <ul className="space-y-1 text-xs text-blue-700">
                <li className="cursor-pointer hover:text-blue-900" onClick={() => setInput('https://www.japi.org/article/view/2340')}>
                  <span className="font-medium">JAPI:</span> https://www.japi.org/article/view/2340
                </li>
                <li className="cursor-pointer hover:text-blue-900" onClick={() => setInput('https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10234567/')}>
                  <span className="font-medium">PubMed Central:</span> https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10234567/
                </li>
                <li className="cursor-pointer hover:text-blue-900" onClick={() => setInput('https://www.mdpi.com/2077-0383/12/5/1234')}>
                  <span className="font-medium">MDPI:</span> https://www.mdpi.com/2077-0383/12/5/1234
                </li>
                <li className="cursor-pointer hover:text-blue-900" onClick={() => setInput('https://bmcmedicine.biomedcentral.com/articles/10.1186/s12916-023-02900-1')}>
                  <span className="font-medium">BMC:</span> https://bmcmedicine.biomedcentral.com/articles/...
                </li>
                <li className="cursor-pointer hover:text-blue-900" onClick={() => setInput('https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1004000')}>
                  <span className="font-medium">PLOS:</span> https://journals.plos.org/plosmedicine/article?...
                </li>
              </ul>
            </div>

            <p className="text-xs text-blue-600 mt-3 italic">
              Tip: Click any example above to auto-fill and try it!
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
            {error}
          </div>
        )}

        {/* Paper Preview */}
        {paperMetadata && !result && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Paper Found</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Title:</span>
                <p className="text-gray-900">{paperMetadata.title}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Authors:</span>
                <p className="text-gray-900">{paperMetadata.authors}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Journal:</span>
                <p className="text-gray-900">{paperMetadata.journal} ({paperMetadata.year})</p>
              </div>
              {paperMetadata.doi && (
                <div>
                  <span className="text-sm font-medium text-gray-500">DOI:</span>
                  <p className="text-gray-900">{paperMetadata.doi}</p>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-gray-500">Source:</span>
                <p className="text-gray-900">{paperMetadata.sourceType}</p>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-6 w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? 'Generating...' : 'Confirm & Generate Documents'}
            </button>

            {generating && (
              <div className="mt-4 text-center text-gray-600">
                <div className="animate-pulse">{progress}</div>
                <p className="text-sm text-gray-500 mt-2">This takes about 10-15 seconds...</p>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {result && result.success && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-6">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900">Generation Complete!</h2>
            </div>

            <div className="space-y-4">
              {/* Gamma Markdown */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Gamma Markdown</h3>
                <p className="text-sm text-gray-600 mb-3">
                  {result.gammaMarkdown?.length?.toLocaleString()} characters - Ready for Gamma.app
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(result.gammaMarkdown || '')}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    Copy to Clipboard
                  </button>
                  <a
                    href="https://gamma.app/create"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                  >
                    Open Gamma.app
                  </a>
                </div>
              </div>

              {/* Educational Document */}
              {result.educationalDocPath && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Educational Document</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Word document with full explanations and Defense Q&A
                  </p>
                  <a
                    href={`/api/download?file=${encodeURIComponent(result.educationalDocPath)}`}
                    className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                  >
                    Download .docx
                  </a>
                </div>
              )}
            </div>

            {/* Start Over */}
            <button
              onClick={() => {
                setInput('');
                setPaperMetadata(null);
                setResult(null);
                setError('');
              }}
              className="mt-6 text-blue-600 hover:text-blue-800 font-medium"
            >
              Generate Another Paper
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

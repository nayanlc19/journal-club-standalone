/**
 * Multi-source PDF Fetcher
 * Tries multiple academic APIs to find and download PDF for a DOI
 * Also supports direct URL fetching (PDF or HTML from publisher pages)
 */

interface PdfResult {
  success: boolean;
  pdfBuffer?: Buffer;
  htmlContent?: string; // For HTML pages (when PDF not available)
  source?: string;
  error?: string;
}

/**
 * Helper to create fetch with timeout using AbortController
 */
async function fetchWithTimeout(url: string, options: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 10000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Try to fetch PDF from Unpaywall
 */
async function fetchFromUnpaywall(doi: string): Promise<PdfResult> {
  try {
    const apiUrl = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=nayanlc19@gmail.com`;
    const response = await fetchWithTimeout(apiUrl, { timeoutMs: 10000 });
    
    if (!response.ok) return { success: false, error: 'Unpaywall API failed' };
    
    const data = await response.json();
    const oaLocations = (data.oa_locations || []).filter((loc: any) => loc.url_for_pdf);
    
    // Try each location
    for (const loc of oaLocations) {
      try {
        const pdfResponse = await fetchWithTimeout(loc.url_for_pdf, {
          timeoutMs: 30000,
          redirect: 'follow',
          headers: { 'User-Agent': 'SmartDNBPrep/1.0' }
        });
        
        if (pdfResponse.ok && pdfResponse.headers.get('content-type')?.includes('pdf')) {
          const arrayBuffer = await pdfResponse.arrayBuffer();
          return {
            success: true,
            pdfBuffer: Buffer.from(arrayBuffer),
            source: `Unpaywall (${loc.host_type})`
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false, error: 'No accessible PDF found in Unpaywall' };
  } catch (error: any) {
    return { success: false, error: `Unpaywall error: ${error.message}` };
  }
}

/**
 * Try to fetch PDF from Semantic Scholar
 */
async function fetchFromSemanticScholar(doi: string): Promise<PdfResult> {
  try {
    const apiUrl = `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=openAccessPdf`;
    const response = await fetchWithTimeout(apiUrl, { timeoutMs: 10000 });
    
    if (!response.ok) return { success: false, error: 'Semantic Scholar API failed' };
    
    const data = await response.json();
    const pdfUrl = data.openAccessPdf?.url;
    
    if (!pdfUrl) return { success: false, error: 'No OA PDF in Semantic Scholar' };
    
    const pdfResponse = await fetchWithTimeout(pdfUrl, {
      timeoutMs: 30000,
      redirect: 'follow',
      headers: { 'User-Agent': 'SmartDNBPrep/1.0' }
    });
    
    if (pdfResponse.ok && pdfResponse.headers.get('content-type')?.includes('pdf')) {
      const arrayBuffer = await pdfResponse.arrayBuffer();
      return {
        success: true,
        pdfBuffer: Buffer.from(arrayBuffer),
        source: 'Semantic Scholar'
      };
    }
    
    return { success: false, error: 'PDF not downloadable from Semantic Scholar' };
  } catch (error: any) {
    return { success: false, error: `Semantic Scholar error: ${error.message}` };
  }
}

/**
 * Try to fetch PDF from OpenAlex
 */
async function fetchFromOpenAlex(doi: string): Promise<PdfResult> {
  try {
    const apiUrl = `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`;
    const response = await fetchWithTimeout(apiUrl, {
      timeoutMs: 10000,
      headers: { 'User-Agent': 'SmartDNBPrep/1.0 (mailto:nayanlc19@gmail.com)' }
    });
    
    if (!response.ok) return { success: false, error: 'OpenAlex API failed' };
    
    const data = await response.json();
    
    // Check for open access PDF URL
    const pdfUrl = data.primary_location?.pdf_url || 
                   data.best_oa_location?.pdf_url ||
                   data.locations?.find((loc: any) => loc.pdf_url)?.pdf_url;
    
    if (!pdfUrl) return { success: false, error: 'No OA PDF in OpenAlex' };
    
    const pdfResponse = await fetchWithTimeout(pdfUrl, {
      timeoutMs: 30000,
      redirect: 'follow',
      headers: { 'User-Agent': 'SmartDNBPrep/1.0' }
    });
    
    if (pdfResponse.ok && pdfResponse.headers.get('content-type')?.includes('pdf')) {
      const arrayBuffer = await pdfResponse.arrayBuffer();
      return {
        success: true,
        pdfBuffer: Buffer.from(arrayBuffer),
        source: 'OpenAlex'
      };
    }
    
    return { success: false, error: 'PDF not downloadable from OpenAlex' };
  } catch (error: any) {
    return { success: false, error: `OpenAlex error: ${error.message}` };
  }
}

/**
 * Try to fetch PDF from CORE
 */
async function fetchFromCore(doi: string): Promise<PdfResult> {
  try {
    // CORE API requires API key, skip if not configured
    if (!process.env.CORE_API_KEY) {
      return { success: false, error: 'CORE API key not configured' };
    }
    
    const apiUrl = `https://api.core.ac.uk/v3/search/works?q=doi:${encodeURIComponent(doi)}`;
    const response = await fetchWithTimeout(apiUrl, {
      timeoutMs: 10000,
      headers: { 'Authorization': `Bearer ${process.env.CORE_API_KEY}` }
    });
    
    if (!response.ok) return { success: false, error: 'CORE API failed' };
    
    const data = await response.json();
    const pdfUrl = data.results?.[0]?.downloadUrl;
    
    if (!pdfUrl) return { success: false, error: 'No PDF in CORE' };
    
    const pdfResponse = await fetchWithTimeout(pdfUrl, {
      timeoutMs: 30000,
      redirect: 'follow',
      headers: { 'User-Agent': 'SmartDNBPrep/1.0' }
    });
    
    if (pdfResponse.ok && pdfResponse.headers.get('content-type')?.includes('pdf')) {
      const arrayBuffer = await pdfResponse.arrayBuffer();
      return {
        success: true,
        pdfBuffer: Buffer.from(arrayBuffer),
        source: 'CORE'
      };
    }
    
    return { success: false, error: 'PDF not downloadable from CORE' };
  } catch (error: any) {
    return { success: false, error: `CORE error: ${error.message}` };
  }
}

/**
 * Try to fetch PDF from Sci-Hub (fallback)
 */
async function fetchFromSciHub(doi: string): Promise<PdfResult> {
  try {
    // Sci-Hub mirrors (Updated December 2025 - try multiple in case some are down)
    const mirrors = [
      'https://sci-hub.st',
      'https://sci-hub.ru',
      'https://sci-hub.se',
      'https://sci-hub.red',
      'https://sci-hub.box'
    ];

    for (const mirror of mirrors) {
      try {
        const scihubUrl = `${mirror}/${doi}`;
        const response = await fetchWithTimeout(scihubUrl, {
          timeoutMs: 15000,
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        if (!response.ok) continue;

        const html = await response.text();

        // Extract PDF URL from Sci-Hub page (usually in iframe or embed)
        const pdfUrlMatch = html.match(/https?:\/\/[^"'\s]+\.pdf/i) ||
                           html.match(/\/\/[^"'\s]+\.pdf/i);

        if (!pdfUrlMatch) continue;

        let pdfUrl = pdfUrlMatch[0];
        if (pdfUrl.startsWith('//')) pdfUrl = 'https:' + pdfUrl;

        const pdfResponse = await fetchWithTimeout(pdfUrl, {
          timeoutMs: 30000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        if (pdfResponse.ok && pdfResponse.headers.get('content-type')?.includes('pdf')) {
          const arrayBuffer = await pdfResponse.arrayBuffer();
          return {
            success: true,
            pdfBuffer: Buffer.from(arrayBuffer),
            source: 'Sci-Hub'
          };
        }
      } catch (e) {
        continue;
      }
    }

    return { success: false, error: 'No PDF found on Sci-Hub mirrors' };
  } catch (error: any) {
    return { success: false, error: `Sci-Hub error: ${error.message}` };
  }
}

/**
 * Try to fetch PDF from LibGen scimag (Scientific articles archive)
 */
async function fetchFromLibGenScimag(doi: string): Promise<PdfResult> {
  try {
    // LibGen scimag mirrors
    const mirrors = [
      'https://libgen.rs/scimag',
      'https://libgen.st/scimag',
      'https://libgen.is/scimag'
    ];

    for (const mirror of mirrors) {
      try {
        // LibGen scimag search URL
        const searchUrl = `${mirror}/?q=${encodeURIComponent(doi)}`;
        const response = await fetchWithTimeout(searchUrl, {
          timeoutMs: 15000,
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        if (!response.ok) continue;

        const html = await response.text();

        // Extract download link from LibGen page
        const downloadMatch = html.match(/https?:\/\/[^"'\s]+\.pdf/i) ||
                            html.match(/libgen\.li\/ads\.php[^"']+/i);

        if (!downloadMatch) continue;

        let pdfUrl = downloadMatch[0];
        if (!pdfUrl.startsWith('http')) pdfUrl = mirror.split('/scimag')[0] + pdfUrl;

        const pdfResponse = await fetchWithTimeout(pdfUrl, {
          timeoutMs: 30000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        if (pdfResponse.ok && pdfResponse.headers.get('content-type')?.includes('pdf')) {
          const arrayBuffer = await pdfResponse.arrayBuffer();
          return {
            success: true,
            pdfBuffer: Buffer.from(arrayBuffer),
            source: 'LibGen (scimag)'
          };
        }
      } catch (e) {
        continue;
      }
    }

    return { success: false, error: 'No PDF found on LibGen scimag mirrors' };
  } catch (error: any) {
    return { success: false, error: `LibGen error: ${error.message}` };
  }
}

/**
 * Try to fetch PDF from Anna's Archive (newer alternative to Sci-Hub)
 */
async function fetchFromAnnasArchive(doi: string): Promise<PdfResult> {
  try {
    // Anna's Archive search by DOI
    const searchUrl = `https://annas-archive.org/search?q=${encodeURIComponent(doi)}`;
    const response = await fetchWithTimeout(searchUrl, {
      timeoutMs: 15000,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (!response.ok) return { success: false, error: 'Anna\'s Archive search failed' };

    const html = await response.text();

    // Extract download links from Anna's Archive page
    const downloadMatch = html.match(/https?:\/\/[^"'\s]+\.pdf/i);

    if (!downloadMatch) return { success: false, error: 'No PDF found on Anna\'s Archive' };

    const pdfUrl = downloadMatch[0];
    const pdfResponse = await fetchWithTimeout(pdfUrl, {
      timeoutMs: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (pdfResponse.ok && pdfResponse.headers.get('content-type')?.includes('pdf')) {
      const arrayBuffer = await pdfResponse.arrayBuffer();
      return {
        success: true,
        pdfBuffer: Buffer.from(arrayBuffer),
        source: 'Anna\'s Archive'
      };
    }

    return { success: false, error: 'Failed to download PDF from Anna\'s Archive' };
  } catch (error: any) {
    return { success: false, error: `Anna's Archive error: ${error.message}` };
  }
}

/**
 * Try to fetch PDF from Open Access Button
 */
async function fetchFromOpenAccessButton(doi: string): Promise<PdfResult> {
  try {
    // Open Access Button API
    const apiUrl = `https://api.openaccessbutton.org/availability?url=https://doi.org/${encodeURIComponent(doi)}`;
    const response = await fetchWithTimeout(apiUrl, { timeoutMs: 10000 });

    if (!response.ok) return { success: false, error: 'Open Access Button API failed' };

    const data = await response.json();

    // Check if there's a free PDF available
    if (data.availability && data.availability.length > 0) {
      for (const availability of data.availability) {
        if (availability.type === 'article' && availability.url) {
          try {
            const pdfResponse = await fetchWithTimeout(availability.url, {
              timeoutMs: 30000,
              redirect: 'follow',
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            if (pdfResponse.ok && pdfResponse.headers.get('content-type')?.includes('pdf')) {
              const arrayBuffer = await pdfResponse.arrayBuffer();
              return {
                success: true,
                pdfBuffer: Buffer.from(arrayBuffer),
                source: 'Open Access Button'
              };
            }
          } catch (e) {
            continue;
          }
        }
      }
    }

    return { success: false, error: 'No free PDF found via Open Access Button' };
  } catch (error: any) {
    return { success: false, error: `Open Access Button error: ${error.message}` };
  }
}

/**
 * Try to fetch PDF from arXiv (for preprints)
 */
async function fetchFromArxiv(doi: string): Promise<PdfResult> {
  try {
    // Check if DOI is from arXiv
    if (!doi.toLowerCase().includes('arxiv')) {
      return { success: false, error: 'Not an arXiv DOI' };
    }

    // Extract arXiv ID from DOI (format: 10.48550/arXiv.XXXX.XXXXX)
    const arxivIdMatch = doi.match(/arxiv\.(\d+\.\d+)/i);
    if (!arxivIdMatch) {
      return { success: false, error: 'Could not extract arXiv ID from DOI' };
    }

    const arxivId = arxivIdMatch[1];
    const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

    const pdfResponse = await fetchWithTimeout(pdfUrl, {
      timeoutMs: 30000,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (pdfResponse.ok && pdfResponse.headers.get('content-type')?.includes('pdf')) {
      const arrayBuffer = await pdfResponse.arrayBuffer();
      return {
        success: true,
        pdfBuffer: Buffer.from(arrayBuffer),
        source: 'arXiv'
      };
    }

    return { success: false, error: 'Failed to download from arXiv' };
  } catch (error: any) {
    return { success: false, error: `arXiv error: ${error.message}` };
  }
}

/**
 * Validate PDF matches the DOI by checking metadata from OpenAlex/Crossref
 */
async function validatePdfMatchesDoi(pdfBuffer: Buffer, doi: string): Promise<boolean> {
  try {
    // Get paper metadata from OpenAlex for validation
    const apiUrl = `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`;
    const response = await fetchWithTimeout(apiUrl, {
      timeoutMs: 5000,
      headers: { 'User-Agent': 'SmartDNBPrep/1.0 (mailto:nayanlc19@gmail.com)' }
    });

    if (!response.ok) return true; // Can't validate, assume OK

    const data = await response.json();
    const expectedTitle = data.title?.toLowerCase() || '';
    const expectedAuthors = (data.authorships || []).map((a: any) =>
      a.author?.display_name?.toLowerCase() || ''
    ).filter(Boolean);

    // Extract text from first page of PDF to check title/authors
    const pdfText = pdfBuffer.toString('utf-8', 0, Math.min(5000, pdfBuffer.length)).toLowerCase();

    // Check if title appears in PDF (allow partial match)
    const titleWords = expectedTitle.split(/\s+/).filter((w: string) => w.length > 3);
    const titleMatches = titleWords.filter((word: string) => pdfText.includes(word)).length;
    const titleScore = titleWords.length > 0 ? titleMatches / titleWords.length : 0;

    // Check if at least one author appears
    const authorMatches = expectedAuthors.some((author: string) => {
      const lastName = author.split(/\s+/).pop() || '';
      return lastName.length > 2 && pdfText.includes(lastName);
    });

    // Require 50%+ title match OR author match
    const isValid = titleScore >= 0.5 || authorMatches;

    if (!isValid) {
      console.log(`[PDF Validator] Rejected PDF - title match: ${(titleScore * 100).toFixed(0)}%, author match: ${authorMatches}`);
    }

    return isValid;
  } catch (error) {
    // If validation fails, assume PDF is correct (fail open)
    return true;
  }
}

/**
 * Try to fetch PDF using Google Scholar search dork with validation
 */
async function fetchFromGoogleScholar(doi: string): Promise<PdfResult> {
  try {
    // Use DuckDuckGo instead of Google to avoid CAPTCHA
    const searchQuery = encodeURIComponent(`${doi} filetype:pdf`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${searchQuery}`;

    const response = await fetchWithTimeout(searchUrl, {
      timeoutMs: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (!response.ok) return { success: false, error: 'Search failed' };

    const html = await response.text();

    // Extract PDF links from search results
    const pdfLinks = html.match(/https?:\/\/[^"'\s]+\.pdf/gi) || [];

    // Try each PDF link with validation
    for (const pdfUrl of pdfLinks.slice(0, 3)) { // Try top 3 results
      try {
        const pdfResponse = await fetchWithTimeout(pdfUrl, {
          timeoutMs: 30000,
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        if (pdfResponse.ok && pdfResponse.headers.get('content-type')?.includes('pdf')) {
          const arrayBuffer = await pdfResponse.arrayBuffer();
          const pdfBuffer = Buffer.from(arrayBuffer);

          // VALIDATE: Check if this PDF actually matches the DOI
          const isValid = await validatePdfMatchesDoi(pdfBuffer, doi);

          if (isValid) {
            return {
              success: true,
              pdfBuffer,
              source: 'Web Search (validated)'
            };
          } else {
            console.log(`[Web Search] Skipping PDF ${pdfUrl} - validation failed`);
            continue;
          }
        }
      } catch (e) {
        continue;
      }
    }

    return { success: false, error: 'No validated PDF found in search results' };
  } catch (error: any) {
    return { success: false, error: `Search error: ${error.message}` };
  }
}

/**
 * Tier 3: Python fallback with SSL bypass and additional sources
 */
async function fetchFromPythonFallback(doi: string): Promise<PdfResult> {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    console.log('[PDF Fetcher] 🐍 Running Python fallback with SSL bypass...');

    const scriptPath = new URL('./pdf-fetcher-python-fallback.py', import.meta.url).pathname.slice(1); // Remove leading /

    const { stdout, stderr } = await execFileAsync('python', [scriptPath, doi], {
      timeout: 60000, // 60 seconds
      maxBuffer: 50 * 1024 * 1024 // 50MB
    });

    if (stderr) {
      console.log(`[PDF Fetcher] Python stderr: ${stderr}`);
    }

    const result = JSON.parse(stdout);

    if (result.success && result.pdf_base64) {
      const pdfBuffer = Buffer.from(result.pdf_base64, 'base64');
      return {
        success: true,
        pdfBuffer,
        source: result.source
      };
    }

    return { success: false, error: result.error || 'Python fallback failed' };
  } catch (error: any) {
    return { success: false, error: `Python fallback error: ${error.message}` };
  }
}

/**
 * Try all sources with tiered parallel approach for maximum speed
 */
export async function fetchPdfForDoi(doi: string): Promise<PdfResult> {
  console.log(`[PDF Fetcher] Attempting to fetch PDF for DOI: ${doi}`);

  // TIER 1: Try all legal/academic sources in PARALLEL
  console.log(`[PDF Fetcher] ⚡ Tier 1: Trying 6 legal sources in parallel...`);
  const tier1Sources = [
    { name: 'Unpaywall', fn: fetchFromUnpaywall },
    { name: 'OpenAlex', fn: fetchFromOpenAlex },
    { name: 'Semantic Scholar', fn: fetchFromSemanticScholar },
    { name: 'CORE', fn: fetchFromCore },
    { name: 'Open Access Button', fn: fetchFromOpenAccessButton },
    { name: 'arXiv', fn: fetchFromArxiv },
  ];

  const tier1Results = await Promise.allSettled(
    tier1Sources.map(source =>
      source.fn(doi).then(result => ({ ...result, sourceName: source.name }))
    )
  );

  // Find first successful result from Tier 1
  for (const result of tier1Results) {
    if (result.status === 'fulfilled' && result.value.success) {
      console.log(`[PDF Fetcher] ✅ Success from ${result.value.sourceName}`);
      return result.value;
    }
  }

  console.log(`[PDF Fetcher] ❌ All Tier 1 sources failed`);

  // TIER 2: Try Sci-Hub + LibGen + Anna's Archive + Web Search in PARALLEL
  console.log(`[PDF Fetcher] ⚡ Tier 2: Trying Sci-Hub + LibGen + Anna's Archive + Web Search in parallel...`);
  const tier2Sources = [
    { name: 'Sci-Hub', fn: fetchFromSciHub },
    { name: 'LibGen', fn: fetchFromLibGenScimag },
    { name: 'Anna\'s Archive', fn: fetchFromAnnasArchive },
    { name: 'Web Search', fn: fetchFromGoogleScholar },
  ];

  const tier2Results = await Promise.allSettled(
    tier2Sources.map(source =>
      source.fn(doi).then(result => ({ ...result, sourceName: source.name }))
    )
  );

  // Find first successful result from Tier 2
  for (const result of tier2Results) {
    if (result.status === 'fulfilled' && result.value.success) {
      console.log(`[PDF Fetcher] ✅ Success from ${result.value.sourceName}`);
      return result.value;
    }
  }

  console.log(`[PDF Fetcher] ❌ Tier 2 sources failed`);

  // TIER 3: Python fallback with SSL bypass + additional sources + PMC HTML full text
  console.log(`[PDF Fetcher] ⚡ Tier 3: Python fallback (Unpaywall SSL bypass, LibKey, PMC, PMC Direct API, Europe PMC, bioRxiv, DOI.org, PMC Full Text HTML)...`);
  const tier3Result = await fetchFromPythonFallback(doi);

  if (tier3Result.success) {
    console.log(`[PDF Fetcher] ✅ Success from Python fallback: ${tier3Result.source}`);
    return tier3Result;
  }

  console.log(`[PDF Fetcher] ❌ All 3 tiers exhausted`);

  return {
    success: false,
    error: 'Failed to fetch PDF from all sources (Tier 1: Unpaywall, OpenAlex, Semantic Scholar, CORE, Open Access Button, arXiv; Tier 2: Sci-Hub, LibGen, Anna\'s Archive, Web Search; Tier 3: Python fallback with 8 sources including LibKey, PMC Direct API, and PMC HTML scraping)'
  };
}

/**
 * Fetch paper content from direct URL (publisher page)
 * Supports both PDF direct links and HTML article pages
 */
export async function fetchFromUrl(url: string): Promise<PdfResult> {
  console.log(`[PDF Fetcher] Attempting to fetch from URL: ${url}`);

  try {
    // First, try to fetch the URL directly
    const response = await fetchWithTimeout(url, {
      timeoutMs: 30000,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8',
      }
    });

    if (!response.ok) {
      return { success: false, error: `Failed to fetch URL: ${response.status} ${response.statusText}` };
    }

    const contentType = response.headers.get('content-type') || '';

    // Case 1: Direct PDF link
    if (contentType.includes('pdf')) {
      console.log('[PDF Fetcher] ✅ URL returned PDF directly');
      const arrayBuffer = await response.arrayBuffer();
      return {
        success: true,
        pdfBuffer: Buffer.from(arrayBuffer),
        source: 'Direct URL (PDF)'
      };
    }

    // Case 2: HTML page - parse it to find PDF link or extract article content
    if (contentType.includes('html')) {
      const html = await response.text();
      console.log(`[PDF Fetcher] Got HTML page (${html.length} chars), looking for PDF link...`);

      // Try to find PDF download link in the HTML
      // Priority order: article-specific patterns first, generic patterns last
      const pdfLinkPatterns = [
        // High priority: Article-specific PDF patterns
        /href=["']([^"']*article[^"']*\.pdf[^"']*)["']/gi,
        /href=["']([^"']*fulltext[^"']*\.pdf[^"']*)["']/gi,
        /href=["']([^"']*download[^"']*article[^"']*)["']/gi,
        /href=["']([^"']*\/pdf\/[^"']+)["']/gi,
        /data-pdf-url=["']([^"']*)["']/gi,
        // Medium priority: Generic download patterns
        /href=["']([^"']*download[^"']*\.pdf[^"']*)["']/gi,
        // Low priority: Any PDF link (last resort)
        /href=["']([^"']*\.pdf)["']/gi,
      ];

      // Keywords to SKIP (non-article PDFs)
      const skipKeywords = [
        'announcement', 'guidelines', 'advertisement', 'instruction',
        'author', 'reviewer', 'submission', 'template', 'copyright',
        'supplement', 'appendix', 'policy', 'terms', 'privacy', 'position'
      ];

      let pdfUrl: string | null = null;
      const allCandidates: string[] = [];

      // Collect all PDF candidates
      for (const pattern of pdfLinkPatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          let candidateUrl = match[1];

          // Make absolute URL if relative
          if (candidateUrl.startsWith('/')) {
            const urlObj = new URL(url);
            candidateUrl = `${urlObj.origin}${candidateUrl}`;
          } else if (!candidateUrl.startsWith('http')) {
            const urlObj = new URL(url);
            candidateUrl = `${urlObj.origin}/${candidateUrl}`;
          }

          // Decode URL for keyword checking
          const decodedUrl = decodeURIComponent(candidateUrl).toLowerCase();

          // Skip obviously wrong links
          if (skipKeywords.some(kw => decodedUrl.includes(kw))) {
            console.log(`[PDF Fetcher] Skipping non-article PDF: ${candidateUrl.substring(0, 80)}...`);
            continue;
          }
          if (decodedUrl.includes('citation') || decodedUrl.includes('abstract')) continue;

          // Add to candidates if not already present
          if (!allCandidates.includes(candidateUrl)) {
            allCandidates.push(candidateUrl);
          }
        }
      }

      // Use the first valid candidate (patterns are ordered by priority)
      if (allCandidates.length > 0) {
        pdfUrl = allCandidates[0];
        console.log(`[PDF Fetcher] Selected from ${allCandidates.length} candidates: ${pdfUrl}`);
      }

      // If we found a PDF link, try to download it
      if (pdfUrl) {
        console.log(`[PDF Fetcher] Found PDF link: ${pdfUrl}`);
        try {
          const pdfResponse = await fetchWithTimeout(pdfUrl, {
            timeoutMs: 30000,
            redirect: 'follow',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': url, // Some sites require referer
            }
          });

          if (pdfResponse.ok) {
            const pdfContentType = pdfResponse.headers.get('content-type') || '';
            if (pdfContentType.includes('pdf')) {
              console.log('[PDF Fetcher] ✅ Successfully downloaded PDF from page');
              const arrayBuffer = await pdfResponse.arrayBuffer();
              return {
                success: true,
                pdfBuffer: Buffer.from(arrayBuffer),
                source: 'URL Page (PDF link extracted)'
              };
            }
          }
        } catch (e) {
          console.log(`[PDF Fetcher] Failed to download PDF from link: ${e}`);
        }
      }

      // No PDF found - check if HTML extraction would be sufficient
      const quickExtract = extractArticleFromHtml(html);

      if (quickExtract.length >= 500) {
        console.log(`[PDF Fetcher] HTML extraction sufficient (${quickExtract.length} chars)`);
        return {
          success: true,
          htmlContent: html,
          source: 'URL Page (HTML)'
        };
      }

      // HTML extraction failed - likely a JavaScript SPA
      console.log(`[PDF Fetcher] HTML extraction insufficient (${quickExtract.length} chars), trying JS rendering...`);

      const renderedHtml = await renderJavaScriptPage(url);
      if (renderedHtml && renderedHtml.length > 1000) {
        const renderedExtract = extractArticleFromHtml(renderedHtml);
        if (renderedExtract.length >= 500) {
          console.log(`[PDF Fetcher] JS-rendered content (${renderedExtract.length} chars)`);
          return {
            success: true,
            htmlContent: renderedHtml,
            source: 'URL Page (JS Rendered)'
          };
        }
      }

      // Last resort - return whatever HTML we have
      console.log('[PDF Fetcher] All extraction methods failed, returning raw HTML');
      return {
        success: true,
        htmlContent: html,
        source: 'URL Page (HTML - Limited)'
      };
    }

    return { success: false, error: `Unsupported content type: ${contentType}` };

  } catch (error: any) {
    return { success: false, error: `URL fetch error: ${error.message}` };
  }
}

/**
 * Render JavaScript-heavy pages using multiple fallback methods:
 * 1. Happy-DOM (lightweight - works on all platforms including Windows)
 * 2. ScraperAPI (cloud rendering - works everywhere)
 * 3. Lightpanda (local binary - Linux only for Render)
 */
async function renderJavaScriptPage(url: string): Promise<string | null> {
  // Method 1: Try Happy-DOM (lightweight, works everywhere, supports Angular)
  try {
    console.log('[JS Render] Trying Happy-DOM...');
    const { Window } = await import('happy-dom');

    // Fetch the initial HTML
    const response = await fetchWithTimeout(url, {
      timeoutMs: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();

    // Create Happy-DOM window with the URL context
    const window = new Window({
      url: url,
      width: 1920,
      height: 1080,
      settings: {
        disableJavaScriptFileLoading: false,
        disableCSSFileLoading: true, // Speed up - we don't need CSS
        disableJavaScriptEvaluation: false,
        navigator: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    });

    const document = window.document;

    // Set the HTML content
    document.write(html);

    // Wait for scripts to execute (Angular/React hydration)
    // Happy-DOM executes scripts synchronously but we need to wait for async operations
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds for Angular to bootstrap

    // Also wait for any pending async tasks
    await window.happyDOM.waitUntilComplete();

    // Get the rendered HTML
    const renderedHtml = document.documentElement.outerHTML;

    // Clean up
    await window.happyDOM.close();

    console.log(`[Happy-DOM] Rendered ${renderedHtml.length} chars`);

    if (renderedHtml.length > 1000) {
      return renderedHtml;
    }

  } catch (error: any) {
    console.log(`[Happy-DOM] Error: ${error.message}`);
  }

  // Method 2: Try ScraperAPI (free tier: 1000 requests/month)
  const scraperApiKey = process.env.SCRAPER_API_KEY;
  if (scraperApiKey) {
    try {
      console.log('[JS Render] Trying ScraperAPI...');
      const apiUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}&render=true`;
      const response = await fetch(apiUrl, { timeout: 60000 } as any);
      if (response.ok) {
        const html = await response.text();
        console.log(`[JS Render] ScraperAPI returned ${html.length} chars`);
        if (html.length > 1000) return html;
      }
    } catch (error: any) {
      console.log(`[JS Render] ScraperAPI error: ${error.message}`);
    }
  }

  // Method 3: Try Lightpanda (Linux only - for Render deployment)
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    const execFileAsync = promisify(execFile);

    // Only attempt on Linux
    if (os.platform() === 'linux') {
      const binaryPath = path.join(process.cwd(), 'bin', 'lightpanda');

      try {
        await fs.access(binaryPath);
      } catch {
        console.log('[Lightpanda] Binary not found, attempting download...');
        const binDir = path.join(process.cwd(), 'bin');
        await fs.mkdir(binDir, { recursive: true });

        const downloadUrl = 'https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-x86_64-linux';
        const response = await fetch(downloadUrl, { redirect: 'follow' });
        if (!response.ok) {
          console.log('[Lightpanda] Failed to download binary');
          throw new Error('Download failed');
        }

        const arrayBuffer = await response.arrayBuffer();
        await fs.writeFile(binaryPath, Buffer.from(arrayBuffer));
        await fs.chmod(binaryPath, 0o755);
        console.log('[Lightpanda] Binary downloaded and installed');
      }

      console.log(`[Lightpanda] Rendering: ${url}`);
      const { stdout } = await execFileAsync(binaryPath, ['fetch', '--dump', url], {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024
      });

      console.log(`[Lightpanda] Rendered ${stdout.length} chars`);
      return stdout;
    } else {
      console.log('[Lightpanda] Skipping - not Linux (Windows/Mac not supported)');
    }

  } catch (error: any) {
    console.log(`[Lightpanda] Error: ${error.message}`);
  }

  console.log('[JS Render] All JS rendering methods exhausted');
  return null;
}

/**
 * Extract article data from Angular Universal ng-state (for SPAs like JAPI)
 * Returns the article HTML content if found, null otherwise
 */
function extractFromAngularState(html: string): string | null {
  try {
    const ngStateMatch = html.match(/<script id="ng-state" type="application\/json">([\s\S]*?)<\/script>/);
    if (!ngStateMatch) return null;

    const json = JSON.parse(ngStateMatch[1]);

    // Get first key (usually contains article data)
    const keys = Object.keys(json).filter(k => !k.startsWith('__'));
    if (keys.length === 0) return null;

    const articleData = json[keys[0]]?.b || json[keys[0]];
    if (!articleData) return null;

    // Build article content from structured data
    const parts: string[] = [];

    // Title
    if (articleData.article_title) {
      parts.push(`# ${articleData.article_title}`);
    }

    // Authors
    if (articleData.authors && Array.isArray(articleData.authors)) {
      const authorNames = articleData.authors.map((a: any) => a.name).filter(Boolean);
      if (authorNames.length > 0) {
        parts.push(`\n**Authors:** ${authorNames.join(', ')}`);
      }
    }

    // Publication info
    if (articleData.article_year || articleData.article_volume) {
      const pubInfo = [
        articleData.article_year ? `Year: ${articleData.article_year}` : '',
        articleData.article_volume ? `Volume: ${articleData.article_volume}` : '',
        articleData.article_issue ? `Issue: ${articleData.article_issue}` : '',
        articleData.article_pages ? `Pages: ${articleData.article_pages}` : '',
      ].filter(Boolean).join(', ');
      if (pubInfo) parts.push(`\n**${pubInfo}**`);
    }

    // Main HTML content (most important!)
    if (articleData.html && articleData.html.length > 100) {
      // Convert HTML to readable text
      const articleText = articleData.html
        .replace(/<section[^>]*class="[^"]*abstract[^"]*"[^>]*>/gi, '\n## ABSTRACT\n')
        .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
        .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
        .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
        .replace(/<\/section>/gi, '\n')
        .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      parts.push('\n' + articleText);
    }

    const result = parts.join('\n');
    if (result.length > 500) {
      console.log(`[Angular State] Extracted ${result.length} chars from ng-state`);
      return result;
    }

    return null;
  } catch (error: any) {
    console.log(`[Angular State] Parse error: ${error.message}`);
    return null;
  }
}

/**
 * Extract article text from HTML content
 * Removes navigation, ads, headers/footers to get clean article text
 */
export function extractArticleFromHtml(html: string): string {
  // First try Angular Universal ng-state (for SPAs like JAPI)
  const angularContent = extractFromAngularState(html);
  if (angularContent && angularContent.length > 500) {
    return angularContent;
  }

  // Fall back to standard HTML extraction
  // First, remove script and style tags
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, ''); // Remove HTML comments

  // Try to find article content - multiple strategies
  let articleContent = '';

  // Strategy 1: Look for article-specific containers (JAPI and similar sites)
  const articleSelectors = [
    // JAPI-specific patterns
    /<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
    /<div[^>]*class="[^"]*full-text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*article-body[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    // Generic article patterns
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
    /<div[^>]*id="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  for (const pattern of articleSelectors) {
    pattern.lastIndex = 0; // Reset regex
    const match = pattern.exec(cleanHtml);
    if (match && match[1] && match[1].length > 500) {
      articleContent = match[1];
      console.log(`[HTML Extractor] Found content with pattern, length: ${articleContent.length}`);
      break;
    }
  }

  // Strategy 2: If no article container found, extract all paragraph and heading content
  if (!articleContent || articleContent.length < 500) {
    console.log('[HTML Extractor] No article container found, trying body text extraction...');

    // Extract body content
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(cleanHtml);
    if (bodyMatch) {
      // Remove nav, header, footer, aside elements
      let bodyContent = bodyMatch[1]
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
        .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
        .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
        .replace(/<input[^>]*>/gi, '')
        .replace(/<select[^>]*>[\s\S]*?<\/select>/gi, '');

      // Convert to text - this gets ALL visible text
      const bodyText = bodyContent
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (bodyText.length > 1000) {
        console.log(`[HTML Extractor] Body text extraction got ${bodyText.length} chars`);
        articleContent = bodyText;
      }
    }
  }

  // Strategy 3: If still not enough, extract all paragraphs
  if (!articleContent || articleContent.length < 500) {
    console.log('[HTML Extractor] Trying paragraph extraction...');

    // Extract title
    const titleMatch = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(cleanHtml);
    const title = titleMatch ? titleMatch[1] : '';

    // Extract all meaningful content: headings, paragraphs, lists
    const contentParts: string[] = [];

    if (title) {
      contentParts.push(`# ${title.replace(/<[^>]+>/g, '').trim()}`);
    }

    // Extract h2-h6 headings and their following content
    const sectionPattern = /<h([2-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
    let sectionMatch;
    while ((sectionMatch = sectionPattern.exec(cleanHtml)) !== null) {
      const headingText = sectionMatch[2].replace(/<[^>]+>/g, '').trim();
      if (headingText && headingText.length > 2) {
        contentParts.push(`\n## ${headingText}\n`);
      }
    }

    // Extract all paragraphs
    const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pMatch;
    while ((pMatch = paragraphPattern.exec(cleanHtml)) !== null) {
      const pText = pMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pText && pText.length > 20) { // Skip very short paragraphs
        contentParts.push(pText);
      }
    }

    // Extract list items
    const listPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = listPattern.exec(cleanHtml)) !== null) {
      const liText = liMatch[1].replace(/<[^>]+>/g, '').trim();
      if (liText && liText.length > 10) {
        contentParts.push(`• ${liText}`);
      }
    }

    articleContent = contentParts.join('\n\n');
  }

  // Convert remaining HTML to plain text
  let text = articleContent
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<[^>]+>/g, '') // Remove all remaining HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#\d+;/g, '') // Remove numeric HTML entities
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .replace(/[ \t]+/g, ' ') // Normalize spaces
    .trim();

  console.log(`[HTML Extractor] Final extracted text length: ${text.length} chars`);
  return text;
}

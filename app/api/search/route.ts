import { NextRequest, NextResponse } from 'next/server';
import { DOI_REGEX } from '../generate/route';

// Check if input is a DOI or URL
function parseInput(input: string): { type: 'doi' | 'url'; value: string } {
  // DOI pattern
  if (DOI_REGEX.test(input)) {
    return { type: 'doi', value: input };
  }
  // URL pattern
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return { type: 'url', value: input };
  }
  // Assume DOI if no protocol
  return { type: 'doi', value: input };
}

// Fetch metadata from DOI using CrossRef
async function fetchDOIMetadata(doi: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`CrossRef returned ${response.status}`);
    }

    const data = await response.json();
    const work = data.message;

    return {
      title: work.title?.[0] || 'Unknown Title',
      authors: work.author?.map((a: { given?: string; family?: string }) => `${a.given || ''} ${a.family || ''}`).join(', ') || 'Unknown Authors',
      journal: work['container-title']?.[0] || 'Unknown Journal',
      year: work.published?.['date-parts']?.[0]?.[0]?.toString() || 'Unknown Year',
      doi: doi,
      sourceType: 'DOI (CrossRef)',
    };
  } catch (error) {
    console.error('CrossRef lookup failed:', error);
    return null;
  }
}

// Fetch metadata from URL by scraping
async function fetchURLMetadata(url: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`URL fetch returned ${response.status}`);
    }

    const html = await response.text();

    // Try to extract from Angular state (for JAPI)
    const ngStateMatch = html.match(/<script id="ng-state" type="application\/json">([\s\S]*?)<\/script>/);
    if (ngStateMatch) {
      try {
        const json = JSON.parse(ngStateMatch[1]);
        const keys = Object.keys(json).filter((k: string) => !k.startsWith('__'));
        if (keys.length > 0) {
          const articleData = json[keys[0]]?.b || json[keys[0]];
          if (articleData) {
            return {
              title: articleData.title || articleData.articleTitle || 'Unknown Title',
              authors: articleData.authors || articleData.authorNames || 'Unknown Authors',
              journal: articleData.journalName || articleData.journal || 'Unknown Journal',
              year: articleData.year || articleData.publicationYear || 'Unknown Year',
              doi: articleData.doi || '',
              sourceType: 'URL (Angular State)',
            };
          }
        }
      } catch {
        // Continue to HTML parsing
      }
    }

    // Fall back to basic HTML parsing
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/ \| .*$/, '').trim() : 'Unknown Title';

    return {
      title,
      authors: 'See full paper',
      journal: new URL(url).hostname.replace('www.', ''),
      year: new Date().getFullYear().toString(),
      doi: '',
      sourceType: 'URL (HTML)',
    };
  } catch (error) {
    console.error('URL fetch failed:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input } = body;

    if (!input) {
      return NextResponse.json({ success: false, error: 'Input is required' }, { status: 400 });
    }

    const parsed = parseInput(input.trim());
    let metadata;

    if (parsed.type === 'doi') {
      metadata = await fetchDOIMetadata(parsed.value);
    } else {
      metadata = await fetchURLMetadata(parsed.value);
    }

    if (!metadata) {
      return NextResponse.json({
        success: false,
        error: 'Could not fetch paper metadata. Please check the DOI or URL.'
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, metadata });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({
      success: false,
      error: 'Search failed. Please try again.'
    }, { status: 500 });
  }
}

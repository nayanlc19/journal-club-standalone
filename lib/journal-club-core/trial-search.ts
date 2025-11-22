/**
 * Trial Search - Multi-source trial name to DOI resolution
 * Searches OpenAlex and Crossref for medical research papers
 */

export interface TrialSearchResult {
  doi: string;
  title: string;
  authors: string;
  journal: string;
  year: number;
  citationCount?: number;
  source: 'openalex' | 'crossref';
}

async function searchOpenAlex(query: string): Promise<TrialSearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.openalex.org/works?search=${encodedQuery}&filter=type:article&per_page=5&sort=cited_by_count:desc`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'JournalClubV2/1.0' }
    });

    if (!response.ok) return [];

    const data = await response.json();
    
    return data.results.map((work: any) => ({
      doi: work.doi?.replace('https://doi.org/', '') || '',
      title: work.title || 'Unknown title',
      authors: work.authorships?.slice(0, 3).map((a: any) => a.author.display_name).join(', ') + 
               (work.authorships?.length > 3 ? ' et al.' : ''),
      journal: work.primary_location?.source?.display_name || 'Unknown journal',
      year: work.publication_year || 0,
      citationCount: work.cited_by_count || 0,
      source: 'openalex' as const,
    })).filter((r: TrialSearchResult) => r.doi);
  } catch (error) {
    console.error('[OpenAlex] Error:', error);
    return [];
  }
}

async function searchCrossref(query: string): Promise<TrialSearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.crossref.org/works?query=${encodedQuery}&rows=5&sort=relevance&filter=type:journal-article`;
    
    const response = await fetch(url);

    if (!response.ok) return [];

    const data = await response.json();
    
    return data.message.items.map((item: any) => ({
      doi: item.DOI || '',
      title: item.title?.[0] || 'Unknown title',
      authors: item.author?.slice(0, 3).map((a: any) => `${a.given} ${a.family}`).join(', ') +
               (item.author?.length > 3 ? ' et al.' : ''),
      journal: item['container-title']?.[0] || 'Unknown journal',
      year: item.published?.['date-parts']?.[0]?.[0] || 0,
      citationCount: item['is-referenced-by-count'] || 0,
      source: 'crossref' as const,
    })).filter((r: TrialSearchResult) => r.doi);
  } catch (error) {
    console.error('[Crossref] Error:', error);
    return [];
  }
}

export async function searchTrialByName(query: string): Promise<TrialSearchResult[]> {
  console.log(`[Trial Search] Searching for: "${query}"`);
  
  const [openalexResults, crossrefResults] = await Promise.all([
    searchOpenAlex(query),
    searchCrossref(query),
  ]);

  const allResults = [...openalexResults, ...crossrefResults];
  const uniqueResults = new Map<string, TrialSearchResult>();
  
  for (const result of allResults) {
    const doi = result.doi.toLowerCase();
    if (!uniqueResults.has(doi)) {
      uniqueResults.set(doi, result);
    }
  }

  const sortedResults = Array.from(uniqueResults.values())
    .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
    .slice(0, 5);

  console.log(`[Trial Search] Found ${sortedResults.length} unique results`);
  return sortedResults;
}

export function isDOI(input: string): boolean {
  return /^10\.\d{4,}\/\S+$/i.test(input.trim());
}

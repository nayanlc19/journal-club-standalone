"""
Robust PDF Fetcher with SSL Bypass and Additional Sources
Fallback fetcher when Node.js fetch fails due to SSL issues
Uses niquests (modern requests alternative) for better performance
"""

import niquests as requests
import sys
import json
from urllib.parse import quote
from bs4 import BeautifulSoup

# Timeout for requests
TIMEOUT = 30

def fetch_from_unpaywall(doi):
    """Fetch from Unpaywall with SSL bypass"""
    try:
        api_url = f"https://api.unpaywall.org/v2/{quote(doi)}?email=nayanlc19@gmail.com"
        import sys
        print(f"[DEBUG] Trying Unpaywall: {api_url}", file=sys.stderr)
        response = requests.get(api_url, timeout=10, verify=False)
        print(f"[DEBUG] Unpaywall response: {response.status_code}", file=sys.stderr)

        if not response.ok:
            return None

        data = response.json()
        oa_locations = [loc for loc in data.get('oa_locations', []) if loc.get('url_for_pdf')]

        for loc in oa_locations:
            try:
                pdf_response = requests.get(
                    loc['url_for_pdf'],
                    timeout=TIMEOUT,
                    verify=False,
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                )

                if pdf_response.ok and 'application/pdf' in pdf_response.headers.get('content-type', ''):
                    return {
                        'success': True,
                        'pdf': pdf_response.content,
                        'source': f"Unpaywall-Python ({loc.get('host_type', 'unknown')})"
                    }
            except Exception:
                continue

        return None
    except Exception as e:
        return None

def fetch_from_pubmed_central(doi):
    """Fetch from PubMed Central"""
    try:
        # Search PMC for the DOI
        search_url = f"https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids={quote(doi)}&format=json"
        search_response = requests.get(search_url, timeout=10, verify=False)

        if not search_response.ok:
            return None

        data = search_response.json()
        records = data.get('records', [])

        if not records or 'pmcid' not in records[0]:
            return None

        pmcid = records[0]['pmcid']

        # Fetch PDF from PMC
        pdf_url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/pdf/"
        pdf_response = requests.get(
            pdf_url,
            timeout=TIMEOUT,
            verify=False,
            headers={'User-Agent': 'Mozilla/5.0'},
            allow_redirects=True
        )

        if pdf_response.ok and 'application/pdf' in pdf_response.headers.get('content-type', ''):
            return {
                'success': True,
                'pdf': pdf_response.content,
                'source': 'PubMed Central'
            }

        return None
    except Exception:
        return None

def fetch_from_europe_pmc(doi):
    """Fetch from Europe PMC"""
    try:
        api_url = f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:{quote(doi)}&format=json"
        response = requests.get(api_url, timeout=10, verify=False)

        if not response.ok:
            return None

        data = response.json()
        results = data.get('resultList', {}).get('result', [])

        if not results:
            return None

        result = results[0]

        # Check for full text links
        if result.get('isOpenAccess') == 'Y' and result.get('fullTextUrlList'):
            for url_info in result['fullTextUrlList'].get('fullTextUrl', []):
                if url_info.get('documentStyle') == 'pdf':
                    pdf_url = url_info.get('url')
                    if pdf_url:
                        try:
                            pdf_response = requests.get(
                                pdf_url,
                                timeout=TIMEOUT,
                                verify=False,
                                headers={'User-Agent': 'Mozilla/5.0'}
                            )

                            if pdf_response.ok and 'application/pdf' in pdf_response.headers.get('content-type', ''):
                                return {
                                    'success': True,
                                    'pdf': pdf_response.content,
                                    'source': 'Europe PMC'
                                }
                        except Exception:
                            continue

        return None
    except Exception:
        return None

def fetch_from_doi_org_redirect(doi):
    """Follow DOI.org redirects to find PDF"""
    try:
        doi_url = f"https://doi.org/{doi}"
        response = requests.get(
            doi_url,
            timeout=10,
            verify=False,
            allow_redirects=True,
            headers={'User-Agent': 'Mozilla/5.0'}
        )

        final_url = response.url

        # Try common PDF URL patterns
        pdf_urls = [
            final_url.replace('/full', '/pdf'),
            final_url.replace('/abstract', '/pdf'),
            final_url + '.pdf',
            final_url + '/pdf',
        ]

        for pdf_url in pdf_urls:
            try:
                pdf_response = requests.get(
                    pdf_url,
                    timeout=TIMEOUT,
                    verify=False,
                    headers={'User-Agent': 'Mozilla/5.0'}
                )

                if pdf_response.ok and 'application/pdf' in pdf_response.headers.get('content-type', ''):
                    return {
                        'success': True,
                        'pdf': pdf_response.content,
                        'source': 'DOI.org redirect'
                    }
            except Exception:
                continue

        return None
    except Exception:
        return None

def fetch_from_libkey(doi):
    """Fetch from LibKey resolver (checks multiple sources)"""
    try:
        # LibKey API endpoint
        api_url = f"https://public-api.thirdiron.com/public/v1/libraries/0/articles/doi/{quote(doi)}"
        response = requests.get(api_url, timeout=10, verify=False)

        if not response.ok:
            return None

        data = response.json()

        # Check for full text links
        if 'fullTextFile' in data and data['fullTextFile']:
            pdf_url = data['fullTextFile']

            pdf_response = requests.get(
                pdf_url,
                timeout=TIMEOUT,
                verify=False,
                headers={'User-Agent': 'Mozilla/5.0'},
                allow_redirects=True
            )

            if pdf_response.ok and 'application/pdf' in pdf_response.headers.get('content-type', ''):
                return {
                    'success': True,
                    'pdf': pdf_response.content,
                    'source': 'LibKey Resolver'
                }

        return None
    except Exception:
        return None

def fetch_from_direct_pmc_api(doi):
    """Fetch from PMC using direct API with PMCID lookup"""
    try:
        # Use E-utilities to get PMCID from DOI
        search_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term={quote(doi)}&retmode=json"
        search_response = requests.get(search_url, timeout=10, verify=False)

        if not search_response.ok:
            return None

        data = search_response.json()
        id_list = data.get('esearchresult', {}).get('idlist', [])

        if not id_list:
            return None

        pmcid = f"PMC{id_list[0]}"

        # Try direct PDF download from PMC FTP
        pdf_url = f"https://ftp.ncbi.nlm.nih.gov/pub/pmc/oa_pdf/{pmcid[3:5]}/{pmcid[5:7]}/{pmcid}.PMC001xxxxxx.pdf"

        # Also try the web interface
        web_pdf_url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/pdf/"

        for url in [web_pdf_url, pdf_url]:
            try:
                pdf_response = requests.get(
                    url,
                    timeout=TIMEOUT,
                    verify=False,
                    headers={'User-Agent': 'Mozilla/5.0'},
                    allow_redirects=True
                )

                if pdf_response.ok and 'application/pdf' in pdf_response.headers.get('content-type', ''):
                    return {
                        'success': True,
                        'pdf': pdf_response.content,
                        'source': 'PMC Direct API'
                    }
            except Exception:
                continue

        return None
    except Exception:
        return None

def fetch_from_biorxiv_medrxiv(doi):
    """Fetch from bioRxiv/medRxiv"""
    try:
        # bioRxiv/medRxiv DOIs have specific format
        if 'biorxiv' in doi.lower() or 'medrxiv' in doi.lower():
            # Extract the article ID
            parts = doi.split('/')
            if len(parts) >= 2:
                base = 'biorxiv' if 'biorxiv' in doi.lower() else 'medrxiv'
                article_id = parts[-1]

                pdf_url = f"https://www.{base}.org/content/{doi}.full.pdf"

                pdf_response = requests.get(
                    pdf_url,
                    timeout=TIMEOUT,
                    verify=False,
                    headers={'User-Agent': 'Mozilla/5.0'}
                )

                if pdf_response.ok and 'application/pdf' in pdf_response.headers.get('content-type', ''):
                    return {
                        'success': True,
                        'pdf': pdf_response.content,
                        'source': base.title()
                    }

        return None
    except Exception:
        return None

def fetch_html_from_pmc(doi):
    """Fetch full text from PMC using E-utilities XML API (free, official NCBI API)"""
    try:
        print(f"[DEBUG] HTML Scraping: Trying PMC for {doi}", file=sys.stderr)
        # Get PMCID from DOI
        search_url = f"https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids={quote(doi)}&format=json"
        print(f"[DEBUG] HTML Scraping: Fetching PMCID", file=sys.stderr)
        search_response = requests.get(search_url, timeout=10, verify=False)

        if not search_response.ok:
            return None

        data = search_response.json()
        records = data.get('records', [])

        if not records or 'pmcid' not in records[0]:
            print(f"[DEBUG] HTML Scraping: No PMCID found", file=sys.stderr)
            return None

        pmcid = records[0]['pmcid']
        print(f"[DEBUG] HTML Scraping: Found PMCID: {pmcid}", file=sys.stderr)

        # Use NCBI E-utilities efetch API (free, designed for programmatic access)
        # This gets the full XML of the article which includes all text
        efetch_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id={pmcid.replace('PMC', '')}&rettype=xml&retmode=text"
        print(f"[DEBUG] HTML Scraping: Fetching XML from E-utilities", file=sys.stderr)

        xml_response = requests.get(efetch_url, timeout=TIMEOUT, verify=False)

        if not xml_response.ok:
            print(f"[DEBUG] HTML Scraping: E-utilities fetch failed", file=sys.stderr)
            return None

        print(f"[DEBUG] HTML Scraping: Got XML ({len(xml_response.content)} bytes)", file=sys.stderr)

        # Parse XML and extract ALL text content
        soup = BeautifulSoup(xml_response.content, 'xml')

        # Extract title
        title_elem = soup.find('article-title')
        title_text = title_elem.get_text(strip=True) if title_elem else 'Research Article'

        # Remove unwanted elements (references, acknowledgments, etc.)
        for unwanted in soup.find_all(['ref-list', 'ack', 'fn-group', 'glossary']):
            unwanted.decompose()

        # Get all text with proper structure
        full_text = soup.get_text(separator='\n\n', strip=True)

        print(f"[DEBUG] HTML Scraping: Extracted {len(full_text)} characters", file=sys.stderr)

        # Convert to HTML
        import html
        escaped_text = html.escape(full_text)

        # Convert double newlines to paragraphs
        paragraphs = escaped_text.split('\n\n')
        formatted_text = ''.join(f'<p>{p.strip()}</p>\n' if p.strip() else '' for p in paragraphs)

        full_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{html.escape(title_text)}</title>
</head>
<body>
    <h1>{html.escape(title_text)}</h1>
    <div class="content">
        {formatted_text}
    </div>
</body>
</html>"""

        print(f"[DEBUG] HTML Scraping: Created HTML ({len(full_html)} chars)", file=sys.stderr)

        # Return HTML content as bytes (MarkItDown can process HTML)
        return {
            'success': True,
            'pdf': full_html.encode('utf-8'),
            'source': 'PMC Full Text (E-utilities XML)',
            'isHtml': True
        }

    except Exception as e:
        print(f"[DEBUG] HTML Scraping: Exception: {str(e)}", file=sys.stderr)
        return None

def fetch_html_from_journal_site(doi):
    """Universal HTML scraper for ANY journal (JAMA, Nature, Lancet, BMJ, etc.)
    Only returns content if full text is available (not just abstract)"""
    try:
        print(f"[DEBUG] Universal HTML Scraping: Trying journal site for {doi}", file=sys.stderr)

        # Resolve DOI to get publisher's page
        doi_url = f"https://doi.org/{doi}"
        response = requests.get(
            doi_url,
            timeout=15,
            verify=False,
            allow_redirects=True,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        )

        if not response.ok:
            print(f"[DEBUG] Universal HTML Scraping: Failed to resolve DOI", file=sys.stderr)
            return None

        final_url = response.url
        print(f"[DEBUG] Universal HTML Scraping: Resolved to {final_url}", file=sys.stderr)

        # Parse HTML content
        soup = BeautifulSoup(response.content, 'html.parser')

        # Remove unwanted elements
        for unwanted in soup.find_all(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', 'noscript']):
            unwanted.decompose()

        # Try multiple selectors for different publishers
        article_selectors = [
            # JAMA Network
            'article.article-full-text',
            'div.article-full-text-body',
            'div.article-content',
            # Nature
            'article.c-article-body',
            'div.c-article-section',
            # Lancet, BMJ, general
            'div.article-text',
            'div.fulltext-view',
            'div.article__body',
            'main article',
            'article',
            # Fallback to main content
            'main',
            'div#content',
            'div.content',
        ]

        article_content = None
        for selector in article_selectors:
            article_content = soup.select_one(selector)
            if article_content:
                print(f"[DEBUG] Universal HTML Scraping: Found content with selector: {selector}", file=sys.stderr)
                break

        if not article_content:
            print(f"[DEBUG] Universal HTML Scraping: No article content found", file=sys.stderr)
            return None

        # Extract all text
        full_text = article_content.get_text(separator='\n\n', strip=True)

        # Check if this is substantial content (not just abstract)
        # Abstract typically < 500 words, full text should be > 1000 words
        word_count = len(full_text.split())
        print(f"[DEBUG] Universal HTML Scraping: Extracted {len(full_text)} chars, {word_count} words", file=sys.stderr)

        if word_count < 800:  # Too short to be full text
            print(f"[DEBUG] Universal HTML Scraping: Content too short (likely abstract only)", file=sys.stderr)
            return None

        # Get title
        title = soup.find('h1')
        title_text = title.get_text(strip=True) if title else 'Research Article'

        # Convert to HTML format that MarkItDown can process
        import html
        escaped_text = html.escape(full_text)
        paragraphs = escaped_text.split('\n\n')
        formatted_text = ''.join(f'<p>{p.strip()}</p>\n' if p.strip() else '' for p in paragraphs)

        full_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{html.escape(title_text)}</title>
</head>
<body>
    <h1>{html.escape(title_text)}</h1>
    <div class="content">
        {formatted_text}
    </div>
</body>
</html>"""

        print(f"[DEBUG] Universal HTML Scraping: Created HTML ({len(full_html)} chars)", file=sys.stderr)

        return {
            'success': True,
            'pdf': full_html.encode('utf-8'),
            'source': f'Journal Site HTML ({final_url.split("/")[2]})',
        }

    except Exception as e:
        print(f"[DEBUG] Universal HTML Scraping: Exception: {str(e)}", file=sys.stderr)
        return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No DOI provided'}))
        sys.exit(1)

    doi = sys.argv[1]

    # Try all sources in order (Updated with LibKey, PMC Direct API, and HTML scraping)
    sources = [
        ('Unpaywall', fetch_from_unpaywall),
        ('LibKey Resolver', fetch_from_libkey),
        ('PubMed Central', fetch_from_pubmed_central),
        ('PMC Direct API', fetch_from_direct_pmc_api),
        ('Europe PMC', fetch_from_europe_pmc),
        ('bioRxiv/medRxiv', fetch_from_biorxiv_medrxiv),
        ('DOI.org redirect', fetch_from_doi_org_redirect),
        ('PMC HTML Full Text', fetch_html_from_pmc),  # PMC-specific HTML scraping
        ('Universal Journal HTML', fetch_html_from_journal_site),  # NEW: Works for JAMA, Nature, Lancet, BMJ, etc.
    ]

    for source_name, fetch_func in sources:
        try:
            result = fetch_func(doi)
            if result and result.get('success'):
                # Write PDF to stdout as base64
                import base64
                pdf_base64 = base64.b64encode(result['pdf']).decode('utf-8')
                print(json.dumps({
                    'success': True,
                    'source': result['source'],
                    'pdf_base64': pdf_base64
                }))
                sys.exit(0)
        except Exception:
            continue

    # All sources failed
    print(json.dumps({
        'success': False,
        'error': 'All Python fallback sources failed'
    }))
    sys.exit(1)

if __name__ == '__main__':
    main()

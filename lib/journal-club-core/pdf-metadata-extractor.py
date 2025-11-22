"""
PDF Metadata Extractor
Extracts title, author, page count from PDF
"""

import sys
import json
import fitz  # PyMuPDF

def extract_metadata(pdf_path):
    """Extract PDF metadata"""
    try:
        doc = fitz.open(pdf_path)

        metadata = doc.metadata or {}

        result = {
            'title': metadata.get('title', '').strip() or 'Unknown',
            'author': metadata.get('author', '').strip() or 'Unknown',
            'pages': doc.page_count,
            'subject': metadata.get('subject', '').strip(),
            'keywords': metadata.get('keywords', '').strip(),
        }

        doc.close()

        return result

    except Exception as e:
        return {
            'title': 'Unknown',
            'author': 'Unknown',
            'pages': 0,
            'error': str(e)
        }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No PDF path provided'}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    metadata = extract_metadata(pdf_path)

    print(json.dumps(metadata))

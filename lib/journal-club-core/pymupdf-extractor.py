"""
PyMuPDF-based Table and Figure Extractor
Alternative to PDFFigures2 - no Java required
"""

import fitz  # PyMuPDF
import json
import base64
import io
import time
import sys
import argparse
from PIL import Image
import re

class PyMuPDFExtractor:
    def __init__(self):
        self.table_keywords = [
            r'\bTable\s+\d+', r'\bTABLE\s+\d+',
            r'\bTable\s+[IVX]+', r'\bTABLE\s+[IVX]+',
            r'\bSupplementary Table', r'\bAppendix Table'
        ]
        self.figure_keywords = [
            r'\bFigure\s+\d+', r'\bFIGURE\s+\d+', r'\bFig\.\s+\d+',
            r'\bFigure\s+[IVX]+', r'\bFIGURE\s+[IVX]+',
            r'\bSupplementary Figure', r'\bAppendix Figure',
            r'\bDiagram\s+\d+', r'\bChart\s+\d+', r'\bGraph\s+\d+'
        ]

    def extract(self, pdf_path):
        """Extract tables and figures from PDF"""
        start_time = time.time()
        results = {
            'success': True,
            'figures': [],
            'processing_time': 0,
            'error': None
        }

        try:
            doc = fitz.open(pdf_path)
            print(f"[PyMuPDF] Processing {len(doc)} pages...", file=sys.stderr)

            for page_num in range(len(doc)):
                page = doc[page_num]

                # Get page text
                text = page.get_text()

                # Find tables and figures using regex
                tables_found = self.find_elements(text, self.table_keywords, 'table')
                figures_found = self.find_elements(text, self.figure_keywords, 'figure')

                # Extract images from the page
                image_list = page.get_images()

                # Process images (potential figures/tables)
                for img_index, img in enumerate(image_list):
                    # Get image data
                    xref = img[0]
                    pix = fitz.Pixmap(doc, xref)

                    # Skip very small images (likely icons or bullets)
                    if pix.width < 100 or pix.height < 100:
                        continue

                    # Convert to PIL Image
                    img_data = pix.tobytes("png")
                    img_pil = Image.open(io.BytesIO(img_data))

                    # Get image position on page
                    img_rect = page.get_image_bbox(img)

                    # Convert to base64
                    buffer = io.BytesIO()
                    img_pil.save(buffer, format='PNG')
                    img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

                    # Try to determine if it's a table or figure
                    element_type = 'figure'
                    caption = ''

                    # Check if there's table/figure text near this image
                    for table_match in tables_found:
                        if abs(img_rect.y1 - table_match['y']) < 50:  # Within 50 pixels
                            element_type = 'table'
                            caption = table_match['text']
                            break

                    if element_type == 'figure':
                        for fig_match in figures_found:
                            if abs(img_rect.y1 - fig_match['y']) < 50:
                                caption = fig_match['text']
                                break

                    results['figures'].append({
                        'type': element_type,
                        'pageNumber': page_num + 1,
                        'caption': caption or f'{element_type.title()} on page {page_num + 1}',
                        'bbox': {
                            'x1': img_rect.x0,
                            'y1': img_rect.y0,
                            'x2': img_rect.x1,
                            'y2': img_rect.y1,
                            'width': img_rect.x1 - img_rect.x0,
                            'height': img_rect.y1 - img_rect.y0
                        },
                        'image': f'data:image/png;base64,{img_base64}',
                        'source': 'pymupdf'
                    })

                # Also look for vector graphics (often used for charts/diagrams)
                drawings = page.get_drawings()
                if drawings:
                    # Render the page at high resolution
                    mat = fitz.Matrix(2, 2)  # 2x zoom
                    pix = page.get_pixmap(matrix=mat)

                    # Look for large drawing areas (likely figures)
                    for drawing in drawings:
                        if 'items' in drawing and len(drawing['items']) > 10:  # Complex drawing
                            # This is likely a chart or diagram
                            # Extract the region containing the drawing
                            rect = drawing.get('rect', page.rect)

                            # Skip if too small
                            if rect.width < 100 or rect.height < 100:
                                continue

                            # Crop the page to this region
                            clip = fitz.Rect(rect.x0 * 2, rect.y0 * 2, rect.x1 * 2, rect.y1 * 2)
                            pix_cropped = fitz.Pixmap(pix, clip)

                            # Convert to base64
                            img_data = pix_cropped.tobytes("png")
                            img_base64 = base64.b64encode(img_data).decode('utf-8')

                            results['figures'].append({
                                'type': 'figure',
                                'pageNumber': page_num + 1,
                                'caption': f'Diagram/Chart on page {page_num + 1}',
                                'bbox': {
                                    'x1': rect.x0,
                                    'y1': rect.y0,
                                    'x2': rect.x1,
                                    'y2': rect.y1,
                                    'width': rect.width,
                                    'height': rect.height
                                },
                                'image': f'data:image/png;base64,{img_base64}',
                                'source': 'pymupdf_drawing'
                            })

                print(f"[PyMuPDF] Page {page_num + 1}: Found {len([f for f in results['figures'] if f['pageNumber'] == page_num + 1])} elements", file=sys.stderr)

            doc.close()

        except Exception as e:
            results['success'] = False
            results['error'] = str(e)
            print(f"[PyMuPDF] Error: {e}", file=sys.stderr)

        results['processing_time'] = time.time() - start_time
        print(f"[PyMuPDF] Completed in {results['processing_time']:.2f}s", file=sys.stderr)
        print(f"[PyMuPDF] Total extracted: {len(results['figures'])} elements", file=sys.stderr)

        return results

    def find_elements(self, text, patterns, element_type):
        """Find tables or figures in text using regex patterns"""
        matches = []
        for pattern in patterns:
            for match in re.finditer(pattern, text):
                matches.append({
                    'text': match.group(),
                    'start': match.start(),
                    'end': match.end(),
                    'type': element_type,
                    'y': 0  # Would need more complex logic to get actual Y position
                })
        return matches


def main():
    parser = argparse.ArgumentParser(description='Extract tables and figures using PyMuPDF')
    parser.add_argument('pdf_path', help='Path to PDF file')
    args = parser.parse_args()

    extractor = PyMuPDFExtractor()
    results = extractor.extract(args.pdf_path)

    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
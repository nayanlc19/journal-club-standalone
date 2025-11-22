"""
PDFFigures2 Python Implementation
A Python port of AllenAI's PDFFigures2 core algorithms
No Java/Scala required!
"""

import fitz  # PyMuPDF
import json
import base64
import io
import time
import sys
import argparse
import re
import numpy as np
from PIL import Image
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from collections import defaultdict

@dataclass
class BoundingBox:
    """Represents a bounding box with coordinates"""
    x1: float
    y1: float
    x2: float
    y2: float

    def area(self) -> float:
        return (self.x2 - self.x1) * (self.y2 - self.y1)

    def overlaps(self, other: 'BoundingBox', threshold: float = 0.1) -> bool:
        """Check if this box overlaps with another"""
        if self.x2 < other.x1 or other.x2 < self.x1:
            return False
        if self.y2 < other.y1 or other.y2 < self.y1:
            return False

        # Calculate intersection
        inter_x1 = max(self.x1, other.x1)
        inter_y1 = max(self.y1, other.y1)
        inter_x2 = min(self.x2, other.x2)
        inter_y2 = min(self.y2, other.y2)

        if inter_x2 < inter_x1 or inter_y2 < inter_y1:
            return False

        inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)
        return inter_area / min(self.area(), other.area()) > threshold

    def expand(self, pixels: int = 10) -> 'BoundingBox':
        """Expand box by given pixels"""
        return BoundingBox(
            self.x1 - pixels,
            self.y1 - pixels,
            self.x2 + pixels,
            self.y2 + pixels
        )

@dataclass
class Figure:
    """Represents a detected figure or table"""
    figure_type: str  # 'Figure' or 'Table'
    name: str  # e.g., "Figure 1", "Table 2"
    caption: str
    page: int
    bbox: BoundingBox
    image_data: Optional[str] = None  # Base64 encoded

class PDFFigures2Python:
    """Python implementation of PDFFigures2 algorithms"""

    def __init__(self):
        # Patterns for detecting captions
        self.figure_patterns = [
            r'\b(Figure|Fig\.?)\s+(\d+|[IVX]+)\.?\s*',
            r'\b(FIGURE|FIG\.?)\s+(\d+|[IVX]+)\.?\s*',
            r'\b(Supplementary\s+Figure|Appendix\s+Figure)\s+(\S+)',
        ]

        self.table_patterns = [
            r'\b(Table|Tbl\.?)\s+(\d+|[IVX]+)\.?\s*',
            r'\b(TABLE|TBL\.?)\s+(\d+|[IVX]+)\.?\s*',
            r'\b(Supplementary\s+Table|Appendix\s+Table)\s+(\S+)',
        ]

        # Keywords that indicate continuation
        self.continuation_words = ['continued', 'cont.', "cont'd", 'continuation']

    def extract(self, pdf_path: str) -> Dict[str, Any]:
        """Main extraction method"""
        start_time = time.time()
        results = {
            'success': True,
            'figures': [],
            'processing_time': 0,
            'error': None
        }

        try:
            doc = fitz.open(pdf_path)
            print(f"[PDFFigures2-Py] Processing {len(doc)} pages...", file=sys.stderr)

            all_figures = []

            for page_num in range(len(doc)):
                page_figures = self._extract_from_page(doc, page_num)
                all_figures.extend(page_figures)

            # Post-process to merge multi-page figures/tables
            all_figures = self._merge_multipage_elements(all_figures)

            # Convert to output format
            for fig in all_figures:
                results['figures'].append({
                    'type': fig.figure_type.lower(),
                    'pageNumber': fig.page + 1,
                    'name': fig.name,
                    'caption': fig.caption,
                    'bbox': {
                        'x1': fig.bbox.x1,
                        'y1': fig.bbox.y1,
                        'x2': fig.bbox.x2,
                        'y2': fig.bbox.y2,
                        'width': fig.bbox.x2 - fig.bbox.x1,
                        'height': fig.bbox.y2 - fig.bbox.y1
                    },
                    'image': fig.image_data,
                    'source': 'pdffigures2-python'
                })

            doc.close()

        except Exception as e:
            results['success'] = False
            results['error'] = str(e)
            print(f"[PDFFigures2-Py] Error: {e}", file=sys.stderr)

        results['processing_time'] = time.time() - start_time
        print(f"[PDFFigures2-Py] Completed in {results['processing_time']:.2f}s", file=sys.stderr)
        print(f"[PDFFigures2-Py] Extracted {len(results['figures'])} figures/tables", file=sys.stderr)

        return results

    def _extract_from_page(self, doc: fitz.Document, page_num: int) -> List[Figure]:
        """Extract figures and tables from a single page"""
        page = doc[page_num]
        figures = []

        # Get text blocks with positions
        blocks = page.get_text("dict")

        # Find captions first
        captions = self._find_captions(blocks)

        # Extract images
        image_figures = self._extract_images(page, captions, page_num)
        figures.extend(image_figures)

        # Extract tables (look for grid-like structures)
        table_figures = self._extract_tables(page, blocks, captions, page_num)
        figures.extend(table_figures)

        # Extract vector graphics (charts, diagrams)
        vector_figures = self._extract_vector_graphics(page, captions, page_num)
        figures.extend(vector_figures)

        print(f"[PDFFigures2-Py] Page {page_num + 1}: Found {len(figures)} elements", file=sys.stderr)

        return figures

    def _find_captions(self, blocks: Dict) -> List[Dict]:
        """Find all captions in the page"""
        captions = []

        for block in blocks.get('blocks', []):
            if block.get('type') != 0:  # Not text
                continue

            for line in block.get('lines', []):
                text = ''
                bbox = None

                for span in line.get('spans', []):
                    text += span.get('text', '')
                    if bbox is None:
                        bbox = span.get('bbox')
                    else:
                        # Extend bbox
                        x0, y0, x1, y1 = bbox
                        sx0, sy0, sx1, sy1 = span.get('bbox', (x1, y0, x1, y1))
                        bbox = (min(x0, sx0), min(y0, sy0), max(x1, sx1), max(y1, sy1))

                if not text or not bbox:
                    continue

                # Check if it's a figure caption
                for pattern in self.figure_patterns:
                    match = re.match(pattern, text, re.IGNORECASE)
                    if match:
                        captions.append({
                            'type': 'Figure',
                            'text': text,
                            'bbox': BoundingBox(*bbox),
                            'match': match.group()
                        })
                        break

                # Check if it's a table caption
                for pattern in self.table_patterns:
                    match = re.match(pattern, text, re.IGNORECASE)
                    if match:
                        captions.append({
                            'type': 'Table',
                            'text': text,
                            'bbox': BoundingBox(*bbox),
                            'match': match.group()
                        })
                        break

        return captions

    def _extract_images(self, page: fitz.Page, captions: List[Dict], page_num: int) -> List[Figure]:
        """Extract image-based figures"""
        figures = []
        image_list = page.get_images()

        for img_index, img in enumerate(image_list):
            xref = img[0]

            # Get image position
            img_rects = page.get_image_rects(xref)
            if not img_rects:
                continue

            rect = img_rects[0]  # Use first occurrence
            bbox = BoundingBox(rect.x0, rect.y0, rect.x1, rect.y1)

            # Skip small images (likely icons)
            if bbox.area() < 10000:  # ~100x100 pixels
                continue

            # Extract image
            pix = fitz.Pixmap(page.parent, xref)

            # Skip very small images
            if pix.width < 100 or pix.height < 100:
                continue

            # Convert to base64
            img_data = pix.tobytes("png")
            img_base64 = base64.b64encode(img_data).decode('utf-8')

            # Find associated caption
            caption_info = self._find_nearest_caption(bbox, captions)

            if caption_info:
                fig_type = caption_info['type']
                caption_text = self._extract_full_caption(page, caption_info)
                name = caption_info['match'].strip()
            else:
                # Heuristic: images are usually figures
                fig_type = 'Figure'
                caption_text = ''
                name = f'Figure {img_index + 1}'

            figures.append(Figure(
                figure_type=fig_type,
                name=name,
                caption=caption_text,
                page=page_num,
                bbox=bbox,
                image_data=f'data:image/png;base64,{img_base64}'
            ))

        return figures

    def _extract_tables(self, page: fitz.Page, blocks: Dict, captions: List[Dict], page_num: int) -> List[Figure]:
        """Extract table-like structures"""
        figures = []

        # Look for table captions and try to find the associated table
        table_captions = [c for c in captions if c['type'] == 'Table']

        for caption_info in table_captions:
            # Look for grid-like structure below the caption
            caption_bbox = caption_info['bbox']

            # Define search region (below caption)
            search_bbox = BoundingBox(
                caption_bbox.x1 - 50,  # Slightly to the left
                caption_bbox.y2,  # Below caption
                caption_bbox.x2 + 200,  # Extend to right (tables are often wide)
                caption_bbox.y2 + 500  # Look down up to 500 pixels
            )

            # Find text blocks in this region
            table_blocks = []
            for block in blocks.get('blocks', []):
                if block.get('type') != 0:
                    continue
                block_bbox = BoundingBox(*block['bbox'])
                if self._bbox_in_region(block_bbox, search_bbox):
                    table_blocks.append(block)

            if table_blocks:
                # Calculate overall table bbox
                min_x = min(BoundingBox(*b['bbox']).x1 for b in table_blocks)
                min_y = min(BoundingBox(*b['bbox']).y1 for b in table_blocks)
                max_x = max(BoundingBox(*b['bbox']).x2 for b in table_blocks)
                max_y = max(BoundingBox(*b['bbox']).y2 for b in table_blocks)

                table_bbox = BoundingBox(min_x, caption_bbox.y1, max_x, max_y)

                # Render the table region as image
                mat = fitz.Matrix(2, 2)  # 2x zoom for better quality
                clip = fitz.Rect(table_bbox.x1, table_bbox.y1, table_bbox.x2, table_bbox.y2)
                pix = page.get_pixmap(matrix=mat, clip=clip)

                img_data = pix.tobytes("png")
                img_base64 = base64.b64encode(img_data).decode('utf-8')

                caption_text = self._extract_full_caption(page, caption_info)

                figures.append(Figure(
                    figure_type='Table',
                    name=caption_info['match'].strip(),
                    caption=caption_text,
                    page=page_num,
                    bbox=table_bbox,
                    image_data=f'data:image/png;base64,{img_base64}'
                ))

        return figures

    def _extract_vector_graphics(self, page: fitz.Page, captions: List[Dict], page_num: int) -> List[Figure]:
        """Extract vector graphics (charts, diagrams)"""
        figures = []

        # Get drawings
        drawings = page.get_drawings()

        if not drawings:
            return figures

        # Group nearby drawings
        drawing_groups = self._group_drawings(drawings)

        for group in drawing_groups:
            if len(group) < 5:  # Too simple, probably not a figure
                continue

            # Calculate bounding box
            min_x = min(d.get('rect', page.rect).x0 for d in group)
            min_y = min(d.get('rect', page.rect).y0 for d in group)
            max_x = max(d.get('rect', page.rect).x1 for d in group)
            max_y = max(d.get('rect', page.rect).y1 for d in group)

            bbox = BoundingBox(min_x, min_y, max_x, max_y)

            # Skip if too small
            if bbox.area() < 10000:
                continue

            # Find associated caption
            caption_info = self._find_nearest_caption(bbox, captions)

            if caption_info:
                fig_type = caption_info['type']
                caption_text = self._extract_full_caption(page, caption_info)
                name = caption_info['match'].strip()
            else:
                # Skip uncaptioned vector graphics (likely decorative)
                continue

            # Render the region
            mat = fitz.Matrix(2, 2)
            clip = fitz.Rect(bbox.x1, bbox.y1, bbox.x2, bbox.y2)
            pix = page.get_pixmap(matrix=mat, clip=clip)

            img_data = pix.tobytes("png")
            img_base64 = base64.b64encode(img_data).decode('utf-8')

            figures.append(Figure(
                figure_type=fig_type,
                name=name,
                caption=caption_text,
                page=page_num,
                bbox=bbox,
                image_data=f'data:image/png;base64,{img_base64}'
            ))

        return figures

    def _find_nearest_caption(self, figure_bbox: BoundingBox, captions: List[Dict]) -> Optional[Dict]:
        """Find the caption nearest to a figure"""
        best_caption = None
        best_distance = float('inf')

        for caption in captions:
            caption_bbox = caption['bbox']

            # Caption should be near the figure (above or below)
            if abs(caption_bbox.x1 - figure_bbox.x1) > 100:  # Not aligned horizontally
                continue

            # Calculate vertical distance
            if caption_bbox.y1 > figure_bbox.y2:  # Caption below
                distance = caption_bbox.y1 - figure_bbox.y2
            elif caption_bbox.y2 < figure_bbox.y1:  # Caption above
                distance = figure_bbox.y1 - caption_bbox.y2
            else:  # Overlapping
                distance = 0

            if distance < best_distance and distance < 100:  # Within 100 pixels
                best_distance = distance
                best_caption = caption

        return best_caption

    def _extract_full_caption(self, page: fitz.Page, caption_info: Dict) -> str:
        """Extract the full caption text (may span multiple lines)"""
        caption_text = caption_info['text']
        caption_bbox = caption_info['bbox']

        # Look for continuation lines below
        blocks = page.get_text("dict")

        for block in blocks.get('blocks', []):
            if block.get('type') != 0:
                continue

            for line in block.get('lines', []):
                line_bbox = BoundingBox(*line['bbox'])

                # Check if line is just below and aligned
                if (line_bbox.y1 > caption_bbox.y2 and
                    line_bbox.y1 - caption_bbox.y2 < 20 and  # Close vertically
                    abs(line_bbox.x1 - caption_bbox.x1) < 50):  # Aligned horizontally

                    line_text = ''.join(span['text'] for span in line.get('spans', []))

                    # Stop if we hit another caption or section header
                    if any(re.match(p, line_text) for p in self.figure_patterns + self.table_patterns):
                        break

                    caption_text += ' ' + line_text
                    caption_bbox = line_bbox  # Update bbox for next iteration

        return caption_text.strip()

    def _group_drawings(self, drawings: List[Dict]) -> List[List[Dict]]:
        """Group nearby drawings together"""
        if not drawings:
            return []

        groups = []
        used = set()

        for i, drawing in enumerate(drawings):
            if i in used:
                continue

            group = [drawing]
            used.add(i)
            rect1 = drawing.get('rect')

            if not rect1:
                continue

            # Find nearby drawings
            for j, other in enumerate(drawings):
                if j in used or j == i:
                    continue

                rect2 = other.get('rect')
                if not rect2:
                    continue

                # Check if close enough
                if (abs(rect1.x0 - rect2.x0) < 200 and
                    abs(rect1.y0 - rect2.y0) < 200):
                    group.append(other)
                    used.add(j)

            groups.append(group)

        return groups

    def _bbox_in_region(self, bbox: BoundingBox, region: BoundingBox) -> bool:
        """Check if bbox is within a region"""
        return (bbox.x1 >= region.x1 and bbox.y1 >= region.y1 and
                bbox.x2 <= region.x2 and bbox.y2 <= region.y2)

    def _merge_multipage_elements(self, figures: List[Figure]) -> List[Figure]:
        """Merge figures/tables that span multiple pages"""
        merged = []
        skip_indices = set()

        for i, fig in enumerate(figures):
            if i in skip_indices:
                continue

            # Check if this is a continuation
            if any(word in fig.caption.lower() for word in self.continuation_words):
                # Find the original
                for j in range(i-1, -1, -1):
                    if figures[j].name == fig.name.replace('continued', '').strip():
                        # Merge captions
                        figures[j].caption += ' ' + fig.caption
                        skip_indices.add(i)
                        break

            if i not in skip_indices:
                merged.append(fig)

        return merged


def main():
    parser = argparse.ArgumentParser(description='PDFFigures2 Python Implementation')
    parser.add_argument('pdf_path', help='Path to PDF file')
    args = parser.parse_args()

    extractor = PDFFigures2Python()
    results = extractor.extract(args.pdf_path)

    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
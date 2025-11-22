"""
PDFFigures2 Wrapper for Journal Club V2
Uses AllenAI's PDFFigures2 to extract tables and figures from academic PDFs
"""

import subprocess
import json
import os
import sys
import tempfile
import shutil
import time
import base64
import argparse
from pathlib import Path
from typing import Dict, List, Any

class PDFFigures2Extractor:
    def __init__(self, jar_path: str = None):
        """
        Initialize PDFFigures2 wrapper

        Args:
            jar_path: Path to pdffigures2.jar (if None, looks in default location)
        """
        if jar_path is None:
            # Default location after build
            jar_path = os.path.join(
                os.path.dirname(__file__),
                '..', '..', 'pdffigures2', 'pdffigures2.jar'
            )

        self.jar_path = os.path.abspath(jar_path)

        if not os.path.exists(self.jar_path):
            raise FileNotFoundError(f"PDFFigures2 JAR not found at: {self.jar_path}")

        print(f"[PDFFigures2] Using JAR at: {self.jar_path}", file=sys.stderr)

    def extract(self, pdf_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Extract figures and tables from a PDF

        Args:
            pdf_path: Path to input PDF
            output_dir: Directory to save extracted images (optional)

        Returns:
            Dictionary with extraction results
        """
        start_time = time.time()

        # Create temporary directory for output
        if output_dir is None:
            output_dir = tempfile.mkdtemp(prefix='pdffigures2_')
            cleanup = True
        else:
            cleanup = False
            os.makedirs(output_dir, exist_ok=True)

        # Prepare paths
        pdf_path = os.path.abspath(pdf_path)
        data_prefix = os.path.join(output_dir, 'data', 'fig')
        img_prefix = os.path.join(output_dir, 'images', 'fig')

        # Create subdirectories
        os.makedirs(os.path.dirname(data_prefix), exist_ok=True)
        os.makedirs(os.path.dirname(img_prefix), exist_ok=True)

        try:
            # Run PDFFigures2
            # java -jar pdffigures2.jar input.pdf -m images/prefix -d data/prefix
            cmd = [
                'java',
                '-Dsun.java2d.cmm=sun.java2d.cmm.kcms.KcmsServiceProvider',
                '-jar', self.jar_path,
                pdf_path,
                '-m', img_prefix,  # Save figure images
                '-d', data_prefix,  # Save figure data
                '-g'  # Include section information
            ]

            print(f"[PDFFigures2] Running extraction on: {pdf_path}", file=sys.stderr)

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120  # 2 minute timeout
            )

            if result.returncode != 0:
                print(f"[PDFFigures2] Error: {result.stderr}", file=sys.stderr)
                return {
                    'success': False,
                    'error': f"PDFFigures2 failed: {result.stderr}"
                }

            # Parse the JSON output file
            json_file = data_prefix + '.json'

            if not os.path.exists(json_file):
                print(f"[PDFFigures2] No output file found at: {json_file}", file=sys.stderr)
                return {
                    'success': False,
                    'error': 'No output generated'
                }

            with open(json_file, 'r', encoding='utf-8') as f:
                extraction_data = json.load(f)

            # Process extracted figures
            figures = []

            for fig in extraction_data.get('figures', []):
                # Get image path
                fig_type = fig.get('figType', 'Figure')
                fig_num = fig.get('name', '')
                page = fig.get('page', 0) + 1  # Convert to 1-based

                # Look for the corresponding image file
                img_path = f"{img_prefix}-{fig.get('renderURL', '').split('-')[-1]}"

                # Find the actual image file (could be .png, .jpg, etc.)
                actual_img_path = None
                for ext in ['.png', '.jpg', '.jpeg']:
                    if os.path.exists(img_path + ext):
                        actual_img_path = img_path + ext
                        break

                # Convert image to base64 if it exists
                img_base64 = None
                if actual_img_path and os.path.exists(actual_img_path):
                    with open(actual_img_path, 'rb') as img_file:
                        img_base64 = base64.b64encode(img_file.read()).decode('utf-8')
                    print(f"[PDFFigures2] Extracted image for {fig_num} on page {page}", file=sys.stderr)

                # Extract caption
                caption = fig.get('caption', '')
                if not caption and fig.get('captionBoundary'):
                    caption = fig.get('captionBoundary', {}).get('text', '')

                # Determine type (table or figure)
                is_table = fig_type.lower() == 'table'

                figures.append({
                    'type': 'table' if is_table else 'figure',
                    'pageNumber': page,
                    'name': fig_num,
                    'caption': caption,
                    'bbox': fig.get('regionBoundary', {}),
                    'image': f"data:image/png;base64,{img_base64}" if img_base64 else None,
                    'source': 'pdffigures2'
                })

            # Sort by page number
            figures.sort(key=lambda x: x['pageNumber'])

            print(f"[PDFFigures2] Extracted {len(figures)} figures/tables", file=sys.stderr)

            # Count tables vs figures
            tables = sum(1 for f in figures if f['type'] == 'table')
            figs = len(figures) - tables
            print(f"[PDFFigures2] Breakdown: {tables} tables, {figs} figures", file=sys.stderr)

            return {
                'success': True,
                'figures': figures,
                'processing_time': time.time() - start_time,
                'sections': extraction_data.get('sections', []),
                'title': extraction_data.get('title', ''),
                'abstract': extraction_data.get('abstractText', '')
            }

        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': 'PDFFigures2 extraction timeout'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
        finally:
            # Cleanup temporary directory if created
            if cleanup and os.path.exists(output_dir):
                shutil.rmtree(output_dir, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description='Extract figures and tables using PDFFigures2')
    parser.add_argument('pdf_path', help='Path to input PDF')
    parser.add_argument('--jar', help='Path to pdffigures2.jar')
    parser.add_argument('--output-dir', help='Directory to save images')

    args = parser.parse_args()

    try:
        extractor = PDFFigures2Extractor(args.jar)
        result = extractor.extract(args.pdf_path, args.output_dir)

        # Output JSON result
        print(json.dumps(result, indent=2))

    except Exception as e:
        result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(result, indent=2))
        sys.exit(1)


if __name__ == '__main__':
    main()
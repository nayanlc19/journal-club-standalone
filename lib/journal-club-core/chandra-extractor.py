#!/usr/bin/env python3
"""
Chandra OCR wrapper for extracting text, tables, and images from PDFs
Outputs JSON with structured content
"""

import sys
import json
import argparse
from pathlib import Path
import subprocess
import tempfile
import os

def extract_pdf_content(pdf_path: str, include_images: bool = True) -> dict:
    """
    Extract content from PDF using Chandra CLI
    
    Returns:
        dict with keys:
        - markdown: Full markdown text
        - text: Plain text content
        - images: List of extracted image filenames
        - success: Boolean status
    """
    try:
        # Create temp output directory
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            
            # Build chandra command
            cmd = [
                'chandra',
                pdf_path,
                str(output_dir),
                '--method', 'hf',  # Use HuggingFace (local) - slower but free
            ]
            
            if not include_images:
                cmd.append('--no-images')
            
            # Run Chandra
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=1200  # 20 minutes timeout for first run (downloads model)
            )
            
            if result.returncode != 0:
                return {
                    'success': False,
                    'error': f'Chandra failed: {result.stderr}'
                }
            
            # Read output markdown file
            md_files = list(output_dir.glob('*.md'))
            if not md_files:
                return {
                    'success': False,
                    'error': 'No markdown output generated'
                }
            
            markdown_content = md_files[0].read_text(encoding='utf-8')
            
            # Get list of extracted images
            image_files = list(output_dir.glob('*.png')) + list(output_dir.glob('*.jpg'))
            
            # Copy images to permanent location if needed
            images = [img.name for img in image_files]
            
            return {
                'success': True,
                'markdown': markdown_content,
                'text': markdown_content,  # For now, same as markdown
                'images': images,
                'num_pages': len(md_files)
            }
            
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'error': 'Chandra OCR timed out after 20 minutes'
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'Unexpected error: {str(e)}'
        }

def main():
    parser = argparse.ArgumentParser(description='Extract content from PDF using Chandra OCR')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--no-images', action='store_true', help='Skip image extraction')
    parser.add_argument('--output', '-o', help='Output JSON file (default: stdout)')
    
    args = parser.parse_args()
    
    # Extract content
    result = extract_pdf_content(args.pdf_path, include_images=not args.no_images)
    
    # Output JSON
    output_json = json.dumps(result, indent=2)
    
    if args.output:
        Path(args.output).write_text(output_json, encoding='utf-8')
    else:
        print(output_json)

if __name__ == '__main__':
    main()

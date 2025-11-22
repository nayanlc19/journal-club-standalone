"""
PDF Thumbnail Generator
Extracts first page of PDF as PNG image for preview
"""

import sys
import fitz  # PyMuPDF

def generate_thumbnail(pdf_path, output_path, dpi=150):
    """Generate thumbnail of first page"""
    try:
        # Open PDF
        doc = fitz.open(pdf_path)

        # Get first page
        page = doc[0]

        # Render page to image
        mat = fitz.Matrix(dpi/72, dpi/72)  # 150 DPI
        pix = page.get_pixmap(matrix=mat)

        # Save as PNG
        pix.save(output_path)

        doc.close()

        print(f"Thumbnail saved: {output_path}", file=sys.stderr)
        return True

    except Exception as e:
        print(f"Error generating thumbnail: {e}", file=sys.stderr)
        return False

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python pdf-thumbnail-generator.py <pdf_path> <output_path>", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_path = sys.argv[2]

    success = generate_thumbnail(pdf_path, output_path)
    sys.exit(0 if success else 1)

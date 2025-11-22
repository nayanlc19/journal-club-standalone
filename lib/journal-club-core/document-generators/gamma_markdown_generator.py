"""
Gamma-Ready Markdown Generator
Creates clean markdown documents that Gamma AI can easily parse
"""

import sys
import json
import os

def create_gamma_markdown(data):
    """
    Create a Gamma-ready markdown document

    Args:
        data: {
            "title": "Study Title",
            "sections": [
                {
                    "heading": "Section Title",
                    "content": "Text content",
                    "images": [...]
                }
            ]
        }

    Returns:
        Markdown string
    """
    markdown = []

    # Title
    markdown.append(f"# {data['title']}\n")

    # Process each section
    for section in data.get('sections', []):
        # Section heading
        heading = section.get('heading', '')
        if heading:
            markdown.append(f"\n## {heading}\n")

        # Section content
        content = section.get('content', '')
        if content:
            markdown.append(f"{content}\n")

        # Add images if present (as references)
        for image_data in section.get('images', []):
            img_title = image_data.get('title', 'Figure')
            explanation = image_data.get('explanation', '')

            markdown.append(f"\n**{img_title}**\n")
            if explanation:
                markdown.append(f"{explanation}\n")
            else:
                markdown.append(f"*Refer to original paper for this visual element*\n")

    return '\n'.join(markdown)

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'success': False, 'error': 'Usage: script.py input.json output.md'}))
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        markdown_content = create_gamma_markdown(data)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)

        print(json.dumps({'success': True}))

    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()

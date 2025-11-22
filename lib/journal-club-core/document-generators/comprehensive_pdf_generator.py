"""
Comprehensive Educational PDF Generator
Creates detailed, teaching-focused PDFs with clean formatting
"""

import sys
import json
import base64
import re
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY


def parse_markdown_to_reportlab(text):
    """
    Convert markdown syntax to reportlab XML markup
    Handles: **bold**, *italic*, bullet points, tables, and cleans emojis
    """
    if not text:
        return ""

    # Remove emoji characters (they cause black squares)
    text = re.sub(r'[🔵🟢📋📚💡✅🎓📖🟡🔴⚠️❌✨🚀📄⏱️🎯🎉■●◆]', '', text)

    # Convert markdown bold: **text** → <b>text</b>
    text = re.sub(r'\*\*([^\*]+)\*\*', r'<b>\1</b>', text)

    # Convert markdown italic: *text* → <i>text</i> (avoid matching **)
    text = re.sub(r'(?<!\*)\*([^\*]+?)\*(?!\*)', r'<i>\1</i>', text)

    # Convert markdown headers to just bold text (reportlab handles headers separately)
    text = re.sub(r'#{1,6}\s+', '', text)

    # Convert bullet points
    text = re.sub(r'^\s*[-*•]\s+', '• ', text, flags=re.MULTILINE)

    # Remove table pipes and clean up table formatting
    # Tables need special handling, so we'll just clean them up
    text = re.sub(r'\s*\|\s*', ' | ', text)

    # Clean up any remaining asterisks
    text = text.replace('**', '')

    # Remove excessive pipes (table artifacts)
    text = re.sub(r'\|{2,}', '|', text)

    return text


def create_comprehensive_pdf(data, output_path, temp_path=None):
    """
    Create a comprehensive educational PDF

    Args:
        data: {
            "title": "Study Title",
            "metadata": {
                "authors": "...",
                "journal": "...",
                "year": "..."
            },
            "sections": [
                {
                    "heading": "Section Title",
                    "content": "Detailed content",
                    "explanations": {
                        "term1": "Detailed explanation...",
                        "term2": "Another explanation..."
                    },
                    "teaching_notes": ["Note 1", "Note 2"],
                    "checklist_items": [
                        {
                            "item": "Checklist item",
                            "rationale": "Why this matters",
                            "assessment": "Present/Absent/Unclear"
                        }
                    ],
                    "images": [...]
                }
            ]
        }
    """

    # Create PDF directly (no temp file needed)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )

    # Styles
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=24,
        textColor=colors.HexColor('#1a365d'),
        spaceAfter=30,
        alignment=TA_CENTER
    )

    heading1_style = ParagraphStyle(
        'CustomHeading1',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#2c5282'),
        spaceAfter=12,
        spaceBefore=20,
        leftIndent=0
    )

    heading2_style = ParagraphStyle(
        'CustomHeading2',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#2d3748'),
        spaceAfter=10,
        spaceBefore=15
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontSize=11,
        leading=16,
        alignment=TA_JUSTIFY,
        spaceAfter=10
    )

    explanation_style = ParagraphStyle(
        'ExplanationBox',
        parent=styles['BodyText'],
        fontSize=10,
        leading=14,
        leftIndent=20,
        rightIndent=20,
        textColor=colors.HexColor('#2d3748'),
        backColor=colors.HexColor('#f7fafc'),
        borderColor=colors.HexColor('#4299e1'),
        borderWidth=1,
        borderPadding=10,
        spaceAfter=10
    )

    teaching_note_style = ParagraphStyle(
        'TeachingNote',
        parent=styles['BodyText'],
        fontSize=10,
        leading=14,
        leftIndent=30,
        textColor=colors.HexColor('#38a169'),
        spaceAfter=8
    )

    # Build story (content)
    story = []

    # Title page
    story.append(Paragraph(data['title'], title_style))
    story.append(Spacer(1, 0.3*inch))

    # Metadata
    if data.get('metadata'):
        meta = data['metadata']
        if meta.get('authors'):
            story.append(Paragraph(f"<b>Authors:</b> {meta['authors']}", body_style))
        if meta.get('journal'):
            story.append(Paragraph(f"<b>Journal:</b> {meta['journal']}", body_style))
        if meta.get('year'):
            story.append(Paragraph(f"<b>Year:</b> {meta['year']}", body_style))

    story.append(Spacer(1, 0.5*inch))

    # Introduction box
    intro_text = """
    <b>How to Use This Document</b><br/><br/>
    This comprehensive guide is designed to help you understand EVERY aspect of this research paper -
    from the simplest concepts to the most complex methodology. No prior knowledge assumed.
    Each term is explained, each checklist justified, each decision analyzed.<br/><br/>
    <b>Color Code:</b><br/>
    • Blue boxes = Term explanations<br/>
    • Green text = Teaching notes<br/>
    • Tables = Checklists with rationale
    """
    story.append(Paragraph(intro_text, explanation_style))
    story.append(PageBreak())

    # Process sections
    for section in data.get('sections', []):
        # Section heading
        story.append(Paragraph(section['heading'], heading1_style))

        # Main content
        if section.get('content'):
            # Split content by paragraphs
            paragraphs = section['content'].split('\n\n')
            for para in paragraphs:
                if para.strip():
                    # Parse markdown and clean emojis
                    cleaned_para = parse_markdown_to_reportlab(para.strip())
                    if cleaned_para:
                        story.append(Paragraph(cleaned_para, body_style))
                        story.append(Spacer(1, 0.15*inch))

        # Explanations
        if section.get('explanations'):
            story.append(Paragraph("<b>Term Explanations:</b>", heading2_style))
            for term, explanation in section['explanations'].items():
                # Clean markdown from term and explanation
                clean_term = parse_markdown_to_reportlab(term)
                clean_explanation = parse_markdown_to_reportlab(explanation)
                explanation_text = f"<b>{clean_term}:</b> {clean_explanation}"
                story.append(Paragraph(explanation_text, explanation_style))
                story.append(Spacer(1, 0.1*inch))

        # Teaching notes
        if section.get('teaching_notes'):
            story.append(Paragraph("<b>Teaching Notes:</b>", heading2_style))
            for note in section['teaching_notes']:
                clean_note = parse_markdown_to_reportlab(note)
                note_text = f"• {clean_note}"
                story.append(Paragraph(note_text, teaching_note_style))
                story.append(Spacer(1, 0.05*inch))

        # Checklist items with rationale
        if section.get('checklist_items'):
            story.append(Paragraph("<b>Critical Appraisal Checklist:</b>", heading2_style))

            # Create table
            table_data = [['Item', 'Why This Matters', 'Assessment']]

            for item in section['checklist_items']:
                # Clean markdown from checklist items
                clean_item = parse_markdown_to_reportlab(item['item'])
                clean_rationale = parse_markdown_to_reportlab(item['rationale'])
                clean_assessment = parse_markdown_to_reportlab(item['assessment'])

                table_data.append([
                    clean_item,
                    clean_rationale,
                    clean_assessment
                ])

            checklist_table = Table(table_data, colWidths=[2.2*inch, 3*inch, 1.3*inch])
            checklist_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4299e1')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('TOPPADDING', (0, 1), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')])
            ]))

            story.append(checklist_table)
            story.append(Spacer(1, 0.2*inch))

        # Images with detailed explanations
        for image_data in section.get('images', []):
            # Clean markdown from image title
            clean_title = parse_markdown_to_reportlab(image_data['title'])
            story.append(Paragraph(f"<b>{clean_title}</b>", heading2_style))

            # Insert image if available
            if image_data.get('base64'):
                try:
                    img_bytes = base64.b64decode(image_data['base64'])
                    img_stream = BytesIO(img_bytes)
                    img = Image(img_stream, width=5*inch, height=3.5*inch, kind='proportional')
                    story.append(img)
                    story.append(Spacer(1, 0.1*inch))
                except Exception as e:
                    # Image failed to load, just show description
                    story.append(Paragraph(f"[See original paper for visual]", body_style))
            else:
                # No image data - just show placeholder
                story.append(Paragraph(f"[Refer to page {image_data.get('pageNumber', '?')} of original paper]", body_style))

            # Detailed explanation
            if image_data.get('explanation'):
                clean_explanation = parse_markdown_to_reportlab(image_data['explanation'])
                story.append(Paragraph(clean_explanation, explanation_style))

            story.append(Spacer(1, 0.2*inch))

        # Section separator
        story.append(Spacer(1, 0.3*inch))

    # Build PDF (no password protection)
    doc.build(story)


def main():
    """Main entry point"""
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python comprehensive_pdf_generator.py <input_json> <output_pdf>"
        }))
        sys.exit(1)

    input_json = sys.argv[1]
    output_path = sys.argv[2]

    try:
        # Load input data
        with open(input_json, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Generate PDF (no password protection)
        create_comprehensive_pdf(data, output_path)

        print(json.dumps({
            "success": True,
            "output": output_path,
            "message": "Comprehensive educational PDF created successfully"
        }))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()

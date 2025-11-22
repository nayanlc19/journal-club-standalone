"""
Universal Text Sanitizer for Academic Papers
Handles text from any publisher, any encoding, any special characters
"""

import re
import unicodedata
import ftfy  # Fixes mojibake and encoding issues
import html

class UniversalTextSanitizer:
    """Bulletproof text sanitizer that handles ANY publisher's quirks"""

    def __init__(self):
        # Common problematic characters from various publishers
        self.replacements = {
            # NEJM special spaces
            '\u202f': ' ',  # Narrow no-break space
            '\u2009': ' ',  # Thin space
            '\u200a': ' ',  # Hair space
            '\u2008': ' ',  # Punctuation space
            '\u2007': ' ',  # Figure space
            '\u2006': ' ',  # Six-per-em space
            '\u2005': ' ',  # Four-per-em space
            '\u2004': ' ',  # Three-per-em space
            '\u2003': ' ',  # Em space
            '\u2002': ' ',  # En space
            '\u00a0': ' ',  # Non-breaking space
            '\xa0': ' ',    # Non-breaking space (Latin-1)

            # Zero-width characters
            '\u200b': '',   # Zero-width space
            '\u200c': '',   # Zero-width non-joiner
            '\u200d': '',   # Zero-width joiner
            '\ufeff': '',   # Zero-width no-break space (BOM)
            '\u2060': '',   # Word joiner

            # Elsevier/Science Direct special characters
            '\u2010': '-',  # Hyphen
            '\u2011': '-',  # Non-breaking hyphen
            '\u2012': '-',  # Figure dash
            '\u2013': '-',  # En dash
            '\u2014': '--', # Em dash
            '\u2212': '-',  # Minus sign

            # Quotation marks (Nature, Science)
            '\u2018': "'",  # Left single quotation mark
            '\u2019': "'",  # Right single quotation mark
            '\u201a': "'",  # Single low-9 quotation mark
            '\u201b': "'",  # Single high-reversed-9 quotation mark
            '\u201c': '"',  # Left double quotation mark
            '\u201d': '"',  # Right double quotation mark
            '\u201e': '"',  # Double low-9 quotation mark
            '\u201f': '"',  # Double high-reversed-9 quotation mark
            '\u301d': '"',  # Reversed double prime quotation mark
            '\u301e': '"',  # Double prime quotation mark

            # Mathematical symbols that cause issues
            '\u2264': '<=', # Less than or equal to
            '\u2265': '>=', # Greater than or equal to
            '\u2260': '!=', # Not equal to
            '\u00b1': '+/-', # Plus-minus sign
            '\u00d7': 'x',  # Multiplication sign
            '\u00f7': '/',  # Division sign
            '\u221e': 'infinity', # Infinity
            '\u2248': '~',  # Almost equal to

            # Ellipsis
            '\u2026': '...',  # Horizontal ellipsis

            # Bullets and special markers
            '\u2022': '*',  # Bullet
            '\u2023': '>',  # Triangular bullet
            '\u2043': '-',  # Hyphen bullet
            '\u204c': '!!', # Double exclamation mark
            '\u2047': '??', # Double question mark

            # Fractions (common in medical papers)
            '\u00bd': '1/2',
            '\u2153': '1/3',
            '\u2154': '2/3',
            '\u00bc': '1/4',
            '\u00be': '3/4',
            '\u215b': '1/8',
            '\u215c': '3/8',
            '\u215d': '5/8',
            '\u215e': '7/8',

            # Arrows
            '\u2190': '<-',  # Left arrow
            '\u2192': '->',  # Right arrow
            '\u2194': '<->', # Left-right arrow
            '\u21d2': '=>',  # Rightwards double arrow

            # Other special characters
            '\u00a9': '(c)',  # Copyright
            '\u00ae': '(R)',  # Registered trademark
            '\u2122': '(TM)', # Trademark
            '\u00b0': ' degrees', # Degree symbol
            '\u03bc': 'u',    # Micro sign (often used as mu)
            '\u03b1': 'alpha',
            '\u03b2': 'beta',
            '\u0394': 'Delta',
        }

    def sanitize(self, text, context='general'):
        """
        Main sanitization method with context awareness

        Args:
            text: Text to sanitize
            context: 'title', 'content', 'figure_caption', 'table' etc.

        Returns:
            Sanitized text safe for any document format
        """
        if not text:
            return ''

        # Step 1: Fix mojibake and encoding issues
        try:
            text = ftfy.fix_text(text)
        except:
            pass  # Continue even if ftfy fails

        # Step 2: Normalize Unicode (NFC form)
        try:
            text = unicodedata.normalize('NFC', text)
        except:
            pass

        # Step 3: Decode HTML entities
        try:
            text = html.unescape(text)
        except:
            pass

        # Step 4: Apply character replacements
        for old, new in self.replacements.items():
            text = text.replace(old, new)

        # Step 5: Remove control characters (except newlines, tabs, carriage returns)
        text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]', '', text)

        # Step 6: Handle ligatures (common in PDFs)
        ligatures = {
            'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl',
            'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st',
            'ﬆ': 'st', 'œ': 'oe', 'Œ': 'OE',
            'æ': 'ae', 'Æ': 'AE'
        }
        for lig, replacement in ligatures.items():
            text = text.replace(lig, replacement)

        # Step 7: Fix common OCR errors
        if context != 'title':  # Don't fix in titles as they might be intentional
            ocr_fixes = {
                r'\bl\b': '1',  # Lowercase L often scanned as 1
                r'\bO\b': '0',  # Capital O often scanned as 0
                r'ﬁ': 'fi',
                r'ﬂ': 'fl',
            }
            for pattern, replacement in ocr_fixes.items():
                text = re.sub(pattern, replacement, text)

        # Step 8: Clean up multiple spaces and normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()

        # Step 9: Remove or replace characters that are not XML-safe
        # Keep only printable ASCII + common extended Latin
        if context == 'title' or context == 'content':
            # More aggressive cleaning for main text
            text = ''.join(
                char if (ord(char) >= 32 and ord(char) <= 126) or
                       (ord(char) >= 160 and ord(char) <= 255) or
                       char in '\n\r\t'
                else ' '
                for char in text
            )

        # Step 10: Final safety check - remove any remaining problem characters
        # This is a last resort to ensure XML compatibility
        try:
            text.encode('utf-8').decode('utf-8')
        except UnicodeDecodeError:
            # If still problematic, use more aggressive cleaning
            text = text.encode('utf-8', 'ignore').decode('utf-8')

        return text

    def sanitize_for_filename(self, text):
        """Sanitize text to be safe for filenames"""
        # First do regular sanitization
        text = self.sanitize(text, 'title')

        # Remove/replace characters not safe for filenames
        invalid_chars = r'<>:"/\|?*'
        for char in invalid_chars:
            text = text.replace(char, '_')

        # Limit length
        if len(text) > 200:
            text = text[:200]

        # Remove trailing dots and spaces (Windows doesn't like them)
        text = text.rstrip('. ')

        return text

    def detect_publisher(self, text):
        """
        Detect publisher from text patterns
        Returns: publisher name or 'unknown'
        """
        publishers = {
            'nejm': [r'N Engl J Med', r'NEJM', r'Massachusetts Medical Society'],
            'nature': [r'Nature Publishing Group', r'Springer Nature', r'www\.nature\.com'],
            'science': [r'Science Magazine', r'AAAS', r'www\.sciencemag\.org'],
            'elsevier': [r'Elsevier', r'ScienceDirect', r'www\.elsevier\.com'],
            'lancet': [r'The Lancet', r'www\.thelancet\.com'],
            'bmj': [r'BMJ Publishing Group', r'British Medical Journal', r'www\.bmj\.com'],
            'jama': [r'JAMA', r'American Medical Association'],
            'wiley': [r'John Wiley', r'Wiley Online Library'],
            'springer': [r'Springer', r'link\.springer\.com'],
            'oxford': [r'Oxford University Press', r'Oxford Academic'],
            'cell': [r'Cell Press', r'www\.cell\.com'],
            'plos': [r'PLOS', r'Public Library of Science'],
            'mdpi': [r'MDPI', r'www\.mdpi\.com'],
            'frontiers': [r'Frontiers', r'www\.frontiersin\.org'],
            'ieee': [r'IEEE', r'Institute of Electrical'],
            'acm': [r'ACM', r'Association for Computing'],
        }

        text_lower = text.lower()
        for publisher, patterns in publishers.items():
            for pattern in patterns:
                if re.search(pattern.lower(), text_lower):
                    return publisher

        return 'unknown'


# Singleton instance for use across the application
sanitizer = UniversalTextSanitizer()


def sanitize_text(text, context='general'):
    """Global sanitization function"""
    return sanitizer.sanitize(text, context)


def sanitize_filename(text):
    """Global filename sanitization function"""
    return sanitizer.sanitize_for_filename(text)


def detect_publisher(text):
    """Global publisher detection function"""
    return sanitizer.detect_publisher(text)


# Test the sanitizer
if __name__ == "__main__":
    # Test various problematic texts
    test_cases = [
        "Test\u202fwith\u200bspecial\u2009spaces",  # Various Unicode spaces
        "Math: α × β ≤ ∞ ± 2.5",  # Mathematical symbols
        "Quotes: "Hello" 'world'",  # Smart quotes
        "Ligatures: ﬁnal ﬂow ﬀort",  # Ligatures
        "Fractions: ½ ⅓ ¼",  # Fractions
        "Control\x00chars\x01here",  # Control characters
        "HTML: &lt;test&gt; &amp; &nbsp;",  # HTML entities
    ]

    for test in test_cases:
        sanitized = sanitize_text(test)
        print(f"Original: {repr(test)}")
        print(f"Sanitized: {repr(sanitized)}")
        print("-" * 50)
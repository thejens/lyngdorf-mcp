#!/usr/bin/env python3
"""Extract text from Lyngdorf PDF manuals to analyze command protocols."""

import sys
import subprocess

def extract_pdf_text(pdf_path):
    """Extract text from PDF using system tools."""
    try:
        # Try textutil (macOS built-in)
        result = subprocess.run(
            ['textutil', '-convert', 'txt', '-stdout', pdf_path],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        try:
            # Try mdls + qlmanage (macOS)
            result = subprocess.run(
                ['qlmanage', '-t', pdf_path],
                capture_output=True,
                text=True
            )
            return result.stdout
        except:
            return f"Error: Could not extract text from {pdf_path}"

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 extract_pdf.py <pdf_file>")
        sys.exit(1)

    pdf_file = sys.argv[1]
    text = extract_pdf_text(pdf_file)
    print(text)

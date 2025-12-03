#!/usr/bin/env python3
"""
Parse Lyngdorf Owner's Manual PDFs into structured chapters and sections.
Requires: pip install pymupdf (PyMuPDF)
"""

import fitz  # PyMuPDF
import json
import re
import sys
from pathlib import Path

def extract_text_with_structure(pdf_path):
    """Extract text with page numbers and basic structure."""
    doc = fitz.open(pdf_path)
    pages = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        pages.append({
            'page_number': page_num + 1,
            'text': text
        })

    doc.close()
    return pages

def detect_chapters(pages):
    """Detect chapter headings and structure."""
    chapters = []
    current_chapter = None

    # Common chapter patterns in manuals
    chapter_patterns = [
        r'^(CHAPTER \d+|Chapter \d+)',
        r'^(\d+\.\s+[A-Z][A-Za-z\s]+)$',
        r'^([A-Z][A-Z\s]{3,30})$',  # ALL CAPS headings
    ]

    for page in pages:
        lines = page['text'].split('\n')

        for i, line in enumerate(lines):
            line = line.strip()

            # Skip very short or very long lines
            if len(line) < 3 or len(line) > 100:
                continue

            # Check if line matches chapter pattern
            is_chapter = False
            for pattern in chapter_patterns:
                if re.match(pattern, line):
                    is_chapter = True
                    break

            # Also check for common section titles
            section_keywords = [
                'introduction', 'getting started', 'connections', 'setup',
                'operation', 'features', 'roomperfect', 'voicing',
                'troubleshooting', 'specifications', 'warranty',
                'safety', 'installation', 'configuration', 'controls',
                'remote control', 'front panel', 'rear panel', 'display'
            ]

            if any(keyword in line.lower() for keyword in section_keywords):
                if len(line.split()) <= 5:  # Short enough to be a heading
                    is_chapter = True

            if is_chapter:
                # Save previous chapter
                if current_chapter:
                    chapters.append(current_chapter)

                # Start new chapter
                current_chapter = {
                    'title': line,
                    'start_page': page['page_number'],
                    'content': ''
                }
            elif current_chapter:
                # Add content to current chapter
                current_chapter['content'] += line + '\n'

    # Save last chapter
    if current_chapter:
        chapters.append(current_chapter)

    return chapters

def create_toc(pages):
    """Try to extract table of contents."""
    toc = []

    for page in pages[:10]:  # TOC usually in first 10 pages
        text = page['text'].lower()
        if 'contents' in text or 'table of contents' in text:
            # Found TOC page
            lines = page['text'].split('\n')
            for line in lines:
                # Look for page number patterns
                match = re.search(r'(.+?)\s+\.+\s+(\d+)', line)
                if match:
                    title = match.group(1).strip()
                    page_num = int(match.group(2))
                    if title and len(title) > 3:
                        toc.append({'title': title, 'page': page_num})

    return toc

def create_sections(chapters):
    """Organize chapters into logical sections."""
    sections = {
        'introduction': {
            'title': 'Introduction & Getting Started',
            'chapters': []
        },
        'setup': {
            'title': 'Setup & Installation',
            'chapters': []
        },
        'features': {
            'title': 'Features & Operation',
            'chapters': []
        },
        'roomperfect': {
            'title': 'RoomPerfect',
            'chapters': []
        },
        'troubleshooting': {
            'title': 'Troubleshooting & Support',
            'chapters': []
        },
        'technical': {
            'title': 'Technical Specifications',
            'chapters': []
        }
    }

    for chapter in chapters:
        title_lower = chapter['title'].lower()

        if any(word in title_lower for word in ['introduction', 'getting started', 'overview', 'welcome']):
            sections['introduction']['chapters'].append(chapter)
        elif any(word in title_lower for word in ['setup', 'installation', 'connection', 'wiring']):
            sections['setup']['chapters'].append(chapter)
        elif any(word in title_lower for word in ['roomperfect', 'room perfect', 'calibration']):
            sections['roomperfect']['chapters'].append(chapter)
        elif any(word in title_lower for word in ['troubleshoot', 'problem', 'support', 'warranty']):
            sections['troubleshooting']['chapters'].append(chapter)
        elif any(word in title_lower for word in ['specification', 'technical', 'dimensions']):
            sections['technical']['chapters'].append(chapter)
        else:
            sections['features']['chapters'].append(chapter)

    return sections

def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_owners_manual.py <pdf_file> [output_dir]")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('docs/kb')
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Parsing {pdf_path}...")

    # Extract pages
    pages = extract_text_with_structure(pdf_path)
    print(f"Extracted {len(pages)} pages")

    # Detect chapters
    chapters = detect_chapters(pages)
    print(f"Found {len(chapters)} chapters")

    # Try to extract TOC
    toc = create_toc(pages)
    if toc:
        print(f"Extracted TOC with {len(toc)} entries")

    # Organize into sections
    sections = create_sections(chapters)

    # Determine model from filename
    model = 'Unknown'
    if 'TDAI-1120' in pdf_path.name or '1120' in pdf_path.name:
        model = 'TDAI-1120'
    elif 'TDAI-2170' in pdf_path.name or '2170' in pdf_path.name:
        model = 'TDAI-2170'
    elif 'TDAI-3400' in pdf_path.name or '3400' in pdf_path.name:
        model = 'TDAI-3400'

    # Save structured data
    output = {
        'model': model,
        'manual_type': 'owners',
        'total_pages': len(pages),
        'toc': toc,
        'chapters': [{'title': c['title'], 'start_page': c['start_page']} for c in chapters],
        'sections': {
            section_name: {
                'title': section_data['title'],
                'chapters': [
                    {
                        'title': c['title'],
                        'start_page': c['start_page'],
                        'content': c['content'][:500]  # Preview
                    } for c in section_data['chapters']
                ]
            } for section_name, section_data in sections.items()
            if section_data['chapters']
        },
        'full_chapters': chapters  # Complete chapter content
    }

    output_file = output_dir / f'{model}-owners.json'
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"Saved parsed data to {output_file}")

    # Save individual section files
    for section_name, section_data in sections.items():
        if section_data['chapters']:
            section_file = output_dir / f'{model}-owners-{section_name}.md'
            with open(section_file, 'w') as f:
                f.write(f"# {model} Owner's Manual - {section_data['title']}\n\n")
                for chapter in section_data['chapters']:
                    f.write(f"## {chapter['title']}\n\n")
                    f.write(f"**Page {chapter['start_page']}**\n\n")
                    f.write(chapter['content'])
                    f.write('\n\n---\n\n')
            print(f"Saved {section_name} to {section_file}")

    # Create index file
    index_file = output_dir / f'{model}-owners-index.md'
    with open(index_file, 'w') as f:
        f.write(f"# {model} Owner's Manual - Index\n\n")
        f.write(f"Total Pages: {len(pages)}\n\n")

        if toc:
            f.write("## Table of Contents\n\n")
            for entry in toc:
                f.write(f"- {entry['title']} (Page {entry['page']})\n")
            f.write("\n")

        f.write("## Sections\n\n")
        for section_name, section_data in sections.items():
            if section_data['chapters']:
                f.write(f"### {section_data['title']}\n\n")
                for chapter in section_data['chapters']:
                    f.write(f"- {chapter['title']} (Page {chapter['start_page']})\n")
                f.write("\n")

    print(f"Saved index to {index_file}")

if __name__ == '__main__':
    main()

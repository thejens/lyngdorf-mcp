#!/usr/bin/env python3
"""
Parse Lyngdorf PDF manuals and extract structured information.
Requires: pip install pymupdf (PyMuPDF)
"""

import fitz  # PyMuPDF
import json
import re
import sys
from pathlib import Path

def extract_text_from_pdf(pdf_path):
    """Extract all text from PDF."""
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text

def parse_commands(text):
    """Extract command information from manual text."""
    commands = {}

    # Pattern for commands: !COMMAND or !COMMAND(params)
    command_pattern = r'(![\w]+(?:\([^\)]*\))?)'

    # Split into lines and look for command documentation
    lines = text.split('\n')

    for i, line in enumerate(lines):
        # Look for lines that contain command patterns
        matches = re.findall(command_pattern, line)
        for cmd in matches:
            # Extract command name
            cmd_name = cmd.split('(')[0]

            # Get context (next few lines)
            context_lines = []
            for j in range(i, min(i + 3, len(lines))):
                if lines[j].strip():
                    context_lines.append(lines[j].strip())

            context = ' '.join(context_lines)

            # Store command with context
            if cmd_name not in commands:
                commands[cmd_name] = {
                    'command': cmd,
                    'description': context[:200]  # First 200 chars
                }

    return commands

def extract_sections(text):
    """Extract major sections from the manual."""
    sections = {
        'introduction': '',
        'connection': '',
        'commands': '',
        'troubleshooting': '',
        'examples': ''
    }

    # Simple section extraction based on common headings
    current_section = 'introduction'
    section_text = []

    for line in text.split('\n'):
        line_lower = line.lower()

        # Detect section headers
        if any(word in line_lower for word in ['connection', 'network', 'tcp']):
            if len(section_text) > 10:
                sections[current_section] = '\n'.join(section_text)
            current_section = 'connection'
            section_text = []
        elif any(word in line_lower for word in ['command', 'control']):
            if len(section_text) > 10:
                sections[current_section] = '\n'.join(section_text)
            current_section = 'commands'
            section_text = []
        elif any(word in line_lower for word in ['troubleshoot', 'problem', 'issue']):
            if len(section_text) > 10:
                sections[current_section] = '\n'.join(section_text)
            current_section = 'troubleshooting'
            section_text = []
        elif any(word in line_lower for word in ['example', 'sample']):
            if len(section_text) > 10:
                sections[current_section] = '\n'.join(section_text)
            current_section = 'examples'
            section_text = []

        section_text.append(line)

    # Save last section
    if section_text:
        sections[current_section] = '\n'.join(section_text)

    return sections

def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_manual.py <pdf_file> [output_dir]")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('docs/kb')
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Parsing {pdf_path}...")

    # Extract text
    text = extract_text_from_pdf(pdf_path)

    # Parse commands
    commands = parse_commands(text)
    print(f"Found {len(commands)} commands")

    # Extract sections
    sections = extract_sections(text)

    # Determine model from filename
    model = 'Unknown'
    if 'TDAI-1120' in pdf_path.name or '1120' in pdf_path.name:
        model = 'TDAI-1120'
    elif 'TDAI-2170' in pdf_path.name or '2170' in pdf_path.name:
        model = 'TDAI-2170'
    elif 'TDAI-3400' in pdf_path.name or '3400' in pdf_path.name:
        model = 'TDAI-3400'

    # Save parsed data
    output = {
        'model': model,
        'commands': commands,
        'sections': sections,
        'full_text': text
    }

    output_file = output_dir / f'{model}.json'
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"Saved parsed data to {output_file}")

    # Also save individual sections as markdown
    for section_name, section_content in sections.items():
        if section_content.strip():
            section_file = output_dir / f'{model}-{section_name}.md'
            with open(section_file, 'w') as f:
                f.write(f"# {model} - {section_name.title()}\n\n")
                f.write(section_content)
            print(f"Saved {section_name} to {section_file}")

if __name__ == '__main__':
    main()

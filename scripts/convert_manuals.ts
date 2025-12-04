import * as fs from 'fs';
import * as path from 'path';

interface ManualSection {
    title: string;
    content: string;
    page?: number;
}

interface ManualJson {
    model: string;
    manual_type: string;
    toc: { title: string; page: number }[];
    sections: ManualSection[];
}

function parseMarkdown(content: string, model: string): ManualJson {
    const lines = content.split('\n');
    const sections: ManualSection[] = [];
    let currentSection: ManualSection | null = null;
    let pageCounter = 1;

    // Simple heuristic: each H1 or H2 starts a new section
    // We'll treat the text between headers as content.

    for (const line of lines) {
        if (line.startsWith('#')) {
            if (currentSection) {
                sections.push(currentSection);
            }
            const title = line.replace(/^#+\s*/, '').trim();
            currentSection = {
                title,
                content: '',
                page: pageCounter++ // Fake page numbers
            };
        } else {
            if (currentSection) {
                currentSection.content += line + '\n';
            } else {
                // Content before the first header? Maybe introduction.
                if (line.trim() !== '') {
                    if (!currentSection) {
                        currentSection = { title: 'Introduction', content: '', page: 1 };
                    }
                    currentSection.content += line + '\n';
                }
            }
        }
    }
    if (currentSection) {
        sections.push(currentSection);
    }

    // Clean up content
    sections.forEach(s => {
        s.content = s.content.trim();
    });

    const toc = sections.map(s => ({ title: s.title, page: s.page || 0 }));

    return {
        model,
        manual_type: 'owners',
        toc,
        sections
    };
}

const files = [
    { input: '2170-user-manual.md', model: 'TDAI-2170' },
    { input: '2210-user-manual.md', model: 'TDAI-2210' },
    { input: '3400-user-manual.md', model: 'TDAI-3400' }
];

files.forEach(file => {
    const inputPath = path.join(process.cwd(), file.input);
    const outputPath = path.join(process.cwd(), 'docs', 'kb', `${file.model}-owners.json`);

    if (fs.existsSync(inputPath)) {
        const content = fs.readFileSync(inputPath, 'utf-8');
        const json = parseMarkdown(content, file.model);
        fs.writeFileSync(outputPath, JSON.stringify(json, null, 2));
        console.log(`Generated ${outputPath}`);
    } else {
        console.error(`File not found: ${inputPath}`);
    }
});

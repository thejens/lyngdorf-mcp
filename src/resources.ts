import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load parsed manual data from KB
function loadManualData(): Record<string, any> {
  const kbDir = join(dirname(__dirname), 'docs', 'kb');
  const manuals: Record<string, any> = {};

  if (!existsSync(kbDir)) {
    return {};
  }

  try {
    const files = readdirSync(kbDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = readFileSync(join(kbDir, file), 'utf-8');
        const data = JSON.parse(content);
        if (data.model) {
          const key = file.includes('owners') ? `${data.model}-owners` : data.model;
          manuals[key] = data;
        }
      }
    }
  } catch (error) {
    console.error('Error loading manual data:', error);
  }

  return manuals;
}

const parsedManuals = loadManualData();

export interface ManualSection {
  commands?: string;
  troubleshooting?: string;
  full?: string;
}

// In-memory knowledge base (will be loaded from files)
const manualData: Record<string, ManualSection> = {
  'TDAI-1120': {
    commands: `# TDAI-1120 Command Reference

## Connection
- Protocol: TCP on port 84
- Service: _slactrl._tcp.local
- Command format: Commands start with ! and end with \\r (0x0D)

## Power Commands
- !ON - Turn amplifier on
- !OFF - Turn amplifier off
- !PWR - Toggle power (same as standby button)

## Volume Commands
- !VOL(n) - Set volume to n dB (range: -999 to 120, steps of 0.1dB)
- !VOLUP - Increase volume by 0.5dB
- !VOLDN - Decrease volume by 0.5dB
- !VOL? - Query current volume (returns !VOL(n))

## Mute Commands
- !MUTEON - Mute amplifier
- !MUTEOFF - Unmute amplifier

## Source Commands
- !SRC(n) - Select source n
- !SRC? - Query current source (returns !SRC(n))

## RoomPerfect Commands
- !RPFOC(n) - Select RoomPerfect focus position (n=1-8)
- !RPGLOB - Select RoomPerfect Global position
- !RP? - Query current RoomPerfect setting

## Voicing Commands
- !VOI(n) - Select voicing preset n
- !VOIUP - Select next voicing
- !VOIDN - Select previous voicing
- !VOI? - Query current voicing

## System Commands
- !VERB(n) - Set feedback level (0=on request, 1=on change, 2=echo)

## Response Format
- Status messages start with !
- Echo messages start with #
- Messages end with \\r`,

    troubleshooting: `# TDAI-1120 Troubleshooting

## Connection Issues

### Device Not Found
- Ensure device is powered on
- Check network connectivity
- Verify device is on same subnet
- Try manual IP configuration: LYNGDORF_IP=192.168.x.x

### Connection Timeout
- Check firewall settings (allow TCP port 84)
- Verify device firmware is up to date
- Try power cycling the device

## Command Issues

### Commands Not Working
- Verify feedback level is set: !VERB(1)
- Check command format (must start with ! and end with \\r)
- Ensure volume is within range (-999 to 120 dB)

### No Response from Device
- Device may be in standby - send !ON first
- Check network latency
- Try increasing command timeout

## Common Errors

### "Not connected to device"
- Run discoverDevices tool first
- Check device IP in environment variables
- Verify mDNS service is running

### "Command timeout"
- Device may be processing previous command
- Check network stability
- Reduce command frequency

## RoomPerfect Issues

### Focus Position Not Available
- TDAI-1120 supports positions 1-8
- Run RoomPerfect calibration first
- Use !RPGLOB for Global position

## Voicing Issues

### Voicing Not Changing
- Verify voicing presets are configured
- Check if custom voicings are loaded
- Use !VOIUP/!VOIDN to navigate presets`,

    full: `Complete manual content would go here.
For now, refer to official documentation at:
https://lyngdorf.steinwaylyngdorf.com/downloads/lyngdorf-tdai-1120-external-control-manual/`
  },

  'generic': {
    commands: `# Generic Lyngdorf Command Reference

All Lyngdorf devices use the same basic protocol:
- TCP connection on port 84
- mDNS service: _slactrl._tcp.local
- Commands start with ! and end with \\r

Common commands across all models:
- Power: !ON, !OFF, !PWR
- Volume: !VOL(n), !VOLUP, !VOLDN, !VOL?
- Mute: !MUTEON, !MUTEOFF
- Source: !SRC(n), !SRC?
- Feedback: !VERB(n)

Model-specific features:
- TDAI series: RoomPerfect (!RPFOC, !RPGLOB)
- All models: Voicing (!VOI commands)
- MP series: Additional processor commands`,

    troubleshooting: `# General Troubleshooting

1. Check network connectivity
2. Verify device is powered on
3. Ensure mDNS is working on your network
4. Try manual IP configuration
5. Check firewall settings for port 84
6. Update device firmware if available`
  }
};

export function getManualResource(model: string, section: string): string {
  // Handle owner's manual sections
  if (section.startsWith('owners/')) {
    const sectionName = section.replace('owners/', '');
    return getOwnersManualSection(model, sectionName);
  }

  // Handle control manual sections
  if (section === 'commands' || section === 'troubleshooting' || section === 'full') {
    return getControlManualSection(model, section as 'commands' | 'troubleshooting' | 'full');
  }

  return `# ${section} for ${model}\n\nUnknown section type.`;
}

function getControlManualSection(model: string, section: 'commands' | 'troubleshooting' | 'full'): string {
  // Try loading from parsed manuals first
  if (parsedManuals[model]) {
    if (section === 'commands') {
      return formatCommandsFromParsed(model, parsedManuals[model]);
    } else if (section === 'full') {
      return parsedManuals[model].full_text || 'Full manual text not available.';
    } else if (section === 'troubleshooting') {
      const troubleshooting = parsedManuals[model].sections?.troubleshooting;
      return troubleshooting || manualData[model]?.troubleshooting || 'No troubleshooting section available.';
    }
  }

  // Fallback to static manual data
  const manual = manualData[model] || manualData['generic'];
  const content = manual[section];

  if (!content) {
    return `# ${section} for ${model}\n\nNo documentation available for this section.`;
  }

  return content;
}

function getOwnersManualSection(model: string, section: string): string {
  // Check if we have parsed owner's manual data
  const ownersKey = `${model}-owners`;
  const ownersData = parsedManuals[ownersKey];

  if (!ownersData) {
    return `# ${model} Owner's Manual\n\nOwner's manual not available for this model.`;
  }

  // Handle index/TOC
  if (section === 'index' || section === 'toc') {
    // Generate from data
    let output = `# ${model} Owner's Manual - Table of Contents\n\n`;
    output += `Total Pages: ${ownersData.total_pages || 'N/A'}\n\n`;

    if (ownersData.toc && ownersData.toc.length > 0) {
      output += `## Contents\n\n`;
      for (const entry of ownersData.toc) {
        output += `- [${entry.title}](#) (Page ${entry.page})\n`;
      }
      output += '\n';
    }

    if (ownersData.sections) {
      output += `## Available Sections\n\n`;
      for (const [sectionKey, sectionData] of Object.entries(ownersData.sections)) {
        output += `### ${(sectionData as any).title}\n`;
        output += `Access: \`lyngdorf://manual/${model}/owners/${sectionKey}\`\n\n`;
      }
    }

    return output;
  }

  // Get section from parsed JSON data
  if (ownersData.sections && ownersData.sections[section]) {
    const sectionData = ownersData.sections[section];
    let output = `# ${model} Owner's Manual - ${sectionData.title}\n\n`;

    for (const chapter of sectionData.chapters) {
      output += `## ${chapter.title}\n`;
      output += `**Page ${chapter.start_page}**\n\n`;
      output += chapter.content || '';
      output += '\n\n---\n\n';
    }

    return output;
  }

  return `# ${model} Owner's Manual - ${section}\n\nSection not found. Use 'index' to see available sections.`;
}

function formatCommandsFromParsed(model: string, data: any): string {
  let output = `# ${model} Command Reference\n\n`;
  output += `## Connection\n`;
  output += `- Protocol: TCP on port 84\n`;
  output += `- Service: _slactrl._tcp.local\n`;
  output += `- Command format: Commands start with ! and end with \\r (0x0D)\n\n`;

  output += `## Available Commands\n\n`;

  // Sort commands alphabetically
  const commands = Object.entries(data.commands || {}).sort((a, b) => a[0].localeCompare(b[0]));

  for (const [cmdName, cmdData] of commands as Array<[string, any]>) {
    output += `### ${cmdName}\n`;
    output += `**Syntax**: \`${cmdData.command}\\r\`\n\n`;
    output += `${cmdData.description}\n\n`;
  }

  output += `\n## Response Format\n`;
  output += `- Status messages start with !\n`;
  output += `- Echo messages start with #\n`;
  output += `- Messages end with \\r\n`;

  return output;
}

export function searchManuals(query: string): Array<{ model: string; section: string; snippet: string }> {
  const results: Array<{ model: string; section: string; snippet: string }> = [];
  const queryLower = query.toLowerCase();

  // Search parsed manuals first
  for (const [model, data] of Object.entries(parsedManuals)) {
    // Search commands
    for (const [cmdName, cmdData] of Object.entries(data.commands || {})) {
      const cmdDataTyped = cmdData as any;
      const searchText = `${cmdName} ${cmdDataTyped.command} ${cmdDataTyped.description}`.toLowerCase();
      if (searchText.includes(queryLower)) {
        results.push({
          model,
          section: 'commands',
          snippet: `**${cmdName}**: ${cmdDataTyped.command}\n${cmdDataTyped.description.substring(0, 150)}...`
        });
      }
    }

    // Search full text
    if (data.full_text && data.full_text.toLowerCase().includes(queryLower)) {
      const lines = data.full_text.split('\n');
      const matchingLines = lines.filter((line: string) => line.toLowerCase().includes(queryLower));
      if (matchingLines.length > 0) {
        results.push({
          model,
          section: 'manual',
          snippet: matchingLines.slice(0, 2).join('\n')
        });
      }
    }
  }

  // Also search static manual data
  for (const [model, manual] of Object.entries(manualData)) {
    for (const [section, content] of Object.entries(manual)) {
      if (content && content.toLowerCase().includes(queryLower)) {
        const lines = content.split('\n');
        const matchingLines = lines.filter((line: string) => line.toLowerCase().includes(queryLower));

        if (matchingLines.length > 0) {
          results.push({
            model,
            section,
            snippet: matchingLines.slice(0, 3).join('\n')
          });
        }
      }
    }
  }

  return results;
}

export function listAvailableModels(): string[] {
  const staticModels = Object.keys(manualData).filter(m => m !== 'generic');
  const parsedModels = Object.keys(parsedManuals);

  // Combine and deduplicate
  const allModels = [...new Set([...staticModels, ...parsedModels])];
  return allModels.sort();
}

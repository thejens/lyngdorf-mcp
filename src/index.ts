#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { LyngdorfTransport } from './transport.js';
import { LyngdorfDiscovery } from './discovery.js';
import { createTools } from './tools.js';
import { getManualResource, searchManuals, listAvailableModels } from './resources.js';
import type { LyngdorfDevice } from './types.js';

// Volume safety configuration
const volumeConfig = {
  warningThreshold: parseFloat(process.env.VOLUME_WARNING_THRESHOLD || '-15'),
  hardLimit: parseFloat(process.env.VOLUME_HARD_LIMIT || '-10')
};

console.error(`Volume safety configured: Warning at ${volumeConfig.warningThreshold}dB, Hard limit at ${volumeConfig.hardLimit}dB`);

// Global state
let transport: LyngdorfTransport | null = null;
let currentDevice: LyngdorfDevice | null = null; // Renamed from currentDevice
let discoveredDevices: LyngdorfDevice[] = []; // Changed to const
const discovery = new LyngdorfDiscovery();

// Create MCP server
const server = new Server(
  {
    name: 'lyngdorf-audio-control',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// Auto-discover and connect on startup
(async () => {
  try {
    // Try manual IP first
    const manualIp = process.env.LYNGDORF_IP;
    if (manualIp) {
      console.error(`Connecting to manually specified device at ${manualIp}...`);
      const device = await discovery.findDevice(manualIp);
      if (device) {
        currentDevice = device; // Renamed from currentDevice
        transport = new LyngdorfTransport(device);
        await transport.connect();
        console.error(`✓ Connected to ${device.model} at ${device.ip}`);
        return;
      }
    }

    // Auto-discover devices
    console.error('Auto-discovering Lyngdorf devices on network...');
    discoveredDevices = await discovery.discover(3000);

    if (discoveredDevices.length === 0) {
      console.error('! No devices found. Use discoverDevices tool or set LYNGDORF_IP environment variable.');
      return;
    }

    // Auto-connect to first device if only one found
    if (discoveredDevices.length === 1) {
      currentDevice = discoveredDevices[0];
      transport = new LyngdorfTransport(currentDevice);
      await transport.connect();
      console.error(`✓ Auto-connected to ${currentDevice.model} at ${currentDevice.ip}`);
    } else {
      console.error(`✓ Found ${discoveredDevices.length} devices. Use listDevices and selectDevice tools to choose one.`);
    }
  } catch (error) {
    console.error('Auto-discovery failed:', error instanceof Error ? error.message : String(error));
    console.error('Tip: Set LYNGDORF_IP environment variable to bypass discovery');
  }
})();

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'powerOn',
        description: 'Turn the audio amplifier on',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'powerOff',
        description: 'Turn the audio amplifier off',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'togglePower',
        description: 'Toggle amplifier power state',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'setVolume',
        description: 'Set absolute volume level in dB. VOLUME GUIDANCE: dB scale is logarithmic - every 10dB increase doubles perceived loudness. Reference levels: -50 to -40dB (very quiet/background), -40 to -30dB (quiet conversation), -30 to -20dB (normal listening), -20 to -10dB (loud), -10 to 0dB (very loud), above 0dB (extremely loud, risk of speaker/hearing damage). Most music listening happens between -35 and -20 dB. Always be conservative when increasing volume.',
        inputSchema: {
          type: 'object',
          properties: {
            level: { type: 'number', description: 'Absolute volume in dB. Typical range: -40 to -20 dB', minimum: -99.9, maximum: 12.0 }
          },
          required: ['level']
        }
      },
      {
        name: 'volumeUp',
        description: 'Increase volume by 0.5dB steps. VOLUME GUIDANCE: Due to logarithmic nature of dB, single steps (0.5dB) are barely audible. For noticeable changes: use 4-6 steps (2-3dB) for moderate adjustments, or 10+ steps for significant changes. Typical listening: -40 to -30dB (quiet background), -25 to -15dB (moderate), -10 to 0dB (loud). Always check current level first.',
        inputSchema: {
          type: 'object',
          properties: {
            steps: { type: 'number', description: 'Number of 0.5dB steps. Recommend 4-6 steps for audible change', default: 1 }
          }
        }
      },
      {
        name: 'volumeDown',
        description: 'Decrease volume by 0.5dB steps. VOLUME GUIDANCE: Due to logarithmic nature of dB, single steps (0.5dB) are barely audible. For noticeable changes: use 4-6 steps (2-3dB) for moderate adjustments. Typical listening: -40 to -30dB (quiet background), -25 to -15dB (moderate), -10 to 0dB (loud). Always check current level first.',
        inputSchema: {
          type: 'object',
          properties: {
            steps: { type: 'number', description: 'Number of 0.5dB steps. Recommend 4-6 steps for audible change', default: 1 }
          }
        }
      },
      {
        name: 'getVolume',
        description: 'Get current music/audio volume level',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'mute',
        description: 'Mute the audio/music',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'unmute',
        description: 'Unmute the audio/music',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'setBass',
        description: 'Set bass gain level (-12 to +12 dB)',
        inputSchema: {
          type: 'object',
          properties: {
            gain: { type: 'number', description: 'Bass gain in dB', minimum: -12, maximum: 12 }
          },
          required: ['gain']
        }
      },
      {
        name: 'getBass',
        description: 'Get current bass gain level',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'setBassFrequency',
        description: 'Set bass frequency (20 to 800 Hz)',
        inputSchema: {
          type: 'object',
          properties: {
            frequency: { type: 'number', description: 'Bass frequency in Hz', minimum: 20, maximum: 800 }
          },
          required: ['frequency']
        }
      },
      {
        name: 'getBassFrequency',
        description: 'Get current bass frequency',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'setTreble',
        description: 'Set treble gain level (-12 to +12 dB)',
        inputSchema: {
          type: 'object',
          properties: {
            gain: { type: 'number', description: 'Treble gain in dB', minimum: -12, maximum: 12 }
          },
          required: ['gain']
        }
      },
      {
        name: 'getTreble',
        description: 'Get current treble gain level',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'setTrebleFrequency',
        description: 'Set treble frequency (1500 to 16000 Hz)',
        inputSchema: {
          type: 'object',
          properties: {
            frequency: { type: 'number', description: 'Treble frequency in Hz', minimum: 1500, maximum: 16000 }
          },
          required: ['frequency']
        }
      },
      {
        name: 'getTrebleFrequency',
        description: 'Get current treble frequency',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'setBalance',
        description: 'Set left/right balance (L10-L1, 0, R1-R10)',
        inputSchema: {
          type: 'object',
          properties: {
            balance: { type: 'string', description: 'Balance setting: L10-L1 (left), 0 (center), R1-R10 (right)' }
          },
          required: ['balance']
        }
      },
      {
        name: 'getBalance',
        description: 'Get current left/right balance',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'setSource',
        description: 'Set input source',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'number', description: 'Source number' }
          },
          required: ['source']
        }
      },
      {
        name: 'getSource',
        description: 'Get current audio input source',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'setRoomPerfectFocus',
        description: 'Set RoomPerfect focus position (1-8)',
        inputSchema: {
          type: 'object',
          properties: {
            position: { type: 'number', description: 'Focus position (1-8)', minimum: 1, maximum: 8 }
          },
          required: ['position']
        }
      },
      {
        name: 'setRoomPerfectGlobal',
        description: 'Set RoomPerfect to Global position',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'getRoomPerfect',
        description: 'Get current RoomPerfect setting',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'setVoicing',
        description: 'Set voicing preset',
        inputSchema: {
          type: 'object',
          properties: {
            voicing: { type: 'number', description: 'Voicing preset number' }
          },
          required: ['voicing']
        }
      },
      {
        name: 'nextVoicing',
        description: 'Switch to next voicing preset',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'previousVoicing',
        description: 'Switch to previous voicing preset',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'getVoicing',
        description: 'Get current voicing preset',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'play',
        description: 'Toggle music playback (play/pause). Works with streaming sources like Spotify, AirPlay, Roon, etc.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'pause',
        description: 'Pause music playback (same as play - it toggles). Works with streaming sources.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'next',
        description: 'Skip to next track. Works with streaming sources.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'previous',
        description: 'Go to previous track. Works with streaming sources.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'listSources',
        description: 'List all available input sources with their actual names from the device',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'listRoomPerfectPositions',
        description: 'List all RoomPerfect positions with their names from the device',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'getMuteStatus',
        description: 'Check if audio is currently muted',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'getStreamType',
        description: 'Get the current streaming service (Spotify, AirPlay, Roon, etc.)',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'getAudioStatus',
        description: 'Get current audio format information',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'getDeviceInfo',
        description: 'Get device model and identification information',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'discoverDevices',
        description: 'Discover Lyngdorf devices on the network via mDNS',
        inputSchema: {
          type: 'object',
          properties: {
            timeout: { type: 'number', description: 'Discovery timeout in ms (default: 3000)', default: 3000 }
          }
        }
      },
      {
        name: 'listDevices',
        description: 'List all discovered Lyngdorf devices',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'selectDevice',
        description: 'Select and connect to a specific device by number',
        inputSchema: {
          type: 'object',
          properties: {
            device_number: { type: 'number', description: 'Device number from listDevices (1-indexed)' }
          },
          required: ['device_number']
        }
      },
      {
        name: 'listVoicings',
        description: 'List available voicing presets and show current selection',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'getStatus',
        description: 'Get comprehensive device status',
        inputSchema: { type: 'object', properties: {} }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tools = createTools(
    () => transport,
    () => discoveredDevices,
    (device: LyngdorfDevice, newTransport: LyngdorfTransport) => {
      currentDevice = device;
      if (transport) transport.disconnect();
      transport = newTransport;
    },
    discovery,
    volumeConfig, // Add volume config parameter
    () => currentDevice // Add getCurrentDevice callback
  );
  const toolName = request.params.name as keyof typeof tools;
  const tool = tools[toolName];

  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  try {
    const result = await tool.handler(request.params.arguments as any || {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const models = listAvailableModels();
  const resources: Array<{ uri: string; name: string; description: string; mimeType: string }> = [];

  for (const model of models) {
    // Skip owner's manual entries in model list
    if (model.includes('-owners')) continue;

    // Control manual resources
    resources.push(
      {
        uri: `lyngdorf://manual/${model}/commands`,
        name: `${model} Command Reference`,
        description: `Complete command reference for ${model}`,
        mimeType: 'text/markdown'
      },
      {
        uri: `lyngdorf://manual/${model}/troubleshooting`,
        name: `${model} Troubleshooting`,
        description: `Troubleshooting guide for ${model}`,
        mimeType: 'text/markdown'
      },
      {
        uri: `lyngdorf://manual/${model}/full`,
        name: `${model} Full Manual`,
        description: `Complete manual for ${model}`,
        mimeType: 'text/markdown'
      }
    );

    // Owner's manual resources
    resources.push(
      {
        uri: `lyngdorf://manual/${model}/owners/index`,
        name: `${model} Owner's Manual - Table of Contents`,
        description: `Complete table of contents for ${model} owner's manual`,
        mimeType: 'text/markdown'
      },
      {
        uri: `lyngdorf://manual/${model}/owners/setup`,
        name: `${model} Owner's Manual - Setup`,
        description: `Setup and installation guide`,
        mimeType: 'text/markdown'
      },
      {
        uri: `lyngdorf://manual/${model}/owners/features`,
        name: `${model} Owner's Manual - Features`,
        description: `Features and operation guide`,
        mimeType: 'text/markdown'
      },
      {
        uri: `lyngdorf://manual/${model}/owners/roomperfect`,
        name: `${model} Owner's Manual - RoomPerfect`,
        description: `RoomPerfect calibration guide`,
        mimeType: 'text/markdown'
      }
    );
  }

  // Add search resource
  resources.push({
    uri: 'lyngdorf://search',
    name: 'Search All Manuals',
    description: 'Search across all Lyngdorf manuals',
    mimeType: 'text/markdown'
  });

  return { resources };
});

// Read resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri.startsWith('lyngdorf://manual/')) {
    const parts = uri.replace('lyngdorf://manual/', '').split('/');
    const model = parts[0];

    // Handle owner's manual sections (e.g., owners/setup)
    if (parts[1] === 'owners' && parts[2]) {
      const section = `owners/${parts[2]}`;
      const content = getManualResource(model, section);
      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: content
          }
        ]
      };
    }

    // Handle control manual sections
    const section = parts[1] as 'commands' | 'troubleshooting' | 'full';
    const content = getManualResource(model, section);
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: content
        }
      ]
    };
  }

  if (uri.startsWith('lyngdorf://search?q=')) {
    const query = decodeURIComponent(uri.replace('lyngdorf://search?q=', ''));
    const results = searchManuals(query);

    const content = `# Search Results for "${query}"\n\n${results.length === 0
      ? 'No results found.'
      : results.map(r => `## ${r.model} - ${r.section}\n\n${r.snippet}\n`).join('\n')
      }`;

    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: content
        }
      ]
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Lyngdorf MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

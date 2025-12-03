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

// Global state
let transport: LyngdorfTransport | null = null;
let discoveredDevices: LyngdorfDevice[] = [];
let selectedDevice: LyngdorfDevice | null = null;
const discovery = new LyngdorfDiscovery();

// Create MCP server
const server = new Server(
  {
    name: 'lyngdorf-mcp',
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
        selectedDevice = device;
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
      selectedDevice = discoveredDevices[0];
      transport = new LyngdorfTransport(selectedDevice);
      await transport.connect();
      console.error(`✓ Auto-connected to ${selectedDevice.model} at ${selectedDevice.ip}`);
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
        description: 'Turn the amplifier on',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'powerOff',
        description: 'Turn the amplifier off',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'togglePower',
        description: 'Toggle power state',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'setVolume',
        description: 'Set volume level in dB (-999 to 120)',
        inputSchema: {
          type: 'object',
          properties: {
            level: { type: 'number', description: 'Volume level in dB', minimum: -999, maximum: 120 }
          },
          required: ['level']
        }
      },
      {
        name: 'volumeUp',
        description: 'Increase volume by 0.5dB steps',
        inputSchema: {
          type: 'object',
          properties: {
            steps: { type: 'number', description: 'Number of steps (default: 1)', default: 1 }
          }
        }
      },
      {
        name: 'volumeDown',
        description: 'Decrease volume by 0.5dB steps',
        inputSchema: {
          type: 'object',
          properties: {
            steps: { type: 'number', description: 'Number of steps (default: 1)', default: 1 }
          }
        }
      },
      {
        name: 'getVolume',
        description: 'Get current volume level',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'mute',
        description: 'Mute the amplifier',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'unmute',
        description: 'Unmute the amplifier',
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
        description: 'Get current input source',
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
        description: 'Start playback (model-dependent)',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'pause',
        description: 'Pause playback (model-dependent)',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'next',
        description: 'Next track (model-dependent)',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'previous',
        description: 'Previous track (model-dependent)',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'stop',
        description: 'Stop playback (model-dependent)',
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
      selectedDevice = device;
      if (transport) transport.disconnect();
      transport = newTransport;
    },
    discovery
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

    const content = `# Search Results for "${query}"\n\n${
      results.length === 0
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

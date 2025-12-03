# Lyngdorf MCP Server

> **DISCLAIMER**: This project is an independent, community-developed tool and is **NOT affiliated with, endorsed by, or supported by Lyngdorf Audio**. Use at your own risk. For official Lyngdorf products and support, visit [lyngdorf.steinwaylyngdorf.com](https://lyngdorf.steinwaylyngdorf.com/).

> **CODE GENERATION**: Most of this codebase was generated using [Claude Code](https://claude.com/claude-code), Anthropic's AI coding agent. The implementation demonstrates Claude Code's ability to create production-ready software from high-level requirements.

A Model Context Protocol (MCP) server for controlling Lyngdorf Audio devices (TDAI, MP, and CD series) via TCP. Features automatic device discovery, comprehensive control, and built-in documentation.

## Features

- 🔍 **Auto-Discovery**: Automatically finds and connects to Lyngdorf devices on startup
- 🎵 **27 Control Tools**: Power, volume, source, RoomPerfect, voicing, playback, and device management
- 📚 **Knowledge Base**: Real manual data (43+ commands extracted from official PDFs)
- 🔄 **Auto-Reconnect**: Maintains connection with automatic recovery
- 🌐 **Multi-Device**: Supports TDAI, MP, and CD series with device switching
- ⚡ **Just Works**: Smart defaults - no configuration needed for single-device setups

## Supported Devices

- **TDAI Series**: 1120, 2170, 3400 (Integrated Amplifiers)
- **MP Series**: 40, 50, 60 (Processors)
- **CD Series**: CD-1 (CD Player)

## Installation

### Prerequisites

- Node.js 22+ (for built-in type stripping)
- npm or yarn

### Install from Source

```bash
git clone <repository-url>
cd lyngdorf-mcp
npm install
npm run build
```

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "lyngdorf": {
      "command": "node",
      "args": ["/absolute/path/to/lyngdorf-mcp/dist/index.js"]
    }
  }
}
```

### How It Works

On startup, the server:
1. **Auto-discovers** all Lyngdorf devices on your network via mDNS
2. **Auto-connects** if exactly one device is found
3. **Lists devices** if multiple are found (use `listDevices` and `selectDevice` tools)

No manual configuration needed! Just start Claude Desktop and ask:
> "What's my current volume?"

### Manual IP Configuration (Optional)

If auto-discovery doesn't work:

```json
{
  "mcpServers": {
    "lyngdorf": {
      "command": "node",
      "args": ["/absolute/path/to/lyngdorf-mcp/dist/index.js"],
      "env": {
        "LYNGDORF_IP": "192.168.1.100"
      }
    }
  }
}
```

## Available Tools (27)

### Power Control (3)
- `powerOn` - Turn device on
- `powerOff` - Turn device off
- `togglePower` - Toggle power state

### Volume Control (4)
- `setVolume` - Set volume (-999 to 120 dB)
- `volumeUp` - Increase by 0.5dB steps
- `volumeDown` - Decrease by 0.5dB steps
- `getVolume` - Get current volume

### Mute Control (2)
- `mute` - Mute device
- `unmute` - Unmute device

### Source Selection (2)
- `setSource` - Change input source
- `getSource` - Get current source

### RoomPerfect Control (3)
- `setRoomPerfectFocus` - Set focus position (1-8)
- `setRoomPerfectGlobal` - Set to Global position
- `getRoomPerfect` - Get current setting

### Voicing Control (5)
- `setVoicing` - Set voicing preset
- `nextVoicing` - Switch to next voicing
- `previousVoicing` - Switch to previous voicing
- `getVoicing` - Get current voicing
- `listVoicings` - List available voicings

### Playback Control (5) *Model-dependent*
- `play` - Start playback
- `pause` - Pause playback
- `next` - Next track
- `previous` - Previous track
- `stop` - Stop playback

### Device Management (3)
- `discoverDevices` - Scan network for devices
- `listDevices` - List discovered devices
- `selectDevice` - Switch to different device

### System (1)
- `getStatus` - Get comprehensive device status

## Available Resources

Access manuals and documentation as MCP resources:

### Control Manuals
- `lyngdorf://manual/{model}/commands` - Command reference (43+ commands from real PDFs)
- `lyngdorf://manual/{model}/troubleshooting` - Troubleshooting guide
- `lyngdorf://manual/{model}/full` - Complete manual text

### Owner's Manuals (Chapter Navigation)
- `lyngdorf://manual/{model}/owners/index` - Table of contents with all sections
- `lyngdorf://manual/{model}/owners/setup` - Setup & installation guide
- `lyngdorf://manual/{model}/owners/features` - Features & operation guide
- `lyngdorf://manual/{model}/owners/roomperfect` - RoomPerfect calibration guide

### Search
- `lyngdorf://search?q={query}` - Search all manuals

**Examples:**
> "Show me the TDAI-1120 command reference"
Claude reads `lyngdorf://manual/TDAI-1120/commands`

> "How do I set up RoomPerfect?"
Claude reads `lyngdorf://manual/TDAI-1120/owners/roomperfect`

> "Show me the owner's manual table of contents"
Claude reads `lyngdorf://manual/TDAI-1120/owners/index`

## Example Conversations

```
"What's my current volume?"
→ Uses getVolume, shows current level

"Set volume to -30dB"
→ Uses setVolume with level -30

"Switch to RoomPerfect focus position 2"
→ Uses setRoomPerfectFocus with position 2

"List all available voicings"
→ Uses listVoicings, shows current and available presets

"Find all my Lyngdorf devices"
→ Uses discoverDevices, shows all devices on network

"Switch to device 2"
→ Uses selectDevice with device_number 2
```

## Troubleshooting

### No Devices Found

1. Ensure device is powered on
2. Check network (device must be on same subnet)
3. Test mDNS: `dns-sd -B _slactrl._tcp`
4. Try manual IP in config

### Multiple Devices

Use `listDevices` to see all discovered devices, then `selectDevice` to choose one:
```
"List my devices"
"Select device 2"
```

### Connection Issues

- Check firewall (allow TCP port 84)
- Verify device firmware is up to date
- Power cycle device
- Ask Claude: "Show me the troubleshooting guide"

## Development

### Run in Development Mode

```bash
npm run dev
```

Uses Node 22+ type stripping for instant reload.

### Build

```bash
npm run build
```

### Test

```bash
npm test              # Run tests once
npm run test:watch    # Run tests in watch mode
```

**Test Coverage:**
- 98 passing tests
- Types & Schemas validation
- Transport layer response parsing
- Discovery model extraction
- Resource loading & search
- Tool structure & error handling
- Device management

### Project Structure

```
lyngdorf-mcp/
├── src/                         # TypeScript source (1,664 lines)
│   ├── index.ts                # MCP server + auto-discovery
│   ├── transport.ts            # TCP communication
│   ├── discovery.ts            # mDNS discovery
│   ├── tools.ts               # 27 tool implementations
│   ├── resources.ts           # Knowledge base with chapter navigation
│   └── types.ts               # Types & schemas
├── docs/
│   ├── kb/                    # Parsed manuals
│   │   ├── TDAI-1120.json            # 43 commands (19KB)
│   │   ├── TDAI-1120-owners.json     # 67 chapters, 31 pages (57KB)
│   │   ├── TDAI-1120-owners-index.md
│   │   ├── TDAI-1120-owners-setup.md
│   │   ├── TDAI-1120-owners-features.md
│   │   └── TDAI-1120-owners-roomperfect.md
│   └── manuals/              # Original PDFs
├── scripts/
│   ├── parse_manual.py           # Control manual parser
│   └── parse_owners_manual.py    # Owner's manual parser
└── dist/                      # Compiled output (172KB)
```

## Protocol Details

**Connection:**
- Port: 84 (TCP)
- Service: `_slactrl._tcp.local` (mDNS)
- Commands: Start with `!`, end with `\r`
- Responses: Status (`!`) or echo (`#`)

**Example Commands:**
```
!ON              - Power on
!VOL(-30.5)      - Set volume to -30.5 dB
!RPFOC(3)        - RoomPerfect focus position 3
!VOI(1)          - Voicing preset 1
```

## Dependencies

- `@modelcontextprotocol/sdk` - MCP framework
- `zod` - Runtime validation
- `node-dns-sd` - Pure JS mDNS discovery
- Node.js `net` module - TCP communication

## Development

This project was built using **Claude Code**, demonstrating:

- **Iterative Development**: From initial concept to production-ready code
- **Real-World Integration**: Parsing official PDFs, implementing TCP protocols
- **Best Practices**: Following Anthropic's guidelines for AI agent tools
- **Comprehensive Testing**: 98 passing tests with Vitest
- **Documentation First**: Auto-generated resources from manufacturer manuals

**Build Stats:**
- 1,637 lines of TypeScript
- 172KB compiled output
- ~400ms test execution
- 76KB knowledge base (43 commands + 31-page owner's manual)

## License

MIT

## Contributing

Contributions welcome! Please:
- Follow existing code style (compact, functional)
- Update documentation
- Add tests for new features
- Ensure `npm test` passes
- Keep dependencies minimal

## Disclaimer

This is an independent project developed by the community. It is **NOT affiliated with, endorsed by, or supported by Lyngdorf Audio A/S or Steinway Lyngdorf**.

- Use at your own risk
- No warranty provided
- Not responsible for any damage to equipment
- For official support, contact Lyngdorf Audio

**Trademarks:** Lyngdorf®, RoomPerfect®, and related marks are trademarks of Lyngdorf Audio A/S. This project uses these names solely for identification purposes.

## Resources

- [Lyngdorf Audio Official Site](https://lyngdorf.steinwaylyngdorf.com/)
- [MCP Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [External Control Manuals](https://lyngdorf.steinwaylyngdorf.com/download-center/)

## Acknowledgments

- Protocol research from [LyngdorfBrowser](https://github.com/michaelmsonne/LyngdorfBrowser)
- MCP SDK by Anthropic
- Lyngdorf Audio for excellent documentation

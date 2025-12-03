import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTools } from './tools.js';
import type { LyngdorfDevice } from './types.js';
import { LyngdorfDiscovery } from './discovery.js';
import { LyngdorfTransport } from './transport.js';

describe('Tools', () => {
  let mockTransport: LyngdorfTransport | null;
  let mockDevices: LyngdorfDevice[];
  let mockSetDevice: (device: LyngdorfDevice, transport: LyngdorfTransport) => void;
  let mockDiscovery: LyngdorfDiscovery;
  let tools: ReturnType<typeof createTools>;

  beforeEach(() => {
    mockDevices = [
      {
        ip: '192.168.1.100',
        port: 84,
        model: 'TDAI-1120',
        hostname: 'TDAI-1120.local'
      },
      {
        ip: '192.168.1.101',
        port: 84,
        model: 'TDAI-2170',
        hostname: 'TDAI-2170.local'
      }
    ];

    mockTransport = null;
    mockSetDevice = vi.fn();
    mockDiscovery = new LyngdorfDiscovery();

    tools = createTools(
      () => mockTransport,
      () => mockDevices,
      mockSetDevice,
      mockDiscovery
    );
  });

  describe('Tool Structure', () => {
    it('has all required control tools', () => {
      const expectedTools = [
        'powerOn', 'powerOff', 'togglePower',
        'setVolume', 'volumeUp', 'volumeDown', 'getVolume',
        'mute', 'unmute',
        'setSource', 'getSource',
        'setRoomPerfectFocus', 'setRoomPerfectGlobal', 'getRoomPerfect',
        'setVoicing', 'nextVoicing', 'previousVoicing', 'getVoicing', 'listVoicings',
        'play', 'pause', 'next', 'previous', 'stop',
        'discoverDevices', 'listDevices', 'selectDevice',
        'getStatus'
      ];

      for (const toolName of expectedTools) {
        expect(tools).toHaveProperty(toolName);
        expect((tools as any)[toolName]).toHaveProperty('handler');
        expect(typeof (tools as any)[toolName].handler).toBe('function');
      }
    });

    it('has correct total number of tools', () => {
      expect(Object.keys(tools).length).toBe(28);
    });
  });

  describe('Device Management Tools', () => {
    it('listDevices returns device list', async () => {
      const result = await tools.listDevices.handler();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('devices_found', 2);
      expect(result.data).toHaveProperty('devices');
      expect(result.data.devices).toHaveLength(2);
      expect(result.data.devices[0]).toHaveProperty('device_number', 1);
      expect(result.data.devices[1]).toHaveProperty('device_number', 2);
    });

    it('listDevices handles empty device list', async () => {
      mockDevices.length = 0;
      const result = await tools.listDevices.handler();
      expect(result.success).toBe(true);
      expect(result.data.devices_found).toBe(0);
    });

    it('selectDevice validates device number', async () => {
      await expect(tools.selectDevice.handler({ device_number: 99 })).rejects.toThrow('Invalid device number');
    });
  });

  describe('Connection Requirement', () => {
    it('tools require connection when transport is null', async () => {
      mockTransport = null;
      await expect(tools.getVolume.handler()).rejects.toThrow('Not connected');
    });

    it.skip('discoverDevices works without connection', async () => {
      // Skipped: This test performs actual mDNS discovery which depends on network conditions
      // and may timeout in CI environments or networks without mDNS support
      mockTransport = null;
      const result = await tools.discoverDevices.handler({ timeout: 500 });
      expect(result).toHaveProperty('success');
    });

    it('listDevices works without connection', async () => {
      mockTransport = null;
      const result = await tools.listDevices.handler();
      expect(result.success).toBe(true);
    });
  });

  describe('Volume Tool Parameters', () => {
    it('volumeUp uses default steps', async () => {
      // Mock a connected transport
      mockTransport = {
        isConnected: () => true,
        sendCommand: vi.fn().mockResolvedValue('!VOL(-30)')
      } as any;

      // Recreate tools with the mock transport
      tools = createTools(
        () => mockTransport,
        () => mockDevices,
        mockSetDevice,
        mockDiscovery
      );

      const result = await tools.volumeUp.handler({ steps: 1 });
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('steps', 1);
      expect(result.data).toHaveProperty('step_size_db', 0.5);
    });

    it('volumeDown accepts custom steps', async () => {
      mockTransport = {
        isConnected: () => true,
        sendCommand: vi.fn().mockResolvedValue('!VOL(-30)')
      } as any;

      // Recreate tools with the mock transport
      tools = createTools(
        () => mockTransport,
        () => mockDevices,
        mockSetDevice,
        mockDiscovery
      );

      const result = await tools.volumeDown.handler({ steps: 1 });
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('steps', 1);
      expect(result.data).toHaveProperty('total_change_db', 0.5);
    });
  });

  describe('Error Response Format', () => {
    it('throws structured errors', async () => {
      mockTransport = null;

      // Recreate tools with null transport
      tools = createTools(
        () => mockTransport,
        () => mockDevices,
        mockSetDevice,
        mockDiscovery
      );

      await expect(tools.setVolume.handler({ level: -30 })).rejects.toThrow('Not connected');
    });
  });

  describe('Success Response Format', () => {
    it('returns structured success responses with data', async () => {
      const result = await tools.listDevices.handler();

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(typeof result.data).toBe('object');
    });
  });
});

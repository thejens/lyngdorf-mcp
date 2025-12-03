import { LyngdorfTransport } from './transport.js';
import type { LyngdorfDiscovery } from './discovery.js';
import type { LyngdorfDevice } from './types.js';
import {
  SetVolumeInput,
  VolumeStepInput,
  SetSourceInput,
  SetRoomPerfectFocusInput,
  SetVoicingInput,
  DiscoverDevicesInput
} from './types.js';
import { z } from 'zod';

export function createTools(
  getTransport: () => LyngdorfTransport | null,
  getDevices: () => LyngdorfDevice[],
  setDevice: (device: LyngdorfDevice, transport: LyngdorfTransport) => void,
  discovery: LyngdorfDiscovery
) {
  const requireConnection = () => {
    const transport = getTransport();
    if (!transport || !transport.isConnected()) {
      throw new Error(
        'Not connected to Lyngdorf device. ' +
        'Please use the listDevices tool to see available devices, or set the LYNGDORF_IP environment variable to your device IP address (e.g., 192.168.1.100).'
      );
    }
    return transport;
  };

  return {
    // Power controls
    powerOn: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        await t.sendCommand('!ON');
        return { success: true, data: 'Device powered on' };
      }
    },

    powerOff: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        await t.sendCommand('!OFF');
        return { success: true, data: 'Device powered off' };
      }
    },

    togglePower: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        await t.sendCommand('!PWR');
        return { success: true, data: 'Power toggled' };
      }
    },

    // Volume controls
    setVolume: {
      schema: SetVolumeInput,
      handler: async ({ level }: { level: number }) => {
        const t = requireConnection();
        try {
          await t.sendCommand(`!VOL(${level})`);
          return {
            success: true,
            data: {
              action: 'volume_set',
              volume_db: level,
              message: `Volume set to ${level}dB`,
              note: level > -20 ? 'Warning: High volume level' : undefined
            }
          };
        } catch (error) {
          throw new Error(`Failed to set volume to ${level}dB. Ensure the value is within the valid range (-999 to 120 dB) and the device is powered on.`);
        }
      }
    },

    volumeUp: {
      schema: VolumeStepInput,
      handler: async ({ steps = 1 }: { steps?: number }) => {
        const t = requireConnection();
        try {
          for (let i = 0; i < steps; i++) {
            await t.sendCommand('!VOLUP');
          }
          return {
            success: true,
            data: {
              action: 'volume_increased',
              steps,
              step_size_db: 0.5,
              total_change_db: steps * 0.5,
              message: `Volume increased by ${steps * 0.5}dB (${steps} step${steps > 1 ? 's' : ''})`
            }
          };
        } catch (error) {
          throw new Error(`Failed to increase volume. The device may be at maximum volume or not responding.`);
        }
      }
    },

    volumeDown: {
      schema: VolumeStepInput,
      handler: async ({ steps = 1 }: { steps?: number }) => {
        const t = requireConnection();
        try {
          for (let i = 0; i < steps; i++) {
            await t.sendCommand('!VOLDN');
          }
          return {
            success: true,
            data: {
              action: 'volume_decreased',
              steps,
              step_size_db: 0.5,
              total_change_db: steps * 0.5,
              message: `Volume decreased by ${steps * 0.5}dB (${steps} step${steps > 1 ? 's' : ''})`
            }
          };
        } catch (error) {
          throw new Error(`Failed to decrease volume. The device may be at minimum volume or not responding.`);
        }
      }
    },

    getVolume: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        try {
          const response = await t.sendCommand('!VOL?');
          const volume = t.parseVolumeResponse(response);
          return {
            success: true,
            data: {
              current_volume_db: volume,
              range: { minimum: -999, maximum: 120 },
              unit: 'dB',
              message: `Current volume: ${volume}dB`
            }
          };
        } catch (error) {
          throw new Error(`Failed to query volume. Ensure the device is powered on and responding.`);
        }
      }
    },

    // Mute controls
    mute: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        await t.sendCommand('!MUTEON');
        return { success: true, data: 'Muted' };
      }
    },

    unmute: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        await t.sendCommand('!MUTEOFF');
        return { success: true, data: 'Unmuted' };
      }
    },

    // Source controls
    setSource: {
      schema: SetSourceInput,
      handler: async ({ source }: { source: number }) => {
        const t = requireConnection();
        await t.sendCommand(`!SRC(${source})`);
        return { success: true, data: `Source set to ${source}` };
      }
    },

    getSource: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        const response = await t.sendCommand('!SRC?');
        const source = t.parseSourceResponse(response);
        return { success: true, data: { source } };
      }
    },

    // RoomPerfect controls
    setRoomPerfectFocus: {
      schema: SetRoomPerfectFocusInput,
      handler: async ({ position }: { position: number }) => {
        const t = requireConnection();
        await t.sendCommand(`!RPFOC(${position})`);
        return { success: true, data: `RoomPerfect focus set to position ${position}` };
      }
    },

    setRoomPerfectGlobal: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        await t.sendCommand('!RPGLOB');
        return { success: true, data: 'RoomPerfect set to Global' };
      }
    },

    getRoomPerfect: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        const response = await t.sendCommand('!RP?');
        const setting = t.parseRoomPerfectResponse(response);
        return { success: true, data: { roomPerfect: setting } };
      }
    },

    // Voicing controls
    setVoicing: {
      schema: SetVoicingInput,
      handler: async ({ voicing }: { voicing: number }) => {
        const t = requireConnection();
        await t.sendCommand(`!VOI(${voicing})`);
        return { success: true, data: `Voicing set to ${voicing}` };
      }
    },

    nextVoicing: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        await t.sendCommand('!VOIUP');
        return { success: true, data: 'Switched to next voicing' };
      }
    },

    previousVoicing: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        await t.sendCommand('!VOIDN');
        return { success: true, data: 'Switched to previous voicing' };
      }
    },

    getVoicing: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        const response = await t.sendCommand('!VOI?');
        const voicing = t.parseVoicingResponse(response);
        return { success: true, data: { voicing } };
      }
    },

    // Playback controls (may not be available on all models)
    play: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        await t.sendCommand('!PLAY');
        return { success: true, data: 'Playback started' };
      }
    },

    pause: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        await t.sendCommand('!PAUSE');
        return { success: true, data: 'Playback paused' };
      }
    },

    next: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        await t.sendCommand('!NEXT');
        return { success: true, data: 'Next track' };
      }
    },

    previous: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        await t.sendCommand('!PREV');
        return { success: true, data: 'Previous track' };
      }
    },

    stop: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        await t.sendCommand('!STOP');
        return { success: true, data: 'Playback stopped' };
      }
    },

    // Discovery
    discoverDevices: {
      schema: DiscoverDevicesInput,
      handler: async ({ timeout = 3000 }: { timeout?: number }) => {
        try {
          const devices = await discovery.discover(timeout);

          if (devices.length === 0) {
            return {
              success: true,
              data: {
                devices_found: 0,
                devices: [],
                message: 'No Lyngdorf devices found on the network.',
                troubleshooting: [
                  'Ensure device is powered on',
                  'Check network connectivity (device must be on same subnet)',
                  'Verify mDNS is working on your network',
                  'Try setting LYNGDORF_IP environment variable manually'
                ]
              }
            };
          }

          return {
            success: true,
            data: {
              devices_found: devices.length,
              devices: devices.map((d, index) => ({
                device_number: index + 1,  // Human-readable numbering
                model_name: d.model,
                ip_address: d.ip,
                hostname: d.hostname,
                port: d.port
              })),
              message: `Found ${devices.length} Lyngdorf device${devices.length > 1 ? 's' : ''}`,
              next_steps: devices.length === 1
                ? `Set LYNGDORF_IP=${devices[0].ip} to connect automatically`
                : 'Set LYNGDORF_IP to the IP address of the device you want to control'
            }
          };
        } catch (error) {
          throw new Error(
            `Discovery failed: ${error instanceof Error ? error.message : String(error)}. ` +
            'Check that mDNS is enabled on your network and the device is powered on.'
          );
        }
      }
    },

    // Device Management
    listDevices: {
      schema: {},
      handler: async () => {
        const devices = getDevices();
        return {
          success: true,
          data: {
            devices_found: devices.length,
            devices: devices.map((d, index) => ({
              device_number: index + 1,
              model_name: d.model,
              ip_address: d.ip,
              hostname: d.hostname,
              port: d.port
            })),
            message: devices.length === 0
              ? 'No devices discovered yet. Run discoverDevices to scan the network.'
              : `${devices.length} device${devices.length > 1 ? 's' : ''} available`
          }
        };
      }
    },

    selectDevice: {
      schema: z.object({
        device_number: z.number().int().positive().describe('Device number from listDevices (1-indexed)')
      }),
      handler: async ({ device_number }: { device_number: number }) => {
        const devices = getDevices();
        const index = device_number - 1;

        if (index < 0 || index >= devices.length) {
          throw new Error(
            `Invalid device number ${device_number}. ` +
            `Use listDevices to see available devices (1-${devices.length}).`
          );
        }

        const device = devices[index];
        const newTransport = new LyngdorfTransport(device);

        try {
          await newTransport.connect();
          setDevice(device, newTransport);

          return {
            success: true,
            data: {
              action: 'device_selected',
              device_number,
              model_name: device.model,
              ip_address: device.ip,
              message: `Connected to ${device.model} at ${device.ip}`
            }
          };
        } catch (error) {
          throw new Error(
            `Failed to connect to ${device.model} at ${device.ip}. ` +
            `Ensure the device is powered on and network is accessible.`
          );
        }
      }
    },

    // Voicing Management
    listVoicings: {
      schema: {},
      handler: async () => {
        const t = requireConnection();
        try {
          // Try to query voicing names - this may not be supported on all models
          const currentRes = await t.sendCommand('!VOI?');
          const current = t.parseVoicingResponse(currentRes);

          // Note: The actual voicing names would need to be queried individually
          // For now, return available preset numbers with current selection
          return {
            success: true,
            data: {
              current_voicing: current,
              available_voicings: [
                { number: 1, name: 'Voicing 1' },
                { number: 2, name: 'Voicing 2' },
                { number: 3, name: 'Voicing 3' },
                { number: 4, name: 'Voicing 4' }
              ],
              message: `Current voicing: ${current}. Use setVoicing, nextVoicing, or previousVoicing to change.`,
              note: 'Voicing names may vary based on your device configuration. Use nextVoicing/previousVoicing to browse available options.'
            }
          };
        } catch (error) {
          throw new Error(
            `Failed to query voicings. This feature may not be available on your device model.`
          );
        }
      }
    },

    // Status
    getStatus: {
      schema: {},
      handler: async () => {
        const t = requireConnection();

        try {
          const [volRes, srcRes, voiRes, rpRes] = await Promise.allSettled([
            t.sendCommand('!VOL?'),
            t.sendCommand('!SRC?'),
            t.sendCommand('!VOI?'),
            t.sendCommand('!RP?')
          ]);

          const volume = volRes.status === 'fulfilled' ? t.parseVolumeResponse(volRes.value) : null;
          const source = srcRes.status === 'fulfilled' ? t.parseSourceResponse(srcRes.value) : null;
          const voicing = voiRes.status === 'fulfilled' ? t.parseVoicingResponse(voiRes.value) : null;
          const roomPerfect = rpRes.status === 'fulfilled' ? t.parseRoomPerfectResponse(rpRes.value) : null;

          return {
            success: true,
            data: {
              connection_status: 'connected',
              current_state: {
                volume_db: volume,
                input_source: source,
                voicing_preset: voicing,
                room_perfect: roomPerfect
              },
              capabilities: {
                volume_range: { min: -999, max: 120 },
                step_size: { up_down: 0.5, set: 0.1 }
              },
              message: `Device Status: Volume ${volume}dB, Source ${source}, Voicing ${voicing}, RoomPerfect ${roomPerfect}`
            }
          };
        } catch (error) {
          throw new Error(
            `Failed to retrieve device status. The device may be off or unresponsive. ` +
            `Try using listDevices to verify connectivity.`
          );
        }
      }
    }
  };
}

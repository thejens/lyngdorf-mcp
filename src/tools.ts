import { LyngdorfTransport } from './transport.js';
import type { LyngdorfDiscovery } from './discovery.js';
import type { LyngdorfDevice, VolumeConfig } from './types.js';
import {
  SetVolumeInput,
  VolumeStepInput,
  SetSourceInput,
  SetRoomPerfectFocusInput,
  SetVoicingInput,
  DiscoverDevicesInput
} from './types.js';
import { z } from 'zod';
import {
  checkCapability,
  getSupportingModels,
  getDeviceCapabilities,
  type DeviceCapabilities
} from './capabilities.js';

export function createTools(
  getTransport: () => LyngdorfTransport | null,
  getDevices: () => LyngdorfDevice[],
  setDevice: (device: LyngdorfDevice, transport: LyngdorfTransport) => void,
  discovery: LyngdorfDiscovery,
  volumeConfig: VolumeConfig,
  getCurrentDevice: () => LyngdorfDevice | null
) {
  // Helper to check if device is powered on
  const checkPowerState = async (transport: LyngdorfTransport): Promise<boolean> => {
    try {
      const response = await transport.sendCommand('!PWR?');
      return response.includes('!PWR(ON)');
    } catch {
      return false;
    }
  };

  const requireConnection = async (checkPower = false): Promise<LyngdorfTransport> => {
    const transport = getTransport();
    if (!transport || !transport.isConnected()) {
      throw new Error(
        'Not connected to audio device. Use discoverDevices or set LYNGDORF_IP environment variable.'
      );
    }

    if (checkPower) {
      const isPoweredOn = await checkPowerState(transport);
      if (!isPoweredOn) {
        throw new Error(
          'Audio device is currently powered off. Use the powerOn tool first, or ask to turn on the stereo.'
        );
      }
    }

    return transport;
  };

  return {
    // Power controls
    powerOn: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        // Send command (doesn't return a response)
        await t.sendCommandNoResponse('!ON');
        // Verify by checking power state
        await new Promise(resolve => setTimeout(resolve, 500));
        const status = await t.sendCommand('!PWR?');
        const isOn = status.includes('!PWR(ON)');
        return {
          success: true,
          data: isOn ? 'Device is powered on' : 'Device power on command sent (device may have been already on)'
        };
      }
    },

    powerOff: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        // Send command (doesn't return a response)
        await t.sendCommandNoResponse('!OFF');
        // Verify by checking power state
        await new Promise(resolve => setTimeout(resolve, 500));
        const status = await t.sendCommand('!PWR?');
        const isOff = status.includes('!PWR(OFF)');
        return {
          success: true,
          data: isOff ? 'Device is powered off' : 'Device power off command sent'
        };
      }
    },

    togglePower: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        // Get current state first
        const beforeStatus = await t.sendCommand('!PWR?');
        const wasOn = beforeStatus.includes('!PWR(ON)');
        // Toggle power (doesn't return a response)
        await t.sendCommandNoResponse('!PWR');
        // Wait and verify
        await new Promise(resolve => setTimeout(resolve, 500));
        const afterStatus = await t.sendCommand('!PWR?');
        const isOn = afterStatus.includes('!PWR(ON)');
        return {
          success: true,
          data: `Power toggled: ${wasOn ? 'ON' : 'OFF'} → ${isOn ? 'ON' : 'OFF'}`
        };
      }
    },

    // Volume controls
    setVolume: {
      schema: SetVolumeInput,
      handler: async ({ level }: { level: number }) => {
        const t = await requireConnection(true); // Needs power on

        // Hard limit - cannot be exceeded
        if (level > volumeConfig.hardLimit) {
          throw new Error(
            `🚫 VOLUME BLOCKED: ${level}dB exceeds maximum safe limit (${volumeConfig.hardLimit}dB). ` +
            `This volume level is not allowed as it could cause speaker damage or hearing loss. ` +
            `Maximum allowed volume: ${volumeConfig.hardLimit}dB.`
          );
        }

        // Warning threshold - requires confirmation
        if (level > volumeConfig.warningThreshold) {
          throw new Error(
            `⚠️ VOLUME WARNING: ${level}dB exceeds safe threshold (${volumeConfig.warningThreshold}dB). ` +
            `This is LOUD and could damage speakers or hearing. ` +
            `Please confirm you want to set volume to ${level}dB before proceeding.`
          );
        }

        try {
          // Convert dB to device format (tenths of dB)
          const deviceLevel = Math.round(level * 10);
          await t.sendCommand(`!VOL(${deviceLevel})`);

          // Verify the new volume
          await new Promise(resolve => setTimeout(resolve, 200));
          const response = await t.sendCommand('!VOL?');
          const actualVolume = t.parseVolumeResponse(response);
          const actualVolumeDb = actualVolume !== null ? actualVolume / 10 : null;

          return {
            success: true,
            data: {
              action: 'volume_set',
              requested_volume_db: level,
              actual_volume_db: actualVolumeDb,
              message: `Volume set to ${actualVolumeDb}dB`,
              note: (actualVolumeDb && actualVolumeDb > -20) ? 'Warning: High volume level' : undefined
            }
          };
        } catch (error) {
          throw new Error(`Failed to set volume to ${level}dB. Ensure the value is within the valid range (-99.9 to 12.0 dB) and the device is powered on.`);
        }
      }
    },

    volumeUp: {
      schema: VolumeStepInput,
      handler: async ({ steps = 1 }: { steps?: number }) => {
        const t = await requireConnection(true); // Needs power on

        // Get current volume to check against safety thresholds
        const currentRes = await t.sendCommand('!VOL?');
        const currentVol = t.parseVolumeResponse(currentRes) || -999;
        const newVol = currentVol + (steps * 0.5);

        // Hard limit check
        if (newVol > volumeConfig.hardLimit) {
          throw new Error(
            `🚫 VOLUME BLOCKED: Increasing volume by ${steps} step(s) would reach ${newVol}dB, ` +
            `exceeding maximum safe limit (${volumeConfig.hardLimit}dB). ` +
            `Current volume: ${currentVol}dB. Maximum allowed: ${volumeConfig.hardLimit}dB.`
          );
        }

        // Warning threshold check
        if (newVol > volumeConfig.warningThreshold) {
          throw new Error(
            `⚠️ VOLUME WARNING: Increasing volume by ${steps} step(s) would reach ${newVol}dB, ` +
            `exceeding safe threshold (${volumeConfig.warningThreshold}dB). ` +
            `This is LOUD and could damage speakers or hearing. ` +
            `Use setVolume if you need to increase volume above ${volumeConfig.warningThreshold}dB after confirming.`
          );
        }

        try {
          for (let i = 0; i < steps; i++) {
            await t.sendCommandNoResponse('!VOLUP');
            await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay between steps
          }

          // Query the new volume
          await new Promise(resolve => setTimeout(resolve, 200));
          const response = await t.sendCommand('!VOL?');
          const actualVolume = t.parseVolumeResponse(response);
          const actualVolumeDb = actualVolume !== null ? actualVolume / 10 : null;

          return {
            success: true,
            data: {
              action: 'volume_increased',
              steps,
              step_size_db: 0.5,
              total_change_db: steps * 0.5,
              new_volume_db: actualVolumeDb,
              message: `Volume increased by ${steps * 0.5}dB to ${actualVolumeDb}dB (${steps} step${steps > 1 ? 's' : ''})`
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
        const t = await requireConnection(true); // Needs power on
        try {
          for (let i = 0; i < steps; i++) {
            await t.sendCommandNoResponse('!VOLDN');
            await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay between steps
          }

          // Query the new volume
          await new Promise(resolve => setTimeout(resolve, 200));
          const response = await t.sendCommand('!VOL?');
          const actualVolume = t.parseVolumeResponse(response);
          const actualVolumeDb = actualVolume !== null ? actualVolume / 10 : null;

          return {
            success: true,
            data: {
              action: 'volume_decreased',
              steps,
              step_size_db: 0.5,
              total_change_db: steps * 0.5,
              new_volume_db: actualVolumeDb,
              message: `Volume decreased by ${steps * 0.5}dB to ${actualVolumeDb}dB (${steps} step${steps > 1 ? 's' : ''})`
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
        const t = await requireConnection();
        try {
          const response = await t.sendCommand('!VOL?');
          const rawVolume = t.parseVolumeResponse(response);
          // Device returns volume in tenths of dB, so divide by 10
          const volumeDb = rawVolume !== null ? rawVolume / 10 : null;
          return {
            success: true,
            data: {
              current_volume_db: volumeDb,
              range: { minimum: -99.9, maximum: 12.0 },
              unit: 'dB',
              message: `Current volume: ${volumeDb}dB`
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
        const t = await requireConnection();
        await t.sendCommandNoResponse('!MUTEON');

        // Verify mute state
        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await t.sendCommand('!MUTE?');
        const isMuted = response.includes('!MUTE(ON)');

        return {
          success: true,
          data: {
            muted: isMuted,
            message: isMuted ? 'Audio muted' : 'Mute command sent (verify state)'
          }
        };
      }
    },

    unmute: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        await t.sendCommandNoResponse('!MUTEOFF');

        // Verify mute state
        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await t.sendCommand('!MUTE?');
        const isMuted = response.includes('!MUTE(ON)');

        return {
          success: true,
          data: {
            muted: isMuted,
            message: isMuted ? 'Unmute command sent (still muted)' : 'Audio unmuted'
          }
        };
      }
    },

    // Tone Controls
    setBass: {
      schema: z.object({
        gain: z.number().min(-12).max(12).describe('Bass gain in dB (-12 to 12)')
      }),
      handler: async ({ gain }: { gain: number }) => {
        const t = await requireConnection(true);
        await t.sendCommand(`!BASS(${gain})`);

        // Verify the new setting
        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await t.sendCommand('!BASS?');
        const actualBass = t.parseBassResponse(response);

        return {
          success: true,
          data: {
            requested_bass_gain_db: gain,
            actual_bass_gain_db: actualBass,
            message: `Bass gain set to ${actualBass}dB`
          }
        };
      }
    },

    getBass: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        const response = await t.sendCommand('!BASS?');
        const bass = t.parseBassResponse(response);
        return {
          success: true,
          data: {
            bass_gain_db: bass,
            range: { min: -12, max: 12 },
            message: `Bass gain: ${bass}dB`
          }
        };
      }
    },

    setBassFrequency: {
      schema: z.object({
        frequency: z.number().min(20).max(800).describe('Bass frequency in Hz (20 to 800)')
      }),
      handler: async ({ frequency }: { frequency: number }) => {
        const t = await requireConnection(true);
        await t.sendCommand(`!BASSFREQ(${frequency})`);

        // Verify the new setting
        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await t.sendCommand('!BASSFREQ?');
        const actualFreq = t.parseBassFreqResponse(response);

        return {
          success: true,
          data: {
            requested_bass_frequency_hz: frequency,
            actual_bass_frequency_hz: actualFreq,
            message: `Bass frequency set to ${actualFreq}Hz`
          }
        };
      }
    },

    getBassFrequency: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        const response = await t.sendCommand('!BASSFREQ?');
        const freq = t.parseBassFreqResponse(response);
        return {
          success: true,
          data: {
            bass_frequency_hz: freq,
            range: { min: 20, max: 800 },
            message: `Bass frequency: ${freq}Hz`
          }
        };
      }
    },

    setTreble: {
      schema: z.object({
        gain: z.number().min(-12).max(12).describe('Treble gain in dB (-12 to 12)')
      }),
      handler: async ({ gain }: { gain: number }) => {
        const t = await requireConnection(true);
        await t.sendCommand(`!TREBLE(${gain})`);

        // Verify the new setting
        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await t.sendCommand('!TREBLE?');
        const actualTreble = t.parseTrebleResponse(response);

        return {
          success: true,
          data: {
            requested_treble_gain_db: gain,
            actual_treble_gain_db: actualTreble,
            message: `Treble gain set to ${actualTreble}dB`
          }
        };
      }
    },

    getTreble: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        const response = await t.sendCommand('!TREBLE?');
        const treble = t.parseTrebleResponse(response);
        return {
          success: true,
          data: {
            treble_gain_db: treble,
            range: { min: -12, max: 12 },
            message: `Treble gain: ${treble}dB`
          }
        };
      }
    },

    setTrebleFrequency: {
      schema: z.object({
        frequency: z.number().min(1500).max(16000).describe('Treble frequency in Hz (1500 to 16000)')
      }),
      handler: async ({ frequency }: { frequency: number }) => {
        const t = await requireConnection(true);
        await t.sendCommand(`!TREBLEFREQ(${frequency})`);

        // Verify the new setting
        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await t.sendCommand('!TREBLEFREQ?');
        const actualFreq = t.parseTrebleFreqResponse(response);

        return {
          success: true,
          data: {
            requested_treble_frequency_hz: frequency,
            actual_treble_frequency_hz: actualFreq,
            message: `Treble frequency set to ${actualFreq}Hz`
          }
        };
      }
    },

    getTrebleFrequency: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        const response = await t.sendCommand('!TREBLEFREQ?');
        const freq = t.parseTrebleFreqResponse(response);
        return {
          success: true,
          data: {
            treble_frequency_hz: freq,
            range: { min: 1500, max: 16000 },
            message: `Treble frequency: ${freq}Hz`
          }
        };
      }
    },

    setBalance: {
      schema: z.object({ level: z.number().min(-10).max(10) }),
      handler: async ({ level }: { level: number }) => {
        const t = await requireConnection(true);
        const device = getCurrentDevice();

        if (!checkCapability(device?.model, 'balanceControl')) {
          throw new Error(`Balance control is not supported on ${device?.model || 'this device'}`);
        }

        // Convert number to protocol format (e.g. -5 -> L5, 5 -> R5, 0 -> 0)
        let param = '0';
        if (level < 0) param = `L${Math.abs(level)}`;
        if (level > 0) param = `R${level}`;

        await t.sendCommand(`!BAL(${param})`);

        // Verify the new setting
        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await t.sendCommand('!BAL?');
        const actualBalance = t.parseBalanceResponse(response);

        return {
          success: true,
          data: {
            requested_balance: param,
            actual_balance: actualBalance,
            message: `Balance set to ${actualBalance}`
          }
        };
      }
    },

    getBalance: {
      schema: z.object({}),
      handler: async () => {
        const t = await requireConnection();
        const device = getCurrentDevice();

        if (!checkCapability(device?.model, 'balanceControl')) {
          throw new Error(`Balance control is not supported on ${device?.model || 'this device'}`);
        }

        const response = await t.sendCommand('!BAL?');
        const balance = t.parseBalanceResponse(response);
        return {
          success: true,
          data: {
            balance: balance,
            range: 'L10-L1, 0, R1-R10',
            message: `Balance: ${balance === '0' ? 'Center' : balance}`
          }
        };
      }
    },

    // Source controls
    setSource: {
      schema: SetSourceInput,
      handler: async ({ source }: { source: number }) => {
        const t = await requireConnection(true); // Needs power on
        await t.sendCommand(`!SRC(${source})`);

        // Verify the new source
        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await t.sendCommand('!SRC?');
        const actualSource = t.parseSourceResponse(response);

        return {
          success: true,
          data: {
            requested_source: source,
            actual_source: actualSource,
            message: `Source set to ${actualSource}`
          }
        };
      }
    },

    getSource: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        const response = await t.sendCommand('!SRC?');
        const source = t.parseSourceResponse(response);
        return { success: true, data: { source } };
      }
    },

    // RoomPerfect controls
    setRoomPerfectFocus: {
      schema: SetRoomPerfectFocusInput,
      handler: async ({ position }: { position: number }) => {
        const t = await requireConnection(true); // Needs power on
        await t.sendCommand(`!RP(${position})`);

        // Verify the new setting
        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await t.sendCommand('!RP?');
        const actualSetting = t.parseRoomPerfectResponse(response);

        return {
          success: true,
          data: {
            requested_position: position,
            actual_setting: actualSetting,
            message: `RoomPerfect set to ${actualSetting}`
          }
        };
      }
    },

    setRoomPerfectGlobal: {
      schema: {},
      handler: async () => {
        const t = await requireConnection(true); // Needs power on
        await t.sendCommand('!RP(9)');

        // Verify the new setting
        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await t.sendCommand('!RP?');
        const actualSetting = t.parseRoomPerfectResponse(response);

        return {
          success: true,
          data: {
            actual_setting: actualSetting,
            message: `RoomPerfect set to ${actualSetting}`
          }
        };
      }
    },

    getRoomPerfect: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        const response = await t.sendCommand('!RP?');
        const setting = t.parseRoomPerfectResponse(response);
        return { success: true, data: { roomPerfect: setting } };
      }
    },

    // Voicing controls
    setVoicing: {
      schema: SetVoicingInput,
      handler: async ({ voicing }: { voicing: number }) => {
        const t = await requireConnection(true); // Needs power on
        await t.sendCommand(`!VOI(${voicing})`);

        // Verify the new voicing
        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await t.sendCommand('!VOI?');
        const actualVoicing = t.parseVoicingResponse(response);

        return {
          success: true,
          data: {
            requested_voicing: voicing,
            actual_voicing: actualVoicing,
            message: `Voicing set to ${actualVoicing}`
          }
        };
      }
    },

    nextVoicing: {
      schema: {},
      handler: async () => {
        const t = await requireConnection(true); // Needs power on
        await t.sendCommandNoResponse('!VOIUP');

        // Query the new voicing
        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await t.sendCommand('!VOI?');
        const actualVoicing = t.parseVoicingResponse(response);

        return {
          success: true,
          data: {
            voicing: actualVoicing,
            message: `Switched to voicing ${actualVoicing}`
          }
        };
      }
    },

    previousVoicing: {
      schema: {},
      handler: async () => {
        const t = await requireConnection(true); // Needs power on
        await t.sendCommandNoResponse('!VOIDN');

        // Query the new voicing
        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await t.sendCommand('!VOI?');
        const actualVoicing = t.parseVoicingResponse(response);

        return {
          success: true,
          data: {
            voicing: actualVoicing,
            message: `Switched to voicing ${actualVoicing}`
          }
        };
      }
    },

    getVoicing: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        const response = await t.sendCommand('!VOI?');
        const voicing = t.parseVoicingResponse(response);
        return { success: true, data: { voicing } };
      }
    },

    // Playback controls (may not be available on all models)
    play: {
      schema: {},
      handler: async () => {
        const t = await requireConnection(true); // Needs power on
        const device = getCurrentDevice();

        if (!checkCapability(device?.model, 'playback')) {
          throw new Error(
            `Playback control is not supported on ${device?.model || 'this device'}. ` +
            `This feature requires an internal media player.`
          );
        }

        await t.sendCommandNoResponse('!PLAY');
        return { success: true, data: 'Play/Pause toggled (streaming sources only)' };
      }
    },

    pause: {
      schema: {},
      handler: async () => {
        const t = await requireConnection(true); // Needs power on
        const device = getCurrentDevice();

        if (!checkCapability(device?.model, 'playback')) {
          throw new Error(
            `Playback control is not supported on ${device?.model || 'this device'}. ` +
            `This feature requires an internal media player.`
          );
        }

        // !PLAY is a toggle - there is no separate pause command in the protocol
        await t.sendCommandNoResponse('!PLAY');
        return { success: true, data: 'Play/Pause toggled (streaming sources only)' };
      }
    },

    next: {
      schema: {},
      handler: async () => {
        const t = await requireConnection(true); // Needs power on
        const device = getCurrentDevice();

        if (!checkCapability(device?.model, 'playback')) {
          throw new Error(
            `Playback control is not supported on ${device?.model || 'this device'}. ` +
            `This feature requires an internal media player.`
          );
        }

        await t.sendCommandNoResponse('!NEXT');
        return { success: true, data: 'Next track (streaming sources only)' };
      }
    },

    previous: {
      schema: {},
      handler: async () => {
        const t = await requireConnection(true); // Needs power on
        const device = getCurrentDevice();

        if (!checkCapability(device?.model, 'playback')) {
          throw new Error(
            `Playback control is not supported on ${device?.model || 'this device'}. ` +
            `This feature requires an internal media player.`
          );
        }

        await t.sendCommandNoResponse('!PREV');
        return { success: true, data: 'Previous track (streaming sources only)' };
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

    // Enhanced List Commands with actual device names
    listSources: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        try {
          const response = await t.sendCommand('!SRCLIST?');
          const sources = t.parseListResponse(response);
          const currentRes = await t.sendCommand('!SRC?');
          const current = t.parseSourceResponse(currentRes);

          return {
            success: true,
            data: {
              current_source: current,
              total_sources: sources.length,
              sources: sources.map(s => ({
                number: s.number,
                name: s.name,
                is_current: s.number === current
              })),
              message: `Found ${sources.length} available sources. Current source: ${sources.find(s => s.number === current)?.name || current}`
            }
          };
        } catch (error) {
          throw new Error(
            `Failed to list sources. The device may not support this command.`
          );
        }
      }
    },

    listRoomPerfectPositions: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        try {
          const response = await t.sendCommand('!RPLIST?');
          const positions = t.parseListResponse(response);
          const currentRes = await t.sendCommand('!RP?');
          const currentRaw = t.parseRoomPerfectResponse(currentRes);

          return {
            success: true,
            data: {
              current_position: currentRaw,
              total_positions: positions.length,
              positions: positions.map(p => ({
                number: p.number,
                name: p.name
              })),
              message: `Found ${positions.length} RoomPerfect positions. Current: ${currentRaw}`
            }
          };
        } catch (error) {
          throw new Error(
            `Failed to list RoomPerfect positions. The device may not have RoomPerfect calibrated.`
          );
        }
      }
    },

    // Voicing Management
    listVoicings: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        try {
          const response = await t.sendCommand('!VOILIST?');
          const voicings = t.parseListResponse(response);
          const currentRes = await t.sendCommand('!VOI?');
          const current = t.parseVoicingResponse(currentRes);

          return {
            success: true,
            data: {
              current_voicing: current,
              total_voicings: voicings.length,
              voicings: voicings.map(v => ({
                number: v.number,
                name: v.name,
                is_current: v.number === current
              })),
              message: `Found ${voicings.length} voicing presets. Current: ${voicings.find(v => v.number === current)?.name || current}`
            }
          };
        } catch (error) {
          throw new Error(
            `Failed to query voicings. This feature may not be available on your device model.`
          );
        }
      }
    },

    // Information Query Tools
    getMuteStatus: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        const response = await t.sendCommand('!MUTE?');
        const muted = t.parseMuteResponse(response);
        return {
          success: true,
          data: {
            muted: muted,
            message: muted ? 'Audio is muted' : 'Audio is not muted'
          }
        };
      }
    },

    getStreamType: {
      schema: z.object({}),
      handler: async () => {
        const t = await requireConnection();
        const device = getCurrentDevice();

        if (!checkCapability(device?.model, 'streamTypeDetection')) {
          const supporting = getSupportingModels('streamTypeDetection');
          throw new Error(
            `Stream type detection is not supported on ${device?.model || 'this device'}. ` +
            `This feature requires built-in streaming capabilities. ` +
            `Supported models: ${supporting.join(', ')}`
          );
        }

        const response = await t.sendCommand('!STREAMTYPE?');
        const type = t.parseStreamTypeResponse(response);
        return {
          success: true,
          data: {
            stream_type: type,
            message: `Current stream type: ${type}`
          }
        };
      }
    },

    getAudioStatus: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        const response = await t.sendCommand('!AUDIOSTATUS?');
        return {
          success: true,
          data: {
            audio_status: response.replace('!AUDIOSTATUS(', '').replace(')', '').replace(/"/g, ''),
            message: `Audio format: ${response}`
          }
        };
      }
    },

    getDeviceInfo: {
      schema: {},
      handler: async () => {
        const t = await requireConnection();
        const response = await t.sendCommand('!DEVICE?');
        return {
          success: true,
          data: {
            device_model: response.replace('!DEVICE(', '').replace(')', '').trim(),
            message: `Device: ${response}`
          }
        };
      }
    },

    // Status
    getStatus: {
      schema: {},
      handler: async () => {
        const t = await requireConnection(); // No power check - we want status even when off

        try {
          const [pwrRes, volRes, muteRes, srcRes, voiRes, rpRes, streamRes] = await Promise.allSettled([
            t.sendCommand('!PWR?'),
            t.sendCommand('!VOL?'),
            t.sendCommand('!MUTE?'),
            t.sendCommand('!SRC?'),
            t.sendCommand('!VOI?'),
            t.sendCommand('!RP?'),
            t.sendCommand('!STREAMTYPE?')
          ]);

          const isPoweredOn = pwrRes.status === 'fulfilled' && pwrRes.value.includes('ON');
          const volume = volRes.status === 'fulfilled' ? t.parseVolumeResponse(volRes.value) : null;
          const muted = muteRes.status === 'fulfilled' ? t.parseMuteResponse(muteRes.value) : null;
          const source = srcRes.status === 'fulfilled' ? t.parseSourceResponse(srcRes.value) : null;
          const voicing = voiRes.status === 'fulfilled' ? t.parseVoicingResponse(voiRes.value) : null;
          const roomPerfect = rpRes.status === 'fulfilled' ? t.parseRoomPerfectResponse(rpRes.value) : null;
          const streamType = streamRes.status === 'fulfilled' ? t.parseStreamTypeResponse(streamRes.value) : null;

          return {
            success: true,
            data: {
              power: isPoweredOn ? 'ON' : 'OFF',
              connection_status: 'connected',
              current_state: {
                volume_db: volume,
                muted: muted,
                input_source: source,
                voicing_preset: voicing,
                room_perfect: roomPerfect,
                streaming: streamType && streamType !== 'None' ? streamType : null
              },
              capabilities: {
                volume_range: { min: -999, max: 120 },
                step_size: { up_down: 0.5, set: 0.1 }
              },
              message: isPoweredOn
                ? `Device Status: Power ON, Volume ${volume}dB${muted ? ' (MUTED)' : ''}, Source ${source}, Voicing ${voicing}, RoomPerfect ${roomPerfect}${streamType && streamType !== 'None' ? `, Streaming ${streamType}` : ''}`
                : 'Device is powered OFF. Some features unavailable until powered on.',
              note: !isPoweredOn ? 'Use powerOn tool to turn on the device' : undefined
            }
          };
        } catch (error) {
          throw new Error(
            `Failed to retrieve device status. The device may be unresponsive. ` +
            `Try using listDevices to verify connectivity.`
          );
        }
      }
    }
  };
}

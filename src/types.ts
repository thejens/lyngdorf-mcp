import { z } from 'zod';

// Device types
export type DeviceModel = 'TDAI-1120' | 'TDAI-2170' | 'TDAI-2190' | 'TDAI-2210' | 'TDAI-3400' | 'MP-40' | 'MP-50' | 'MP-60' | 'CD-1' | 'Unknown';

export interface LyngdorfDevice {
  model: DeviceModel;
  ip: string;
  hostname: string;
  port: number;
  name?: string; // Custom device name (e.g., "Stereo", "Living Room")
}

export interface DeviceStatus {
  connected: boolean;
  volume?: number;
  muted?: boolean;
  source?: number;
  power?: boolean;
  voicing?: number;
  roomPerfect?: string;
}

// Command schemas for validation
export const VolumeSchema = z.number().min(-99.9).max(12.0);
export const SourceSchema = z.number().int().min(0);
export const RoomPerfectFocusSchema = z.number().int().min(1).max(8);
export const VoicingSchema = z.number().int().min(0);
export const FeedbackLevelSchema = z.number().int().min(0).max(2);

// Tool input schemas
export const SetVolumeInput = z.object({
  level: VolumeSchema.describe('Volume level in dB (-99.9 to 12.0)')
});

export const VolumeStepInput = z.object({
  steps: z.number().int().positive().default(1).describe('Number of steps (default: 1)')
});

export const SetSourceInput = z.object({
  source: SourceSchema.describe('Source number')
});

export const SetRoomPerfectFocusInput = z.object({
  position: RoomPerfectFocusSchema.describe('Focus position (1-8)')
});

export const SetVoicingInput = z.object({
  voicing: VoicingSchema.describe('Voicing preset number')
});

export const DiscoverDevicesInput = z.object({
  timeout: z.number().optional().describe('Discovery timeout in milliseconds (default: 3000)')
});

export type DiscoverDevicesInput = z.infer<typeof DiscoverDevicesInput>;

// Volume safety configuration
export interface VolumeConfig {
  warningThreshold: number;  // dB level that triggers warning (default: -15)
  hardLimit: number;          // dB level that cannot be exceeded (default: -10)
}

// Response format
export interface CommandResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Lyngdorf command protocol
export type LyngdorfCommand =
  | '!ON' | '!OFF' | '!PWR'
  | '!VOL?' | '!VOLUP' | '!VOLDN'
  | '!MUTEON' | '!MUTEOFF'
  | '!SRC?'
  | '!RPGLOB' | '!RP?'
  | '!VOI?' | '!VOIUP' | '!VOIDN'
  | '!PLAY' | '!PAUSE' | '!NEXT' | '!PREV' | '!STOP'
  | string; // For parameterized commands like !VOL(X)

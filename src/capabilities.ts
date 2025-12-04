import type { DeviceModel } from './types.js';

/**
 * Device capabilities by model
 * Based on official Lyngdorf manuals and specifications
 */

export interface DeviceCapabilities {
    model: DeviceModel;
    supports: {
        volume: boolean;
        mute: boolean;
        sources: boolean;
        roomperfect: boolean;
        voicing: boolean;
        toneControls: boolean;       // Overall tone control support
        bassControl: boolean;          // Specific bass control
        trebleControl: boolean;        // Specific treble control
        balanceControl: boolean;       // Balance control
        playback: boolean;             // Play/pause/next/prev
        streaming: boolean;            // Built-in streaming
        streamTypeDetection: boolean;  // Can detect stream type
    };
    volumeRange?: { min: number; max: number };
    notes?: string;
}

export const DEVICE_CAPABILITIES: Record<DeviceModel, DeviceCapabilities> = {
    'TDAI-1120': {
        model: 'TDAI-1120',
        supports: {
            volume: true,
            mute: true,
            sources: true,
            roomperfect: true,
            voicing: true,
            toneControls: true,
            bassControl: true,
            trebleControl: true,
            balanceControl: true,
            playback: true,
            streaming: true,
            streamTypeDetection: true
        },
        volumeRange: { min: -999, max: 120 },
        notes: 'Compact streaming integrated amplifier with full feature set'
    },
    'TDAI-2170': {
        model: 'TDAI-2170',
        supports: {
            volume: true,
            mute: true,
            sources: true,
            roomperfect: true,
            voicing: true,
            toneControls: false,           // No BASS/TREBLE commands in manual
            bassControl: false,
            trebleControl: false,
            balanceControl: false,         // No BAL command in manual
            playback: false,               // No internal media player
            streaming: false,              // No built-in streaming
            streamTypeDetection: false     // Cannot detect stream type
        },
        volumeRange: { min: -999, max: 120 },
        notes: 'Older model without integrated streaming. Requires optional USB module for streaming.'
    },
    'TDAI-2210': {
        model: 'TDAI-2210',
        supports: {
            volume: true,
            mute: true,
            sources: true,
            roomperfect: true,
            voicing: true,
            toneControls: true,
            bassControl: true,
            trebleControl: true,
            balanceControl: true,
            playback: true,
            streaming: true,
            streamTypeDetection: true
        },
        volumeRange: { min: -999, max: 120 },
        notes: 'Modern streaming amplifier with color touchscreen and full protocol support'
    },
    'TDAI-3400': {
        model: 'TDAI-3400',
        supports: {
            volume: true,
            mute: true,
            sources: true,
            roomperfect: true,
            voicing: true,
            toneControls: true,
            bassControl: true,
            trebleControl: true,
            balanceControl: true,
            playback: true,
            streaming: true,
            streamTypeDetection: true
        },
        volumeRange: { min: -999, max: 120 },
        notes: 'Flagship model with comprehensive streaming and control capabilities'
    },
    'TDAI-2190': {
        model: 'TDAI-2190',
        supports: {
            volume: true,
            mute: true,
            sources: true,
            roomperfect: true,
            voicing: true,
            toneControls: true,
            bassControl: true,
            trebleControl: true,
            balanceControl: true,
            playback: true,
            streaming: true,
            streamTypeDetection: true
        },
        volumeRange: { min: -999, max: 120 }
    },
    'MP-40': {
        model: 'MP-40',
        supports: {
            volume: true,
            mute: true,
            sources: true,
            roomperfect: true,
            voicing: true,
            toneControls: true,
            bassControl: true,
            trebleControl: true,
            balanceControl: true,
            playback: true,
            streaming: true,
            streamTypeDetection: true
        },
        volumeRange: { min: -999, max: 120 }
    },
    'MP-50': {
        model: 'MP-50',
        supports: {
            volume: true,
            mute: true,
            sources: true,
            roomperfect: true,
            voicing: true,
            toneControls: true,
            bassControl: true,
            trebleControl: true,
            balanceControl: true,
            playback: true,
            streaming: true,
            streamTypeDetection: true
        },
        volumeRange: { min: -999, max: 120 }
    },
    'MP-60': {
        model: 'MP-60',
        supports: {
            volume: true,
            mute: true,
            sources: true,
            roomperfect: true,
            voicing: true,
            toneControls: true,
            bassControl: true,
            trebleControl: true,
            balanceControl: true,
            playback: true,
            streaming: true,
            streamTypeDetection: true
        },
        volumeRange: { min: -999, max: 120 }
    },
    'CD-1': {
        model: 'CD-1',
        supports: {
            volume: false,
            mute: false,
            sources: false,
            roomperfect: false,
            voicing: false,
            toneControls: false,
            bassControl: false,
            trebleControl: false,
            balanceControl: false,
            playback: true,   // CD player playback only
            streaming: false,
            streamTypeDetection: false
        },
        notes: 'CD player - limited control to playback functions only'
    },
    'Unknown': {
        model: 'Unknown',
        supports: {
            volume: true,
            mute: true,
            sources: true,
            roomperfect: true,
            voicing: true,
            toneControls: true,
            bassControl: true,
            trebleControl: true,
            balanceControl: true,
            playback: true,
            streaming: true,
            streamTypeDetection: true
        },
        volumeRange: { min: -999, max: 120 },
        notes: 'Unknown device - assuming full capabilities'
    }
};

/**
 * Check if a device supports a specific capability
 */
export function checkCapability(
    deviceModel: DeviceModel | null | undefined,
    capability: keyof DeviceCapabilities['supports']
): boolean {
    if (!deviceModel || deviceModel === 'Unknown') {
        // Unknown devices assumed to support everything
        return true;
    }

    const caps = DEVICE_CAPABILITIES[deviceModel];
    return caps?.supports[capability] ?? false;
}

/**
 * Get list of models that support a specific capability
 */
export function getSupportingModels(
    capability: keyof DeviceCapabilities['supports']
): DeviceModel[] {
    return (Object.keys(DEVICE_CAPABILITIES) as DeviceModel[]).filter(
        model => model !== 'Unknown' && DEVICE_CAPABILITIES[model].supports[capability]
    );
}

/**
 * Get full capabilities for a device model
 */
export function getDeviceCapabilities(deviceModel: DeviceModel): DeviceCapabilities {
    return DEVICE_CAPABILITIES[deviceModel] || DEVICE_CAPABILITIES['Unknown'];
}

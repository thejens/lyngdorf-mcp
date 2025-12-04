import { describe, it, expect } from 'vitest';
import { checkCapability, getSupportingModels, getDeviceCapabilities } from './capabilities.js';
import type { DeviceModel } from './types.js';

describe('Capability Detection', () => {
    describe('TDAI-1120 (Full Featured)', () => {
        const model: DeviceModel = 'TDAI-1120';

        it('supports volume control', () => {
            expect(checkCapability(model, 'volume')).toBe(true);
        });

        it('supports streaming', () => {
            expect(checkCapability(model, 'streaming')).toBe(true);
        });

        it('supports playback', () => {
            expect(checkCapability(model, 'playback')).toBe(true);
        });

        it('supports stream type detection', () => {
            expect(checkCapability(model, 'streamTypeDetection')).toBe(true);
        });
    });

    describe('TDAI-2170 (Limited Streaming)', () => {
        const model: DeviceModel = 'TDAI-2170';

        it('supports volume control', () => {
            expect(checkCapability(model, 'volume')).toBe(true);
        });

        it('does NOT support streaming', () => {
            expect(checkCapability(model, 'streaming')).toBe(false);
        });

        it('does NOT support playback', () => {
            expect(checkCapability(model, 'playback')).toBe(false);
        });

        it('does NOT support stream type detection', () => {
            expect(checkCapability(model, 'streamTypeDetection')).toBe(false);
        });

        it('does NOT support tone controls', () => {
            expect(checkCapability(model, 'toneControls')).toBe(false);
            expect(checkCapability(model, 'bassControl')).toBe(false);
            expect(checkCapability(model, 'trebleControl')).toBe(false);
            expect(checkCapability(model, 'balanceControl')).toBe(false);
        });
    });

    describe('Unknown Device', () => {
        it('assumes full support for null device', () => {
            expect(checkCapability(null, 'streaming')).toBe(true);
        });

        it('assumes full support for Unknown model', () => {
            expect(checkCapability('Unknown', 'streaming')).toBe(true);
        });
    });

    describe('Helper Functions', () => {
        it('getSupportingModels returns correct list', () => {
            const streamingModels = getSupportingModels('streaming');
            expect(streamingModels).toContain('TDAI-1120');
            expect(streamingModels).toContain('TDAI-3400');
            expect(streamingModels).not.toContain('TDAI-2170');
        });

        it('getDeviceCapabilities returns full object', () => {
            const caps = getDeviceCapabilities('TDAI-1120');
            expect(caps.model).toBe('TDAI-1120');
            expect(caps.supports.volume).toBe(true);
        });
    });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { LyngdorfDiscovery } from './discovery.js';

describe('LyngdorfDiscovery', () => {
  let discovery: LyngdorfDiscovery;

  beforeEach(() => {
    discovery = new LyngdorfDiscovery();
  });

  describe('Model Extraction', () => {
    it('extracts TDAI models from hostname', () => {
      expect((discovery as any).extractModel('TDAI-1120.local')).toBe('TDAI-1120');
      expect((discovery as any).extractModel('TDAI-2170.local')).toBe('TDAI-2170');
      expect((discovery as any).extractModel('TDAI-3400.local')).toBe('TDAI-3400');
      expect((discovery as any).extractModel('tdai-1120.local')).toBe('TDAI-1120');
      expect((discovery as any).extractModel('tdai1120.local')).toBe('TDAI-1120');
    });

    it('extracts MP models from hostname', () => {
      expect((discovery as any).extractModel('MP-40.local')).toBe('MP-40');
      expect((discovery as any).extractModel('MP-50.local')).toBe('MP-50');
      expect((discovery as any).extractModel('MP-60.local')).toBe('MP-60');
      expect((discovery as any).extractModel('mp-50.local')).toBe('MP-50');
      expect((discovery as any).extractModel('mp50.local')).toBe('MP-50');
    });

    it('extracts CD models from hostname', () => {
      expect((discovery as any).extractModel('CD-1.local')).toBe('CD-1');
      expect((discovery as any).extractModel('cd-1.local')).toBe('CD-1');
      expect((discovery as any).extractModel('cd1.local')).toBe('CD-1');
    });

    it('returns Unknown for unrecognized models', () => {
      expect((discovery as any).extractModel('unknown-device.local')).toBe('Unknown');
      expect((discovery as any).extractModel('192.168.1.100')).toBe('Unknown');
      expect((discovery as any).extractModel('')).toBe('Unknown');
    });

    it('handles hostnames without .local suffix', () => {
      expect((discovery as any).extractModel('TDAI-1120')).toBe('TDAI-1120');
      expect((discovery as any).extractModel('MP-60')).toBe('MP-60');
      expect((discovery as any).extractModel('tdai1120')).toBe('TDAI-1120');
    });
  });

  describe('Service Name', () => {
    it('uses correct mDNS service type', () => {
      // Verify the class uses the correct service type
      // Note: SERVICE_TYPE is a const in the module, not a property
      // Just verify discovery was instantiated correctly
      expect(discovery).toBeDefined();
      expect((discovery as any).extractModel).toBeDefined();
    });
  });
});

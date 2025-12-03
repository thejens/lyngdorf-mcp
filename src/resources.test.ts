import { describe, it, expect } from 'vitest';
import { getManualResource, searchManuals, listAvailableModels } from './resources.js';

describe('Resources', () => {
  describe('listAvailableModels', () => {
    it('returns list of available models', () => {
      const models = listAvailableModels();
      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain('TDAI-1120');
    });

    it('does not include duplicate models', () => {
      const models = listAvailableModels();
      const uniqueModels = [...new Set(models)];
      expect(models.length).toBe(uniqueModels.length);
    });
  });

  describe('getManualResource', () => {
    describe('Control Manual Sections', () => {
      it('returns commands section for TDAI-1120', () => {
        const content = getManualResource('TDAI-1120', 'commands');
        expect(content).toContain('Command Reference');
        expect(content).toContain('Connection');
        expect(content).toContain('!VOL');
        expect(content.length).toBeGreaterThan(1000);
      });

      it('returns troubleshooting section', () => {
        const content = getManualResource('TDAI-1120', 'troubleshooting');
        expect(content).toContain('Troubleshooting');
      });

      it('returns full manual section', () => {
        const content = getManualResource('TDAI-1120', 'full');
        expect(content.length).toBeGreaterThan(0);
      });

      it('falls back to generic for unknown models', () => {
        const content = getManualResource('UNKNOWN-MODEL', 'commands');
        expect(content).toContain('Generic');
      });
    });

    describe('Owner\'s Manual Sections', () => {
      it('returns owner\'s manual index', () => {
        const content = getManualResource('TDAI-1120', 'owners/index');
        expect(content).toContain('Table of Contents');
        expect(content).toContain('Total Pages');
      });

      it('returns setup section', () => {
        const content = getManualResource('TDAI-1120', 'owners/setup');
        expect(content).toContain('Setup');
        expect(content.length).toBeGreaterThan(100);
      });

      it('returns features section', () => {
        const content = getManualResource('TDAI-1120', 'owners/features');
        expect(content).toContain('Features');
        expect(content.length).toBeGreaterThan(100);
      });

      it('returns roomperfect section', () => {
        const content = getManualResource('TDAI-1120', 'owners/roomperfect');
        expect(content).toContain('RoomPerfect');
        expect(content.length).toBeGreaterThan(100);
      });

      it('returns error for unknown owner\'s manual section', () => {
        const content = getManualResource('TDAI-1120', 'owners/nonexistent');
        expect(content).toContain('not found');
      });

      it('handles model without owner\'s manual', () => {
        const content = getManualResource('NONEXISTENT-MODEL', 'owners/index');
        expect(content).toContain('not available');
      });
    });
  });

  describe('searchManuals', () => {
    it('finds results for volume commands', () => {
      const results = searchManuals('volume');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.snippet.toLowerCase().includes('volume'))).toBe(true);
    });

    it('finds results for RoomPerfect', () => {
      const results = searchManuals('roomperfect');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty array for non-existent terms', () => {
      const results = searchManuals('xyzqwertynonexistent');
      expect(results).toEqual([]);
    });

    it('is case insensitive', () => {
      const results1 = searchManuals('VOLUME');
      const results2 = searchManuals('volume');
      expect(results1.length).toBe(results2.length);
    });

    it('returns results with model, section, and snippet', () => {
      const results = searchManuals('power');
      expect(results.length).toBeGreaterThan(0);

      const result = results[0];
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('section');
      expect(result).toHaveProperty('snippet');
      expect(typeof result.model).toBe('string');
      expect(typeof result.section).toBe('string');
      expect(typeof result.snippet).toBe('string');
    });
  });
});

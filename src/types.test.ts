import { describe, it, expect } from 'vitest';
import { VolumeSchema, SourceSchema, RoomPerfectFocusSchema, VoicingSchema } from './types.js';

describe('Types and Schemas', () => {
  describe('VolumeSchema', () => {
    it('accepts valid volume values', () => {
      expect(() => VolumeSchema.parse(-999)).not.toThrow();
      expect(() => VolumeSchema.parse(0)).not.toThrow();
      expect(() => VolumeSchema.parse(120)).not.toThrow();
      expect(() => VolumeSchema.parse(-30.5)).not.toThrow();
    });

    it('rejects invalid volume values', () => {
      expect(() => VolumeSchema.parse(-1000)).toThrow();
      expect(() => VolumeSchema.parse(121)).toThrow();
      expect(() => VolumeSchema.parse('invalid')).toThrow();
    });
  });

  describe('SourceSchema', () => {
    it('accepts valid source numbers', () => {
      expect(() => SourceSchema.parse(0)).not.toThrow();
      expect(() => SourceSchema.parse(1)).not.toThrow();
      expect(() => SourceSchema.parse(99)).not.toThrow();
    });

    it('rejects invalid source values', () => {
      expect(() => SourceSchema.parse(-1)).toThrow();
      expect(() => SourceSchema.parse(1.5)).toThrow();
      expect(() => SourceSchema.parse('invalid')).toThrow();
    });
  });

  describe('RoomPerfectFocusSchema', () => {
    it('accepts valid focus positions', () => {
      expect(() => RoomPerfectFocusSchema.parse(1)).not.toThrow();
      expect(() => RoomPerfectFocusSchema.parse(4)).not.toThrow();
      expect(() => RoomPerfectFocusSchema.parse(8)).not.toThrow();
    });

    it('rejects invalid focus positions', () => {
      expect(() => RoomPerfectFocusSchema.parse(0)).toThrow();
      expect(() => RoomPerfectFocusSchema.parse(9)).toThrow();
      expect(() => RoomPerfectFocusSchema.parse(4.5)).toThrow();
    });
  });

  describe('VoicingSchema', () => {
    it('accepts valid voicing numbers', () => {
      expect(() => VoicingSchema.parse(0)).not.toThrow();
      expect(() => VoicingSchema.parse(1)).not.toThrow();
      expect(() => VoicingSchema.parse(10)).not.toThrow();
    });

    it('rejects invalid voicing values', () => {
      expect(() => VoicingSchema.parse(-1)).toThrow();
      expect(() => VoicingSchema.parse(1.5)).toThrow();
    });
  });
});

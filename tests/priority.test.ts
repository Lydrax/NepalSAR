import { describe, it, expect } from 'vitest';
import { calculateServerPriority } from '../src/lib/services/priorityEngine';

describe('Deterministic Server Priority Engine', () => {
  it('assigns CRITICAL priority for critical/life-threatening injury', () => {
    expect(calculateServerPriority('stranded', 'critical')).toBe('CRITICAL');
    expect(calculateServerPriority('evacuating', 'critical')).toBe('CRITICAL');
    expect(calculateServerPriority('trapped', 'critical')).toBe('CRITICAL');
  });

  it('assigns CRITICAL priority for trapped + serious injury', () => {
    expect(calculateServerPriority('trapped', 'serious')).toBe('CRITICAL');
    expect(calculateServerPriority('injured_immobile', 'serious')).toBe('CRITICAL');
  });

  it('assigns HIGH priority for trapped without critical injury', () => {
    expect(calculateServerPriority('trapped', 'minor')).toBe('HIGH');
    expect(calculateServerPriority('trapped', 'none')).toBe('HIGH');
  });

  it('assigns HIGH priority for serious injury without being trapped', () => {
    expect(calculateServerPriority('stranded', 'serious')).toBe('HIGH');
    expect(calculateServerPriority('evacuating', 'serious')).toBe('HIGH');
    expect(calculateServerPriority('safe_need_evac', 'serious')).toBe('HIGH');
  });

  it('assigns NORMAL priority for standard evacuation and minor/no injuries', () => {
    expect(calculateServerPriority('stranded', 'none')).toBe('NORMAL');
    expect(calculateServerPriority('stranded', 'minor')).toBe('NORMAL');
    expect(calculateServerPriority('evacuating', 'none')).toBe('NORMAL');
    expect(calculateServerPriority('safe_need_evac', 'none')).toBe('NORMAL');
  });
});

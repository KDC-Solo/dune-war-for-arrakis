import { describe, it, expect } from 'vitest';
import { describeAction, actionHeadline, areaLabel } from './describeAction';
import { resolveAction } from '../engine/harkonnenActions';
import { sampleState } from './sampleState';

describe('areaLabel', () => {
  it('uses the proper name for named areas, the id for unnamed', () => {
    expect(areaLabel('carthag')).toBe('Carthag');
    expect(areaLabel('s1_11')).toBe('s1_11');
  });
});

describe('describeAction', () => {
  it('renders a sietch attack into an instruction', () => {
    const text = describeAction({
      kind: 'attack_sietch',
      attacker: 's1_11',
      sietch: 'gara_kulon',
      useOrnithopter: false,
    });
    expect(text).toContain('Attack the sietch at Gara Kulon');
    expect(text).toContain('s1_11');
  });

  it('notes ornithopter use', () => {
    const text = describeAction({ kind: 'attack_sietch', attacker: 's1_11', sietch: 'gara_kulon', useOrnithopter: true });
    expect(text).toMatch(/ornithopter/i);
  });

  it('renders a deploy with units and leader', () => {
    const text = describeAction({
      kind: 'deploy',
      placements: [{ settlement: 'arrakeen', units: { regular: 2, elite: 1, special_elite: 0 }, leader: 'Feyd-Rautha' }],
    });
    expect(text).toContain('Arrakeen');
    expect(text).toContain('Feyd-Rautha');
    expect(text).toMatch(/2 regular/);
  });

  it('covers every action kind without throwing', () => {
    const s = sampleState();
    for (const r of ['leadership', 'strategy', 'mentat', 'deployment', 'house'] as const) {
      const a = resolveAction(s, r);
      expect(typeof describeAction(a)).toBe('string');
      expect(actionHeadline(a).length).toBeGreaterThan(0);
    }
  });

  it('on the sample state, Strategy yields a sietch attack on the target', () => {
    const a = resolveAction(sampleState(), 'strategy');
    expect(a.kind).toBe('attack_sietch');
    if (a.kind === 'attack_sietch') expect(a.sietch).toBe('gara_kulon');
  });
});

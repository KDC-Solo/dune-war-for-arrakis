import { describe, it, expect } from 'vitest';
import { describeAction, actionHeadline, areaLabel } from './describeAction';
import { isDesertArea } from '../engine/describeArea';
import { resolveAction } from '../engine/harkonnenActions';
import { sampleState } from './sampleState';

describe('isDesertArea (wormsign/sandworm placement)', () => {
  it('is true for Desert and Deep Desert, false for other terrain', () => {
    expect(isDesertArea('sihaya_ridge')).toBe(true); // deep desert
    expect(isDesertArea('s1_1')).toBe(true); // unnamed deep desert
    expect(isDesertArea('arrakeen')).toBe(false); // plateau
    expect(isDesertArea('broken_land')).toBe(false); // mountain
    expect(isDesertArea('harg_pass')).toBe(false); // minor erg
  });
});

describe('areaLabel', () => {
  it('uses the proper name for named areas', () => {
    expect(areaLabel('carthag')).toBe('Carthag');
  });
  it('describes an unnamed area by terrain and its named landmarks', () => {
    const label = areaLabel('s1_11');
    expect(label).not.toBe('s1_11'); // no longer the bare id
    expect(label).toMatch(/Gara Kulon/); // anchored to a board landmark
  });
  it('falls back to the raw id for an unknown area', () => {
    expect(areaLabel('not_an_area')).toBe('not_an_area');
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
    expect(text).toContain(areaLabel('s1_11'));
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

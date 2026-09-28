import { describe, expect, it } from 'vitest';
import type { Exercise } from '../../domain/types';
import { defaultMaxFor } from './catalog';

const catalogue: Exercise[] = [
  { id: 'squat', name: 'Squat', aliases: [], hasMax: true },
  { id: 'developpe-couche', name: 'Développé couché', aliases: ['DC', 'Bench'], hasMax: true },
  { id: 'dc-spoto', name: 'DC Spoto', aliases: [] },
  { id: 'squat-pause', name: 'Squat pause', aliases: [] },
  { id: 'rowing', name: 'Rowing', aliases: [], defaultMax: 'developpe-couche' },
  { id: 'curl', name: 'Curl', aliases: [] },
];

describe('RM proposé pour un %', () => {
  it('prend le RM propre, puis le RM par défaut, puis un nom ou alias contenu dans le nom', () => {
    expect(defaultMaxFor('squat', catalogue)).toBe('squat');
    expect(defaultMaxFor('rowing', catalogue)).toBe('developpe-couche');
    expect(defaultMaxFor('squat-pause', catalogue)).toBe('squat');
    expect(defaultMaxFor('dc-spoto', catalogue)).toBe('developpe-couche');
  });
  it('se replie sur le premier RM, ou rien sans RM', () => {
    expect(defaultMaxFor('curl', catalogue)).toBe('squat');
    expect(defaultMaxFor('curl', catalogue.filter((e) => !e.hasMax))).toBeUndefined();
  });
});

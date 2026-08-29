import { describe, test, expect } from 'vitest';
import { badgeText } from '../src/badge.js';

describe('badgeText', () => {
  test('renders a positive count as its number', () => {
    expect(badgeText(1)).toBe('1');
    expect(badgeText(3)).toBe('3');
    expect(badgeText(42)).toBe('42');
  });

  test('hides the badge (empty string) when there are no matches', () => {
    expect(badgeText(0)).toBe('');
  });

  test('hides the badge for negative or invalid counts', () => {
    expect(badgeText(-5)).toBe('');
    expect(badgeText(NaN)).toBe('');
    expect(badgeText(Infinity)).toBe('');
    expect(badgeText('nope')).toBe('');
    expect(badgeText(undefined)).toBe('');
    expect(badgeText(null)).toBe('');
  });

  test('accepts numeric strings the same as numbers', () => {
    expect(badgeText('7')).toBe('7');
  });

  test('floors fractional counts', () => {
    expect(badgeText(1.9)).toBe('1');
  });

  test('caps large counts so they fit the toolbar badge', () => {
    expect(badgeText(999)).toBe('999');
    expect(badgeText(1000)).toBe('999+');
    expect(badgeText(52000)).toBe('999+');
  });
});

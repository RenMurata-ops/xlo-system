import { describe, it, expect } from 'vitest';

describe('Utility Functions', () => {
  it('should pass basic sanity check', () => {
    expect(true).toBe(true);
  });

  it('should handle null/undefined gracefully', () => {
    const testValue = null;
    expect(testValue || 0).toBe(0);

    const testValue2 = undefined;
    expect(testValue2 || 0).toBe(0);
  });

  describe('Number formatting', () => {
    it('should convert null to 0 for toLocaleString()', () => {
      const value = null;
      const result = (value || 0).toLocaleString();
      expect(result).toBe('0');
    });

    it('should handle valid numbers', () => {
      const value = 1000;
      const result = value.toLocaleString();
      expect(result).toMatch(/1[,\s]?000/); // Handles different locales
    });
  });
});

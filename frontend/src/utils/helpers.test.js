import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDate, getInitials, generateId } from './helpers';

describe('Frontend Helpers', () => {

    describe('formatDate', () => {
        it('should return null for empty input', () => {
            expect(formatDate(null)).toBeNull();
            expect(formatDate(undefined)).toBeNull();
            expect(formatDate('')).toBeNull();
        });

        it('should format valid date string correctly', () => {
            // Note: Output depends on locale. Test expects roughly correct format or mocks locale if needed.
            // Using a fixed date
            const dateStr = '2023-01-02T10:30:00.000Z';
            const formatted = formatDate(dateStr);

            // Checks for Month Day, Year at Time
            // e.g., "Jan 2, 2023 at 10:30" (depending on timezone of test runner)
            // To be safe, we check if it returns a string containing key parts
            expect(typeof formatted).toBe('string');
            expect(formatted).toContain('2023');
            expect(formatted).toContain('at');
        });

        it('should handle invalid date string gracefully', () => {
            const result = formatDate('invalid-date');
            expect(result).toBe('Invalid Date at Invalid Date');
        });
    });

    describe('getInitials', () => {
        it('should return uppercase initials for First Last', () => {
            expect(getInitials('John', 'Doe')).toBe('JD');
        });

        it('should return initials for lowercase inputs', () => {
            expect(getInitials('john', 'doe')).toBe('JD');
        });

        it('should handle single name', () => {
            expect(getInitials('Alice', null)).toBe('A');
            expect(getInitials(null, 'Smith')).toBe('S');
        });

        it('should handle null/undefined inputs', () => {
            expect(getInitials(null, null)).toBe('?');
            expect(getInitials(undefined, undefined)).toBe('?');
        });

        it('should handle empty strings', () => {
            expect(getInitials('', '')).toBe('?');
        });
    });

    describe('generateId', () => {
        it('should return a string', () => {
            const id = generateId();
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
        });

        it('should use crypto.randomUUID if available', () => {
            const mockUUID = '1234-5678';
            vi.stubGlobal('crypto', { randomUUID: () => mockUUID });

            expect(generateId()).toBe(mockUUID);

            vi.unstubAllGlobals();
        });

        it('should fallback if crypto is undefined', () => {
            // Backup original crypto
            const originalCrypto = global.crypto;
            vi.stubGlobal('crypto', undefined);

            const id = generateId();
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);

            // Restore
            vi.stubGlobal('crypto', originalCrypto);
        });
    });
});

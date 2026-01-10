import { describe, it, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';

describe('Logger', async () => {
    let logger;
    let consoleLogMock;
    let consoleErrorMock;

    beforeEach(async () => {
        // Reset modules/env for isolation if possible, but simplest is to test behavior
        // logic based on default env (WARN) or just verify formatting.

        // Mock console methods
        consoleLogMock = mock.method(console, 'log', () => { });
        consoleErrorMock = mock.method(console, 'error', () => { });
    });

    afterEach(() => {
        mock.reset();
    });

    it('should format log messages correctly (timestamp, level, component)', async () => {
        // We need to import logger. 
        // Note: process.env.LOG_LEVEL is likely undefined during test run, so defaults to WARN.
        const { logger } = await import('./logger.js');

        logger.warn('TEST_COMP', 'Test message');

        assert.strictEqual(consoleErrorMock.mock.callCount(), 1);
        const output = consoleErrorMock.mock.calls[0].arguments[0];

        // Regex to match: [Timestamp] [WARN ] [TEST_COMP] Test message
        // Timestamp is ISO roughly.
        assert.match(output, /\[.*\] \[WARN \] \[TEST_COMP\].* Test message/);
    });

    it('should suppress INFO logs when level is WARN (default)', async () => {
        const { logger } = await import('./logger.js');

        logger.info('TEST_COMP', 'Should not appear');

        assert.strictEqual(consoleLogMock.mock.callCount(), 0);
        assert.strictEqual(consoleErrorMock.mock.callCount(), 0);
    });

    it('should log ERROR to console.error', async () => {
        const { logger } = await import('./logger.js');

        logger.error('TEST_COMP', 'Error msg');

        assert.strictEqual(consoleErrorMock.mock.callCount(), 1);
        assert.match(consoleErrorMock.mock.calls[0].arguments[0], /\[ERROR\]/);
    });
});

/**
 * Noteer Backend Logger
 * Provides structured logging with levels and ANSI colors.
 */

const LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
};

const COLORS = {
    DEBUG: '\x1b[90m', // Gray
    INFO: '\x1b[32m',  // Green
    WARN: '\x1b[33m',  // Yellow
    ERROR: '\x1b[31m', // Red
    FATAL: '\x1b[41m\x1b[37m', // White on Red
    RESET: '\x1b[0m'
};

const CURRENT_LEVEL = LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LEVELS.WARN;

function log(level, component, message, ...args) {
    if (LEVELS[level] < CURRENT_LEVEL) return;

    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    const color = COLORS[level] || COLORS.RESET;
    const levelStr = level.padEnd(5);

    // Output to stdout/stderr (docker logs)
    const output = `${color}[${timestamp}] [${levelStr}] [${component}]${COLORS.RESET} ${message}`;

    // Stdout for DEBUG/INFO, Stderr for WARN/ERROR/FATAL
    if (LEVELS[level] >= LEVELS.WARN) {
        console.error(output, ...args);
    } else {
        console.log(output, ...args);
    }
}

export const logger = {
    debug: (comp, msg, ...args) => log('DEBUG', comp, msg, ...args),
    info: (comp, msg, ...args) => log('INFO', comp, msg, ...args),
    warn: (comp, msg, ...args) => log('WARN', comp, msg, ...args),
    error: (comp, msg, ...args) => log('ERROR', comp, msg, ...args),
    fatal: (comp, msg, ...args) => log('FATAL', comp, msg, ...args),
};

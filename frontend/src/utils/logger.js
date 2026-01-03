/**
 * Noteer Frontend Logger
 * Provides structured logging with levels and CSS styling for the Browser Console.
 * Log level is fetched from backend /api/config at runtime with localStorage cache for offline.
 */

const LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
};

// CSS styles for console output
const STYLES = {
    DEBUG: 'color: #7f8c8d; font-weight: normal;',          // Gray
    INFO: 'color: #27ae60; font-weight: bold;',            // Green
    WARN: 'color: #f39c12; font-weight: bold;',            // Orange
    ERROR: 'color: #c0392b; font-weight: bold;',           // Red
    FATAL: 'background: #c0392b; color: white; font-weight: bold; padding: 2px 5px;', // Red bg
    COMPONENT: 'color: #2980b9; font-weight: bold;',       // Blue
    TIMESTAMP: 'color: #95a5a6;'                           // Light gray
};

const STORAGE_KEY = 'noteer_log_level';

// Load from localStorage first (offline support), default to INFO
function getInitialLevel() {
    try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached && LEVELS[cached] !== undefined) {
            return LEVELS[cached];
        }
    } catch {
        // localStorage not available
    }
    return LEVELS.WARN;
}

let CURRENT_LEVEL = getInitialLevel();
let configLoaded = false;

// Fetch log level from backend config and cache it
async function loadConfig() {
    if (configLoaded) return;
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            if (config.logLevel && LEVELS[config.logLevel] !== undefined) {
                CURRENT_LEVEL = LEVELS[config.logLevel];
                // Cache for offline use
                try {
                    localStorage.setItem(STORAGE_KEY, config.logLevel);
                } catch {
                    // localStorage not available
                }
            }
        }
    } catch {
        // Offline - use cached or default level (already set in CURRENT_LEVEL)
    }
    configLoaded = true;
}

// Load config immediately
loadConfig();

function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').split('.')[0];
}

function log(level, component, message, ...args) {
    if (LEVELS[level] < CURRENT_LEVEL) return;

    const timestamp = getTimestamp();
    const style = STYLES[level];
    const levelStr = level.padEnd(5);

    // Format: [TIMESTAMP] [LEVEL] [COMPONENT] Message
    const prefix = `%c[${timestamp}] %c[${levelStr}] %c[${component}]`;
    const css = [STYLES.TIMESTAMP, style, STYLES.COMPONENT];

    // Select appropriate console method
    let method = 'log';
    if (level === 'ERROR' || level === 'FATAL') method = 'error';
    else if (level === 'WARN') method = 'warn';

    console[method](prefix, ...css, message, ...args);
}

export const logger = {
    debug: (comp, msg, ...args) => log('DEBUG', comp, msg, ...args),
    info: (comp, msg, ...args) => log('INFO', comp, msg, ...args),
    warn: (comp, msg, ...args) => log('WARN', comp, msg, ...args),
    error: (comp, msg, ...args) => log('ERROR', comp, msg, ...args),
    fatal: (comp, msg, ...args) => log('FATAL', comp, msg, ...args),
};

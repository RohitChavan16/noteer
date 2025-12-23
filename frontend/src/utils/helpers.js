/**
 * Shared utility functions extracted from duplicated code across components
 */

/**
 * Format a date string to a human-readable format
 * @param {string} dateString - ISO date string
 * @returns {string|null} Formatted date or null if invalid
 */
export function formatDate(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Get initials from given and family names
 * @param {string} givenName - First name
 * @param {string} familyName - Last name  
 * @returns {string} Initials (e.g., "JD" for "John Doe")
 */
export function getInitials(givenName, familyName) {
    const first = givenName?.charAt(0)?.toUpperCase() || '';
    const last = familyName?.charAt(0)?.toUpperCase() || '';
    return first + last || '?';
}

/**
 * Generate a unique ID (fallback for crypto.randomUUID)
 * @returns {string} Unique identifier
 */
export function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

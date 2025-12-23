// Note application limits - extracted from across the codebase
export const NOTE_LIMITS = {
    MAX_CONTENT_LENGTH: 60000,
    MAX_CHECKLIST_ITEMS: 200,
    MAX_IMAGES: 2,
    MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_TITLE_LENGTH: 500,
    MAX_ITEM_LENGTH: 500,
};

export const SYNC_CONFIG = {
    DEBOUNCE_SAVE_MS: 2000,
    POLL_INTERVAL_MS: 5000,
};

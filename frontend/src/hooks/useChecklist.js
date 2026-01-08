import { useState, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { generateId } from '../utils/helpers';

const STORAGE_KEY = 'noteer-checklist-completed-expanded';

/**
 * Custom hook for managing checklist items with drag-and-drop support
 * Extracted from NoteModal to reduce component complexity
 * @param {Array} initialItems - Initial checklist items
 * @param {Object} options - Hook options
 * @param {boolean} options.persistExpanded - Whether to persist expanded state to localStorage
 */
export function useChecklist(initialItems = [], { persistExpanded = true } = {}) {
    const [items, setItems] = useState(
        initialItems.map(item => ({
            ...item,
            id: item.id || generateId()
        }))
    );

    // New item input state
    const [newItemText, setNewItemText] = useState('');

    // Completed section expanded state with localStorage persistence
    const [completedExpanded, setCompletedExpanded] = useState(() => {
        if (!persistExpanded || typeof window === 'undefined') return true;
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored !== null ? JSON.parse(stored) : true;
        } catch {
            return true;
        }
    });

    const toggleCompletedExpanded = useCallback(() => {
        setCompletedExpanded(prev => {
            const newVal = !prev;
            if (persistExpanded) {
                queueMicrotask(() => {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVal));
                });
            }
            return newVal;
        });
    }, [persistExpanded]);

    /**
     * Add an item with content (from the input field)
     * Clears newItemText after adding
     * @returns {string|null} New item ID or null if empty
     */
    const addItemWithContent = useCallback(() => {
        const text = newItemText.trim();
        if (!text) return null;

        const newItem = { id: generateId(), content: text, is_checked: false };

        setItems(currentItems => {
            const firstCheckedIndex = currentItems.findIndex(i => i.is_checked);
            if (firstCheckedIndex === -1) {
                return [...currentItems, newItem];
            }
            const updated = [...currentItems];
            updated.splice(firstCheckedIndex, 0, newItem);
            return updated;
        });

        setNewItemText('');
        return newItem.id;
    }, [newItemText]);

    /**
     * Add an empty item (for inline editing)
     * @param {string|null} beforeUncheckedId - Insert before this item
     * @returns {string} New item ID
     */
    const addItem = useCallback((beforeUncheckedId = null) => {
        const newItem = { id: generateId(), content: '', is_checked: false };

        setItems(currentItems => {
            if (beforeUncheckedId) {
                const idx = currentItems.findIndex(i => i.id === beforeUncheckedId);
                if (idx !== -1) {
                    const updated = [...currentItems];
                    updated.splice(idx, 0, newItem);
                    return updated;
                }
            }

            const firstCheckedIdx = currentItems.findIndex(i => i.is_checked);
            if (firstCheckedIdx === -1) {
                return [...currentItems, newItem];
            }
            const updated = [...currentItems];
            updated.splice(firstCheckedIdx, 0, newItem);
            return updated;
        });

        return newItem.id;
    }, []);

    const removeItem = useCallback((id) => {
        setItems(current => current.filter(item => item.id !== id));
    }, []);

    const toggleItemCheck = useCallback((id) => {
        setItems(currentItems => {
            const itemIndex = currentItems.findIndex(i => i.id === id);
            if (itemIndex === -1) return currentItems;

            const item = currentItems[itemIndex];
            const newItem = { ...item, is_checked: !item.is_checked };

            const updated = [...currentItems];
            updated.splice(itemIndex, 1);

            if (newItem.is_checked) {
                // Move to end (completed)
                updated.push(newItem);
            } else {
                // Move back to active list
                const firstCheckedIndex = updated.findIndex(i => i.is_checked);
                if (firstCheckedIndex === -1) {
                    updated.push(newItem);
                } else {
                    updated.splice(firstCheckedIndex, 0, newItem);
                }
            }
            return updated;
        });
    }, []);

    const updateItemContent = useCallback((id, content) => {
        setItems(current =>
            current.map(item =>
                item.id === id ? { ...item, content } : item
            )
        );
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        if (active && over && active.id !== over.id) {
            setItems(currentItems => {
                const oldIndex = currentItems.findIndex(i => i.id === active.id);
                const newIndex = currentItems.findIndex(i => i.id === over.id);
                return arrayMove(currentItems, oldIndex, newIndex);
            });
        }
    }, []);

    const resetItems = useCallback((newItems) => {
        setItems(newItems.map(item => ({
            ...item,
            id: item.id || generateId()
        })));
    }, []);

    // Derived state
    const uncheckedItems = items.filter(i => !i.is_checked);
    const checkedItems = items.filter(i => i.is_checked);

    return {
        items,
        uncheckedItems,
        checkedItems,
        completedExpanded,
        toggleCompletedExpanded,
        newItemText,
        setNewItemText,
        addItem,
        addItemWithContent,
        removeItem,
        toggleItemCheck,
        updateItemContent,
        handleDragEnd,
        resetItems,
        setItems,
    };
}

export default useChecklist;

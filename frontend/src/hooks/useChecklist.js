import { useState, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { generateId } from '../utils/helpers';

/**
 * Custom hook for managing checklist items with drag-and-drop support
 * Extracted from NoteModal to reduce component complexity
 */
export function useChecklist(initialItems = []) {
    const [items, setItems] = useState(
        initialItems.map(item => ({
            ...item,
            id: item.id || generateId()
        }))
    );
    const [completedExpanded, setCompletedExpanded] = useState(true);

    const toggleCompletedExpanded = useCallback(() => {
        setCompletedExpanded(prev => !prev);
    }, []);

    const addItem = useCallback((beforeUncheckedId = null) => {
        const newItem = { id: generateId(), content: '', is_checked: false };

        setItems(currentItems => {
            if (beforeUncheckedId) {
                const idx = currentItems.findIndex(i => i.id === beforeUncheckedId);
                if (idx !== -1) {
                    const newItems = [...currentItems];
                    newItems.splice(idx, 0, newItem);
                    return newItems;
                }
            }

            // Add at end of unchecked items (before checked ones)
            const firstCheckedIdx = currentItems.findIndex(i => i.is_checked);
            if (firstCheckedIdx === -1) {
                return [...currentItems, newItem];
            }
            const newItems = [...currentItems];
            newItems.splice(firstCheckedIdx, 0, newItem);
            return newItems;
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

            const newItems = [...currentItems];
            newItems[itemIndex] = {
                ...newItems[itemIndex],
                is_checked: !newItems[itemIndex].is_checked
            };

            // Reorder: unchecked first, then checked
            const unchecked = newItems.filter(i => !i.is_checked);
            const checked = newItems.filter(i => i.is_checked);
            return [...unchecked, ...checked];
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
        addItem,
        removeItem,
        toggleItemCheck,
        updateItemContent,
        handleDragEnd,
        resetItems,
        setItems,
    };
}

export default useChecklist;

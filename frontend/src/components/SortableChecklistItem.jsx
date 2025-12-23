import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Group, Checkbox, TextInput, ActionIcon } from '@mantine/core';
import { IconGripVertical, IconX } from '@tabler/icons-react';

export default function SortableChecklistItem({
    item,
    onToggle,
    onUpdate,
    onRemove,
    textColor,
    backgroundColor,
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        backgroundColor: isDragging ? backgroundColor : 'transparent',
        borderRadius: '4px',
        boxShadow: isDragging ? '0 8px 16px rgba(0,0,0,0.2)' : 'none',
        opacity: isDragging ? 0.9 : 1,
        zIndex: isDragging ? 9999 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            data-testid="checklist-item"
            data-item-id={item.id}
        >
            <Group gap="xs" wrap="nowrap" mb={4} align="center">
                <button
                    ref={setActivatorNodeRef}
                    {...listeners}
                    type="button"
                    data-testid="drag-handle"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        height: '32px',
                        width: '24px',
                        marginLeft: '-4px',
                        touchAction: 'none',
                        WebkitTapHighlightColor: 'transparent',
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                    }}
                >
                    <IconGripVertical size={16} style={{ opacity: 0.4, color: textColor }} />
                </button>
                <Checkbox
                    checked={item.is_checked}
                    onChange={() => onToggle(item.id)}
                    size="xs"
                    color={textColor === '#000000' ? 'dark' : 'blue'}
                    style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
                />
                <TextInput
                    value={item.content}
                    onChange={(e) => onUpdate(item.id, e.target.value)}
                    variant="unstyled"
                    size="sm"
                    maxLength={500}
                    data-testid="item-content"
                    style={{ flex: 1, pointerEvents: isDragging ? 'none' : 'auto' }}
                    styles={{
                        input: {
                            textDecoration: item.is_checked ? 'line-through' : 'none',
                            opacity: item.is_checked ? 0.6 : 1,
                            color: textColor,
                        },
                    }}
                />
                <ActionIcon
                    variant="subtle"
                    size="xs"
                    onClick={() => onRemove(item.id)}
                    style={{ color: textColor, pointerEvents: isDragging ? 'none' : 'auto' }}
                >
                    <IconX size={12} />
                </ActionIcon>
            </Group>
        </div>
    );
}

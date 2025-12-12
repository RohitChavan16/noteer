import NoteCard from './NoteCard';

export default {
    title: 'Components/NoteCard',
    component: NoteCard,
    tags: ['autodocs'],
    argTypes: {
        note: { control: 'object' },
        showRestore: { control: 'boolean' },
        showDelete: { control: 'boolean' },
    },
};

const baseNote = {
    id: 1,
    title: 'Sample Note',
    content: 'This is the content of the note. It can be quite long and will be truncated if necessary.',
    color: 'default',
    is_pinned: false,
    labels: [],
    items: [],
};

export const Default = {
    args: {
        note: baseNote,
    },
};

export const Pinned = {
    args: {
        note: { ...baseNote, is_pinned: true },
    },
};

export const WithColor = {
    args: {
        note: { ...baseNote, color: 'blue', title: 'Blue Note' },
    },
};

export const AllColors = {
    render: () => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', maxWidth: '800px' }}>
            {['default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'brown', 'gray'].map((color) => (
                <div key={color} style={{ width: '200px' }}>
                    <NoteCard
                        note={{ ...baseNote, id: color, color, title: color.charAt(0).toUpperCase() + color.slice(1) }}
                    />
                </div>
            ))}
        </div>
    ),
};

export const WithLabels = {
    args: {
        note: { ...baseNote, labels: ['Work', 'Important', 'Ideas'] },
    },
};

export const WithChecklist = {
    args: {
        note: {
            ...baseNote,
            title: 'Shopping List',
            content: '',
            items: [
                { content: 'Milk', is_checked: true },
                { content: 'Bread', is_checked: false },
                { content: 'Eggs', is_checked: false },
                { content: 'Butter', is_checked: true },
            ],
        },
    },
};

export const LongContent = {
    args: {
        note: {
            ...baseNote,
            title: 'Meeting Notes',
            content: `# Project Update Meeting

## Attendees
- John Smith
- Jane Doe
- Bob Johnson

## Agenda
1. Review Q3 progress
2. Discuss blockers
3. Plan for Q4

## Action Items
- John to follow up with client
- Jane to prepare presentation
- Bob to update documentation

This is a very long note that demonstrates how content is truncated when it exceeds the maximum display height.`,
        },
    },
};

export const InTrash = {
    args: {
        note: baseNote,
        showRestore: true,
        showDelete: true,
    },
};

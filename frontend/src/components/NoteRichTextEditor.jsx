import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
// import Underline from '@tiptap/extension-underline';
// import TextStyle from '@tiptap/extension-text-style'; // Causing build issues
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { ActionIcon, Group, Popover, ColorSwatch, SimpleGrid, Divider, useMantineTheme, Box } from '@mantine/core';
import {
    IconBold, IconItalic, IconUnderline, IconStrikethrough,
    IconColorSwatch, IconHighlight, IconClearFormatting,
    IconMinus, IconPlus
} from '@tabler/icons-react';
import { NOTE_COLORS } from '../constants/noteColors';
import { useEffect } from 'react';
import { Mark, mergeAttributes, getMarkAttributes } from '@tiptap/core';

// Inline TextStyle definition to avoid build issues with the package
const TextStyle = Mark.create({
    name: 'textStyle',

    addOptions() {
        return {
            HTMLAttributes: {},
        }
    },

    addAttributes() {
        return {
            fontSize: {
                default: null,
                parseHTML: element => element.style.fontSize.replace(/['"]+/g, ''),
                renderHTML: attributes => {
                    if (!attributes.fontSize) {
                        return {};
                    }
                    return {
                        style: `font-size: ${attributes.fontSize}`,
                    };
                },
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'span',
                getAttrs: element => {
                    const hasStyles = element.hasAttribute('style')
                    if (!hasStyles) {
                        return false
                    }
                    return {}
                },
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
    },

    addCommands() {
        return {
            setTextStyle: attributes => ({ commands }) => {
                return commands.setMark(this.name, attributes)
            },
            unsetTextStyle: () => ({ commands }) => {
                return commands.unsetMark(this.name)
            },
            removeEmptyTextStyle: () => ({ state, commands }) => {
                const attributes = getMarkAttributes(state, this.type)
                const hasStyles = Object.entries(attributes).some(([, value]) => !!value)

                if (hasStyles) {
                    return true
                }

                return commands.unsetMark(this.name)
            },
        }
    },
})

export default function NoteRichTextEditor({ content, onChange, showToolbar, isDark }) {
    const theme = useMantineTheme();

    const editor = useEditor({
        extensions: [
            StarterKit,
            // Underline, // Removed to fix duplicate extension warning
            TextStyle,
            Color,
            Highlight.configure({
                multicolor: true,
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Placeholder.configure({
                placeholder: 'Take a note...',
            }),
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                style: 'min-height: 150px; outline: none; padding: 0.5rem;',
            },
        },
    });

    // Update content if it changes externally (only if different to prevent cursor jumps, though basic check here)
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            // Check if it's just a p tag wrapper difference or empty
            if (editor.isEmpty && !content) return;
            // We generally avoid forcing content update from prop to avoid loop issues, 
            // but for initial load it's needed. 
            // Ideally parent handles 'initialContent' separately.
        }
    }, [content, editor]);


    if (!editor) {
        return null;
    }

    const MIN_FONT_SIZE = 12;
    const MAX_FONT_SIZE = 32;
    const STEP = 4;

    const getCurrentFontSize = () => {
        const textStyle = editor.getAttributes('textStyle');
        // Default to 16px if not set
        if (!textStyle.fontSize) return 16;
        return parseInt(textStyle.fontSize.replace('px', ''), 10);
    };

    const currentSize = getCurrentFontSize();

    const changeFontSize = (step) => {
        const newSize = currentSize + step;
        if (newSize >= MIN_FONT_SIZE && newSize <= MAX_FONT_SIZE) {
            editor.chain().focus().setTextStyle({ fontSize: `${newSize}px` }).run();
        }
    };

    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const iconSize = isTouchDevice ? 22 : 18;
    const buttonSize = isTouchDevice ? "lg" : "sm";

    const colors = Object.values(NOTE_COLORS).map(c => isDark ? c.dark : c.light);

    return (
        <Box>
            <div className={`editor-content ${isDark ? 'dark-mode' : ''}`}>
                <EditorContent editor={editor} style={{ minHeight: '100px' }} />
            </div>

            {showToolbar && (
                <>
                    <Divider my="xs" label="Formatting" labelPosition="center" />
                    <Group gap={8} p="xs" style={{
                        borderTop: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                        backgroundColor: isDark ? theme.colors.dark[6] : theme.colors.gray[0],
                        borderRadius: theme.radius.sm
                    }}>
                        {/* Basic Formatting */}
                        <ActionIcon
                            size={buttonSize}
                            variant={editor.isActive('bold') ? 'filled' : 'subtle'}
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            title="Bold"
                        >
                            <IconBold size={iconSize} />
                        </ActionIcon>
                        <ActionIcon
                            size={buttonSize}
                            variant={editor.isActive('italic') ? 'filled' : 'subtle'}
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            title="Italic"
                        >
                            <IconItalic size={iconSize} />
                        </ActionIcon>
                        <ActionIcon
                            size={buttonSize}
                            variant={editor.isActive('underline') ? 'filled' : 'subtle'}
                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                            title="Underline"
                        >
                            <IconUnderline size={iconSize} />
                        </ActionIcon>
                        <ActionIcon
                            size={buttonSize}
                            variant={editor.isActive('strike') ? 'filled' : 'subtle'}
                            onClick={() => editor.chain().focus().toggleStrike().run()}
                            title="Strikethrough"
                        >
                            <IconStrikethrough size={iconSize} />
                        </ActionIcon>

                        <Divider orientation="vertical" />

                        {/* Font Size */}
                        <ActionIcon
                            size={buttonSize}
                            variant="subtle"
                            onClick={() => changeFontSize(-STEP)}
                            disabled={currentSize <= MIN_FONT_SIZE}
                            title="Decrease font size"
                        >
                            <IconMinus size={iconSize} />
                        </ActionIcon>
                        <ActionIcon
                            size={buttonSize}
                            variant="subtle"
                            onClick={() => changeFontSize(STEP)}
                            disabled={currentSize >= MAX_FONT_SIZE}
                            title="Increase font size"
                        >
                            <IconPlus size={iconSize} />
                        </ActionIcon>

                        <Divider orientation="vertical" />

                        {/* Text Color */}
                        <Popover width={200} position="bottom" shadow="md">
                            <Popover.Target>
                                <ActionIcon
                                    size={buttonSize}
                                    variant={editor.getAttributes('textStyle').color ? 'filled' : 'subtle'}
                                    title="Text Color"
                                >
                                    <IconColorSwatch size={iconSize} />
                                </ActionIcon>
                            </Popover.Target>
                            <Popover.Dropdown>
                                <SimpleGrid cols={5} spacing="xs">
                                    {colors.map((c) => (
                                        <ColorSwatch
                                            key={c}
                                            color={c}
                                            onClick={() => editor.chain().focus().setColor(c).run()}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    ))}
                                    <ActionIcon variant="default" onClick={() => editor.chain().focus().unsetColor().run()} title="Reset">
                                        <IconClearFormatting size={14} />
                                    </ActionIcon>
                                </SimpleGrid>
                            </Popover.Dropdown>
                        </Popover>

                        {/* Highlight Color */}
                        <Popover width={200} position="bottom" shadow="md">
                            <Popover.Target>
                                <ActionIcon
                                    size={buttonSize}
                                    variant={editor.isActive('highlight') ? 'filled' : 'subtle'}
                                    title="Highlight Color"
                                >
                                    <IconHighlight size={iconSize} />
                                </ActionIcon>
                            </Popover.Target>
                            <Popover.Dropdown>
                                <SimpleGrid cols={5} spacing="xs">
                                    {colors.map((c) => (
                                        <ColorSwatch
                                            key={c}
                                            color={c}
                                            onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    ))}
                                    <ActionIcon variant="default" onClick={() => editor.chain().focus().unsetHighlight().run()} title="Reset">
                                        <IconClearFormatting size={14} />
                                    </ActionIcon>
                                </SimpleGrid>
                            </Popover.Dropdown>
                        </Popover>

                        <Divider orientation="vertical" />

                        {/* Clear Formatting */}
                        <ActionIcon
                            size={buttonSize}
                            variant="subtle"
                            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                            title="Clear formatting"
                        >
                            <IconClearFormatting size={iconSize} />
                        </ActionIcon>
                    </Group>
                </>
            )}

            <style>{`
                .ProseMirror {
                    outline: none;
                }
                .ProseMirror p.is-editor-empty:first-child::before {
                    color: #adb5bd;
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
            `}</style>
        </Box>
    );
}

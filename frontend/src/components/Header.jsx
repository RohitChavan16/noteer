import { useState } from 'react';
import { useMantineColorScheme } from '@mantine/core';
import { Group, TextInput, ActionIcon, Burger, SegmentedControl, Box } from '@mantine/core';
import { useNotesStore } from '../stores/notesStore';
import { IconSearch, IconX, IconSun, IconMoon, IconLayoutGrid, IconList } from '@tabler/icons-react';

export default function Header({ onMenuToggle, isMenuOpen }) {
    const { colorScheme, setColorScheme } = useMantineColorScheme();
    const { searchQuery, setSearchQuery, viewMode, setViewMode } = useNotesStore();
    const [localSearch, setLocalSearch] = useState(searchQuery);

    const handleSearch = (e) => {
        const value = e.target.value;
        setLocalSearch(value);
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(() => {
            setSearchQuery(value);
        }, 300);
    };

    const clearSearch = () => {
        setLocalSearch('');
        setSearchQuery('');
    };

    const toggleColorScheme = () => {
        setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
    };

    return (
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
                <Burger
                    opened={isMenuOpen}
                    onClick={onMenuToggle}
                    hiddenFrom="sm"
                    size="sm"
                />
                <TextInput
                    placeholder="Search notes..."
                    leftSection={<IconSearch size={16} />}
                    rightSection={
                        localSearch ? (
                            <ActionIcon variant="subtle" size="sm" onClick={clearSearch}>
                                <IconX size={14} />
                            </ActionIcon>
                        ) : null
                    }
                    value={localSearch}
                    onChange={handleSearch}
                    w={{ base: 140, xs: 180, sm: 300, md: 400 }}
                    size="sm"
                />
            </Group>

            <Group gap={4} wrap="nowrap">
                <SegmentedControl
                    value={viewMode}
                    onChange={setViewMode}
                    data={[
                        { value: 'grid', label: <IconLayoutGrid size={16} /> },
                        { value: 'list', label: <IconList size={16} /> },
                    ]}
                    size="xs"
                />
                <ActionIcon
                    variant="subtle"
                    size="md"
                    onClick={toggleColorScheme}
                    title={`Switch to ${colorScheme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
                </ActionIcon>
            </Group>
        </Group>
    );
}

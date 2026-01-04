import { useState } from 'react';
import { useMantineColorScheme } from '@mantine/core';
import { Group, TextInput, ActionIcon, Burger, SegmentedControl, Menu, Tooltip } from '@mantine/core';
import { useNotesStore } from '../stores/notesStore';
import { IconSearch, IconX, IconSun, IconMoon, IconLayoutGrid, IconList, IconSortAscending, IconSortDescending, IconSortAZ, IconCheckbox } from '@tabler/icons-react';
import { SyncStatus } from './SyncStatus';

export default function Header({ onMenuToggle, isMenuOpen }) {
    const { colorScheme, toggleColorScheme } = useMantineColorScheme();
    const { searchQuery, setSearchQuery, viewMode, setViewMode, sortBy, sortOrder, setSortBy, setSortOrder, isSelectionMode, toggleSelectionMode } = useNotesStore();
    const [localSearch, setLocalSearch] = useState(searchQuery);

    const handleSearch = (e) => {
        const value = e.target.value;
        setLocalSearch(value);
        setSearchQuery(value);
    };

    const clearSearch = () => {
        setLocalSearch('');
        setSearchQuery('');
    };



    const getSortIcon = () => {
        if (sortBy === 'title') {
            return <IconSortAZ size={18} />;
        }
        return sortOrder === 'desc' ? <IconSortDescending size={18} /> : <IconSortAscending size={18} />;
    };

    const getSortLabel = () => {
        if (sortBy === 'title') {
            return sortOrder === 'asc' ? 'A → Z' : 'Z → A';
        }
        return sortOrder === 'desc' ? 'Newest first' : 'Oldest first';
    };

    return (
        <header style={{
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            borderBottom: '1px solid var(--mantine-color-default-border)',
            backgroundColor: 'var(--mantine-color-body)',
            position: 'sticky',
            top: 0,
            zIndex: 100
        }}>
            <Group w="100%" justify="space-between">
                <Group>
                    <Burger opened={isMenuOpen} onClick={onMenuToggle} hiddenFrom="sm" size="sm" />
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Noteer
                    </div>
                </Group>

                <Group flex={1} maw={600} mx="md">
                    <TextInput
                        placeholder="Search"
                        value={localSearch}
                        onChange={handleSearch}
                        leftSection={<IconSearch size={16} />}
                        rightSection={
                            localSearch && (
                                <ActionIcon size="sm" variant="transparent" c="dimmed" onClick={clearSearch}>
                                    <IconX size={14} />
                                </ActionIcon>
                            )
                        }
                        style={{ flex: 1 }}
                    />
                </Group>

                <Group gap={4} wrap="nowrap">
                    {/* Sorting dropdown */}
                    <Menu shadow="md" width={180} position="bottom-end">
                        <Menu.Target>
                            <Tooltip label={getSortLabel()}>
                                <ActionIcon variant="subtle" size="md">
                                    {getSortIcon()}
                                </ActionIcon>
                            </Tooltip>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Label>Sort by</Menu.Label>
                            <Menu.Item
                                leftSection={<IconSortDescending size={14} />}
                                onClick={() => { setSortBy('updated_at'); setSortOrder('desc'); }}
                                style={{ fontWeight: sortBy === 'updated_at' && sortOrder === 'desc' ? 600 : 400 }}
                            >
                                Newest first
                            </Menu.Item>
                            <Menu.Item
                                leftSection={<IconSortAscending size={14} />}
                                onClick={() => { setSortBy('updated_at'); setSortOrder('asc'); }}
                                style={{ fontWeight: sortBy === 'updated_at' && sortOrder === 'asc' ? 600 : 400 }}
                            >
                                Oldest first
                            </Menu.Item>
                            <Menu.Item
                                leftSection={<IconSortAZ size={14} />}
                                onClick={() => { setSortBy('title'); setSortOrder('asc'); }}
                                style={{ fontWeight: sortBy === 'title' && sortOrder === 'asc' ? 600 : 400 }}
                            >
                                Alphabetical (A→Z)
                            </Menu.Item>
                            <Menu.Item
                                leftSection={<IconSortAZ size={14} style={{ transform: 'scaleX(-1)' }} />}
                                onClick={() => { setSortBy('title'); setSortOrder('desc'); }}
                                style={{ fontWeight: sortBy === 'title' && sortOrder === 'desc' ? 600 : 400 }}
                            >
                                Alphabetical (Z→A)
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>

                    {/* Hide toggle on touch devices - always use list view there */}
                    {(typeof window === 'undefined' || (!('ontouchstart' in window) && navigator.maxTouchPoints === 0)) && (
                        <SegmentedControl
                            value={viewMode}
                            onChange={setViewMode}
                            data={[
                                { value: 'grid', label: <IconLayoutGrid size={16} /> },
                                { value: 'list', label: <IconList size={16} /> },
                            ]}
                            size="xs"
                        />
                    )}
                    {/* Selection Toggle */}
                    <Tooltip label={isSelectionMode ? "Cancel selection" : "Select notes"}>
                        <ActionIcon
                            variant={isSelectionMode ? "filled" : "subtle"}
                            color={isSelectionMode ? "blue" : undefined}
                            size="md"
                            onClick={toggleSelectionMode}
                        >
                            <IconCheckbox size={18} />
                        </ActionIcon>
                    </Tooltip>

                    <ActionIcon
                        variant="subtle"
                        size="md"
                        onClick={toggleColorScheme}
                        title={`Switch to ${colorScheme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
                    </ActionIcon>
                    <SyncStatus />
                </Group>
            </Group>
        </header>
    );
}

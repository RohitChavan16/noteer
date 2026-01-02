import { ActionIcon, Tooltip, rem, Loader } from '@mantine/core';
import { IconCloudCheck, IconCloudUpload } from '@tabler/icons-react';
import { useNotesStore } from '../stores/notesStore';
import { formatDistanceToNow } from 'date-fns';

export function SyncStatus() {
    const isSyncing = useNotesStore((state) => state.isSyncing);
    const lastSyncedAt = useNotesStore((state) => state.lastSyncedAt);
    const pendingChanges = useNotesStore((state) => state.pendingChanges);
    const triggerSync = useNotesStore((state) => state.triggerSync);

    const getTooltipLabel = () => {
        if (isSyncing) return 'Syncing...';
        if (pendingChanges) return 'Saving changes... (click to sync now)';
        if (lastSyncedAt) {
            return `Last synced: ${formatDistanceToNow(lastSyncedAt, { addSuffix: true })} (click to sync)`;
        }
        return 'All changes saved (click to sync)';
    };

    const handleClick = () => {
        if (triggerSync && !isSyncing) {
            triggerSync();
        }
    };

    return (
        <Tooltip label={getTooltipLabel()} withArrow>
            <ActionIcon
                variant="subtle"
                color={isSyncing || pendingChanges ? "blue" : "green"}
                size="lg"
                onClick={handleClick}
                style={{ cursor: isSyncing ? 'wait' : 'pointer' }}
            >
                {isSyncing ? (
                    <Loader size="xs" color="blue" />
                ) : pendingChanges ? (
                    <IconCloudUpload style={{ width: rem(20), height: rem(20) }} />
                ) : (
                    <IconCloudCheck style={{ width: rem(20), height: rem(20) }} />
                )}
            </ActionIcon>
        </Tooltip>
    );
}

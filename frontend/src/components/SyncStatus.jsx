import { ActionIcon, Tooltip, rem, Loader, ThemeIcon } from '@mantine/core';
import { IconCloudCheck, IconCloudUpload } from '@tabler/icons-react';
import { useNotesStore } from '../stores/notesStore';
import { enUS } from 'date-fns/locale';
import { formatDistanceToNow } from 'date-fns';

export function SyncStatus() {
    const isSyncing = useNotesStore((state) => state.isSyncing);
    const lastSyncedAt = useNotesStore((state) => state.lastSyncedAt);
    const pendingChanges = useNotesStore((state) => state.pendingChanges);

    const getTooltipLabel = () => {
        if (isSyncing) return 'Syncing...';
        if (pendingChanges) return 'Saving changes...';
        if (lastSyncedAt) {
            return `Last synced: ${formatDistanceToNow(lastSyncedAt, { addSuffix: true })}`;
        }
        return 'All changes saved';
    };

    return (
        <Tooltip label={getTooltipLabel()} withArrow>
            <ActionIcon
                variant="subtle"
                color={isSyncing || pendingChanges ? "blue" : "green"}
                size="lg"
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

import { FolderPlus, MoreVertical, Pencil, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PaneActionsMenuProps {
  disabled?: boolean;
  showHidden: boolean;
  hasSelection: boolean;
  onToggleHidden: () => void;
  onRefresh: () => void;
  onNewFolder: () => void;
  onRename: () => void;
}

export default function PaneActionsMenu({
  disabled,
  showHidden,
  hasSelection,
  onToggleHidden,
  onRefresh,
  onNewFolder,
  onRename,
}: PaneActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" disabled={disabled} />}
        title="Pane actions"
      >
        <MoreVertical />
        <span className="sr-only">Pane actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={"w-72"}>
        <DropdownMenuCheckboxItem checked={showHidden} onCheckedChange={onToggleHidden}>
          Show hidden files
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onRefresh}>
          <RefreshCw />
          Refresh
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onNewFolder}>
          <FolderPlus />
          New folder
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename} disabled={!hasSelection}>
          <Pencil />
          Rename
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

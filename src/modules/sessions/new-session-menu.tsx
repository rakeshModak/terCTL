import { useNavigate } from '@tanstack/react-router';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  ChevronRight,
  Plus,
  Search,
  Server,
  SquareTerminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { connectAtom, hostsAtom, openLocalTerminalAtom } from '../../store/app';

/** Saved hosts listed inline before falling back to the full Hosts view. */
const INLINE_HOST_LIMIT = 6;

/**
 * The title bar's "+" control: pick between a local shell and connecting to a
 * saved host, without leaving the terminal. Lives in the sessions module
 * because it owns session creation; the title bar only places it.
 */
export default function NewSessionMenu() {
  const hosts = useAtomValue(hostsAtom);
  const connect = useSetAtom(connectAtom);
  const openLocalTerminal = useSetAtom(openLocalTerminalAtom);
  const navigate = useNavigate();

  const inlineHosts = hosts.slice(0, INLINE_HOST_LIMIT);
  const hasMore = hosts.length > inlineHosts.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}
        data-no-drag
        title="New session"
      >
        <Plus />
        <span className="sr-only">New session</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem onClick={() => void openLocalTerminal()}>
          <SquareTerminal />
          New local terminal
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Base UI requires GroupLabel to sit inside a Group — a bare label
            throws "MenuGroupContext is missing". It also gives the label an
            aria-labelledby relationship with the items it heads. */}
        {inlineHosts.length > 0 ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Connect to a server</DropdownMenuLabel>
              {inlineHosts.map((host) => (
                <DropdownMenuItem
                  key={host.id}
                  onClick={() => void connect(host)}
                >
                  <Server />
                  <span className="min-w-0 flex-1 truncate">{host.label}</span>
                  <span className="text-muted-foreground truncate font-mono text-xs">
                    {host.username}@{host.hostname}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuLabel>No saved servers yet</DropdownMenuLabel>
          </DropdownMenuGroup>
        )}

        <DropdownMenuItem onClick={() => navigate({ to: '/hosts' })}>
          <Search />
          {hasMore ? `Browse all ${hosts.length} hosts…` : 'Browse hosts…'}
          <ChevronRight className="ml-auto" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

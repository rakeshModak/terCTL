import { RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DisconnectedBarProps {
  onReconnect: () => void;
  onClose: () => void;
}

function DisconnectedBar({
  onReconnect,
  onClose,
}: Readonly<DisconnectedBarProps>) {
  return (
    <div className="border-destructive/35 bg-popover absolute inset-x-0 bottom-6 z-6 mx-auto flex w-fit animate-[rise_0.2s_ease_both] items-center gap-2.5 rounded-xl border py-2 pr-2.5 pl-3.5 text-xs shadow-lg">
      <span className="bg-destructive size-2 rounded-full shadow-[0_0_8px_var(--red)]" />
      <span>Disconnected</span>
      <Button size="sm" onClick={onReconnect}>
        <RotateCw />
        Reconnect
      </Button>
      <Button variant="ghost" size="sm" onClick={onClose}>
        <X />
        Close tab
      </Button>
    </div>
  );
}

export default DisconnectedBar;

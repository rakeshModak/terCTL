import { useAtomValue, useSetAtom } from 'jotai';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  availableUpdateAtom,
  checkForUpdateAtom,
  lastCheckedAtom,
  updateErrorAtom,
  updateStatusAtom,
} from '@/store/updater';
import { appVersionAtom } from '@/store/version';
import SettingRow from '@/modules/settings/setting-row';

export default function UpdateRow() {
  const updateStatus = useAtomValue(updateStatusAtom);
  const availableUpdate = useAtomValue(availableUpdateAtom);
  const updateError = useAtomValue(updateErrorAtom);
  const appVersion = useAtomValue(appVersionAtom);
  const lastChecked = useAtomValue(lastCheckedAtom);
  const checkForUpdate = useSetAtom(checkForUpdateAtom);

  const checking = updateStatus === 'checking';

  const checkedAt = lastChecked
    ? new Date(lastChecked).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  let label: string;

  if (checking) label = 'Checking for updates… this can take a moment.';
  else if (updateStatus === 'uptodate')
    label = checkedAt
      ? `You're on the latest version — checked at ${checkedAt}.`
      : "You're on the latest version.";
  else if (updateStatus === 'available')
    label = `Version ${availableUpdate?.version} is available — see the banner to install.`;
  else if (updateStatus === 'error')
    label = `Couldn't check for updates: ${updateError}`;
  else label = 'Keep TerCTL up to date.';

  return (
    <div className="mt-8 max-w-3xl">
      <Separator className="mb-2" />
      <SettingRow
        title={
          <>
            Software update
            {appVersion && (
              <span className="text-muted-foreground ml-2 font-mono font-normal">
                v{appVersion}
              </span>
            )}
          </>
        }
        description={label}
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={checking}
            onClick={() => checkForUpdate()}
          >
            <RefreshCw className={checking ? 'animate-spin' : undefined} />
            {checking ? 'Checking…' : 'Check for updates'}
          </Button>
        }
      />
    </div>
  );
}

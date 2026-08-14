import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import SettingRow, { SettingRowList } from '@/modules/settings/setting-row';
import SettingsSection from '@/modules/settings/settings-section';

export default function SecuritySection() {
  return (
    <SettingsSection
      title="Security"
      description="Agent, host keys, and locking policy."
    >
      <div className="border-chart-4/25 bg-chart-4/10 mb-5 flex items-center gap-3 rounded-xl border px-4 py-3">
        <ShieldCheck className="text-chart-4 size-4 shrink-0" />
        <span className="text-xs">
          Credentials are stored in your OS keychain and never leave this
          device.
        </span>
      </div>

      <SettingRowList>
        <SettingRow
          title="Store passphrases in keychain"
          description="Use system secure storage"
          action={<Switch checked disabled />}
        />
        <SettingRow
          title="Host key policy"
          description="Verification on connect (trust on first use)"
          action={
            <Badge variant="secondary" className="text-chart-4 font-mono">
              TOFU
            </Badge>
          }
        />
      </SettingRowList>
    </SettingsSection>
  );
}

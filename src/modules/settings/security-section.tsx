import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { SettingRow, SettingRowList } from './SettingRow'
import { SettingsSection } from './SettingsSection'

export function SecuritySection() {
  return (
    <SettingsSection title="Security" description="Agent, host keys, and locking policy.">
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-chart-4/25 bg-chart-4/10 px-4 py-3">
        <ShieldCheck className="size-4 shrink-0 text-chart-4" />
        <span className="text-xs">
          Credentials are stored in your OS keychain and never leave this device.
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
            <Badge variant="secondary" className="font-mono text-chart-4">
              TOFU
            </Badge>
          }
        />
      </SettingRowList>
    </SettingsSection>
  )
}

import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import SettingRow, { SettingRowList } from '@/modules/settings/setting-row';
import SettingsSection from '@/modules/settings/settings-section';

const PLACEHOLDER_TOGGLES = [
  'Cursor blink',
  'Copy on select',
  'Shell integration',
];

export default function TerminalSection() {
  return (
    <SettingsSection
      title="Terminal"
      description="Cursor, scrollback, and shell behavior."
    >
      <Badge variant="secondary" className="mb-4">
        More terminal options coming soon
      </Badge>
      <SettingRowList>
        {PLACEHOLDER_TOGGLES.map((label) => (
          <SettingRow
            key={label}
            title={label}
            action={<Switch checked disabled />}
          />
        ))}
      </SettingRowList>
    </SettingsSection>
  );
}

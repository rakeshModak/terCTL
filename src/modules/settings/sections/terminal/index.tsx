import { useAtomValue, useSetAtom } from 'jotai';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import SettingRow, { SettingRowList } from '@/modules/settings/setting-row';
import SettingsSection from '@/modules/settings/settings-section';
import {
  SCROLLBACK_OPTIONS,
  setScrollbackAtom,
  settingsAtom,
} from '@/store/settings';

const PLACEHOLDER_TOGGLES = [
  'Cursor blink',
  'Copy on select',
  'Shell integration',
];

const rowLabel = (rows: number) =>
  rows >= 1000 ? `${rows / 1000}k lines` : `${rows} lines`;

function ScrollbackSelect() {
  const { scrollback } = useAtomValue(settingsAtom);
  const setScrollback = useSetAtom(setScrollbackAtom);
  const options = SCROLLBACK_OPTIONS.map((rows) => ({
    value: String(rows),
    label: rowLabel(rows),
  }));

  return (
    <Select
      items={options}
      value={String(scrollback)}
      onValueChange={(next: string | null) =>
        next && setScrollback(Number(next))
      }
    >
      <SelectTrigger id="terminal-scrollback" className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function TerminalSection() {
  return (
    <SettingsSection
      title="Terminal"
      description="Cursor, scrollback, and shell behavior."
    >
      <SettingRowList>
        <SettingRow
          title="Scrollback"
          description="History kept above the viewport. Applies to open sessions; larger values use more memory per pane."
          action={<ScrollbackSelect />}
        />
      </SettingRowList>

      <Badge variant="secondary" className="mt-4 mb-3">
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

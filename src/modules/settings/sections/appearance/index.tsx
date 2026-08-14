import { useAtomValue, useSetAtom } from 'jotai';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  bumpFontSizeAtom,
  CAN_CHOOSE_TITLE_BAR,
  setAccentAtom,
  setModeAtom,
  setSystemTitleBarAtom,
  setTermSchemeAtom,
  setThemeAtom,
  settingsAtom,
} from '@/store/settings';
import type { ResolvedMode } from '@/lib/theme';
import AccentPicker from '@/modules/settings/sections/appearance/accent-picker';
import FontSizeStepper from '@/modules/settings/sections/appearance/font-size-stepper';
import ModePicker from '@/modules/settings/sections/appearance/mode-picker';
import SettingRow, { SettingRowList } from '@/modules/settings/setting-row';
import SettingsSection, {
  SettingsGroup,
} from '@/modules/settings/settings-section';
import TerminalSchemePicker from '@/modules/settings/sections/terminal/terminal-scheme-picker';
import ThemePicker from '@/modules/settings/sections/appearance/theme-picker';

export default function AppearanceSection({
  resolvedMode,
}: {
  resolvedMode: ResolvedMode;
}) {
  const { fontSize, accent, theme, termScheme, mode, systemTitleBar } =
    useAtomValue(settingsAtom);
  const bumpFontSize = useSetAtom(bumpFontSizeAtom);
  const setAccent = useSetAtom(setAccentAtom);
  const setTheme = useSetAtom(setThemeAtom);
  const setTermScheme = useSetAtom(setTermSchemeAtom);
  const setMode = useSetAtom(setModeAtom);
  const setSystemTitleBar = useSetAtom(setSystemTitleBarAtom);

  return (
    <SettingsSection
      title="Appearance"
      description="Mode, themes, accent, and typography for the workspace."
    >
      <SettingsGroup label="Mode">
        <div className="flex flex-wrap items-center gap-3">
          <ModePicker value={mode} onChange={setMode} />
          {mode === 'system' && (
            <Badge variant="secondary">
              Following your OS — currently {resolvedMode}
            </Badge>
          )}
        </div>
      </SettingsGroup>

      <SettingsGroup label="Theme">
        <ThemePicker value={theme} onChange={setTheme} mode={resolvedMode} />
      </SettingsGroup>

      <SettingsGroup label="Accent color">
        <AccentPicker value={accent} onChange={setAccent} mode={resolvedMode} />
      </SettingsGroup>

      <SettingsGroup label="Terminal text">
        <TerminalSchemePicker value={termScheme} onChange={setTermScheme} />
      </SettingsGroup>

      <SettingRowList>
        <SettingRow
          title="Interface font"
          description="Used for panels and navigation"
          action={
            <Badge variant="secondary" className="font-mono">
              Inter
            </Badge>
          }
        />
        <SettingRow
          title="Terminal font size"
          description="Monospace size for terminals and logs"
          action={<FontSizeStepper value={fontSize} onBump={bumpFontSize} />}
        />
        {CAN_CHOOSE_TITLE_BAR && (
          <SettingRow
            title="Use system title bar"
            description="Let your desktop draw the window frame, so dragging, snapping and double-click to maximise behave like every other app"
            action={
              <Switch
                checked={systemTitleBar}
                onCheckedChange={setSystemTitleBar}
              />
            }
          />
        )}
      </SettingRowList>

      <p className="text-muted-foreground mt-3 text-xs">
        Changes apply instantly to all open terminals and persist across
        restarts.
      </p>
    </SettingsSection>
  );
}

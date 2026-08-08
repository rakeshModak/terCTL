import { useAtomValue, useSetAtom } from 'jotai';
import { Badge } from '@/components/ui/badge';
import {
  bumpFontSizeAtom,
  setAccentAtom,
  setModeAtom,
  setTermSchemeAtom,
  setThemeAtom,
  settingsAtom,
} from '../../store/settings';
import type { ResolvedMode } from '../../lib/theme';
import AccentPicker from './accent-picker';
import FontSizeStepper from './font-size-stepper';
import ModePicker from './mode-picker';
import SettingRow, { SettingRowList } from './setting-row';
import SettingsSection, { SettingsGroup } from './settings-section';
import TerminalSchemePicker from './terminal-scheme-picker';
import ThemePicker from './theme-picker';

/** `mode` is the user's choice; `resolvedMode` is what is actually rendering. */
export default function AppearanceSection({
  resolvedMode,
}: {
  resolvedMode: ResolvedMode;
}) {
  const { fontSize, accent, theme, termScheme, mode } =
    useAtomValue(settingsAtom);
  const bumpFontSize = useSetAtom(bumpFontSizeAtom);
  const setAccent = useSetAtom(setAccentAtom);
  const setTheme = useSetAtom(setThemeAtom);
  const setTermScheme = useSetAtom(setTermSchemeAtom);
  const setMode = useSetAtom(setModeAtom);

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
              Space Grotesk
            </Badge>
          }
        />
        <SettingRow
          title="Terminal font size"
          description="Monospace size for terminals and logs"
          action={<FontSizeStepper value={fontSize} onBump={bumpFontSize} />}
        />
      </SettingRowList>

      <p className="text-muted-foreground mt-3 text-xs">
        Changes apply instantly to all open terminals and persist across
        restarts.
      </p>
    </SettingsSection>
  );
}

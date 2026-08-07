import { useState, useSyncExternalStore } from 'react'
import { useAtomValue } from 'jotai'
import { Palette, ShieldCheck, TerminalSquare } from 'lucide-react'
import { settingsAtom } from '../../store/settings'
import { getSystemMode, watchSystemMode, type ResolvedMode } from '../../lib/theme'
import { AppearanceSection } from './AppearanceSection'
import { SecuritySection } from './SecuritySection'
import { SettingsNav, type SettingsCategory } from './SettingsNav'
import { TerminalSection } from './TerminalSection'
import { UpdateRow } from './UpdateRow'

const CATEGORIES: SettingsCategory[] = [
  { id: 'appearance', name: 'Appearance', Icon: Palette },
  { id: 'terminal', name: 'Terminal', Icon: TerminalSquare },
  { id: 'security', name: 'Security', Icon: ShieldCheck },
]

function useResolvedMode(): ResolvedMode {
  const { mode } = useAtomValue(settingsAtom)
  const systemMode = useSyncExternalStore(watchSystemMode, getSystemMode, () => 'dark' as const)
  return mode === 'system' ? systemMode : mode
}

export function SettingsView() {
  const [category, setCategory] = useState('appearance')
  const resolvedMode = useResolvedMode()

  return (
    <div className="flex min-w-0 flex-1 bg-background">
      <SettingsNav categories={CATEGORIES} value={category} onChange={setCategory} />

      <div className="flex-1 overflow-y-auto px-8 py-7">
        {category === 'appearance' && <AppearanceSection resolvedMode={resolvedMode} />}
        {category === 'terminal' && <TerminalSection />}
        {category === 'security' && <SecuritySection />}
        <UpdateRow />
      </div>
    </div>
  )
}

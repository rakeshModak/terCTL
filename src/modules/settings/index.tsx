import { useState } from 'react'
import { Palette, ShieldCheck, TerminalSquare } from 'lucide-react'
import { useResolvedMode } from '@/hooks/useResolvedMode'
import AppearanceSection from './appearance-section'
import SecuritySection from './security-section'
import SettingsNav, { type SettingsCategory } from './settings-nav'
import TerminalSection from './terminal-section'
import UpdateRow from './update-row'

const CATEGORIES: SettingsCategory[] = [
  { id: 'appearance', name: 'Appearance', Icon: Palette },
  { id: 'terminal', name: 'Terminal', Icon: TerminalSquare },
  { id: 'security', name: 'Security', Icon: ShieldCheck },
]


export default function SettingsView() {
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

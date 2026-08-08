import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface SettingsCategory {
  id: string
  name: string
  Icon: LucideIcon
}

interface SettingsNavProps {
  categories: SettingsCategory[]
  value: string
  onChange: (id: string) => void
}

export default function SettingsNav({ categories, value, onChange }: SettingsNavProps) {
  return (
    <nav className="w-52 shrink-0 border-r border-border bg-sidebar px-3 py-5">
      <h1 className="mx-2 mb-4 font-heading text-base font-bold">Settings</h1>
      <ul className="flex flex-col gap-0.5">
        {categories.map(({ id, name, Icon }) => (
          <li key={id}>
            <Button
              variant={id === value ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => onChange(id)}
              aria-current={id === value ? 'page' : undefined}
            >
              <Icon />
              {name}
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

import type { ReactNode } from 'react'

interface SettingsSectionProps {
  title: string
  description: string
  children: ReactNode
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="max-w-3xl">
      <h2 className="font-heading text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  )
}

interface SettingsGroupProps {
  label: string
  children: ReactNode
}

export function SettingsGroup({ label, children }: SettingsGroupProps) {
  return (
    <div className="mb-7">
      <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </h3>
      {children}
    </div>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import SettingsView from '../modules/settings'

export const Route = createFileRoute('/settings')({
  component: SettingsView,
})

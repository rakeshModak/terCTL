import { createFileRoute } from '@tanstack/react-router'
import { HostsPage } from '../modules/hosts'

export const Route = createFileRoute('/hosts')({
  component: HostsPage,
})

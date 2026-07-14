import { createFileRoute } from '@tanstack/react-router'
import { KeysView } from '../modules/keys'

export const Route = createFileRoute('/keys')({
  component: KeysView,
})

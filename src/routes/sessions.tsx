import { createFileRoute } from '@tanstack/react-router'

// The terminal workspace. Its UI is the persistent SessionsView mounted in the
// root layout (so terminals survive navigation), so this route renders nothing.
export const Route = createFileRoute('/sessions')({
  component: () => null,
})

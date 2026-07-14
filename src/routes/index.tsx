import { createFileRoute, redirect } from '@tanstack/react-router'

// The app opens on Hosts by default — the terminal workspace is empty until you
// connect a host. '/' just redirects there; the terminal lives at '/sessions'.
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/hosts' })
  },
})

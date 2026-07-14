import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { ACCENTS } from '../constants/accents'
import { THEMES } from '../constants/themes'
import { settingsAtom } from '../store/settings'
import { refreshAllAtom } from '../store/app'
import { BootSplash } from '../components/chrome/BootSplash'
import { TitleBar } from '../components/chrome/TitleBar'
import { ActivityRail } from '../components/chrome/ActivityRail'
import { Dialogs } from '../components/Dialogs'
import { SessionsView } from '../modules/sessions'

export const Route = createRootRoute({
  component: RootLayout,
})

// The app shell: boot splash, title bar (Deck tabs), activity rail, the
// persistent terminal workspace, and the active route via <Outlet />.
//
// SessionsView is mounted permanently and merely hidden when off '/', so live
// PTY/SSH terminals survive navigation. The other views render through <Outlet />.
function RootLayout() {
  const { accent, theme } = useAtomValue(settingsAtom)
  const refreshAll = useSetAtom(refreshAllAtom)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const onSessions = pathname === '/sessions'

  // Load hosts/groups/tags once when the shell mounts.
  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  // Apply accent + base theme to the document root (CSS derives everything else).
  useEffect(() => {
    const a = ACCENTS[accent] ?? ACCENTS.Ember
    const root = document.documentElement
    root.style.setProperty('--accent', a.c)
    root.style.setProperty('--accent-2', a.c2)
    root.dataset.theme = THEMES[theme] ?? ''
  }, [accent, theme])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <BootSplash />
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <ActivityRail />
        {/* Persistent terminal workspace — stays mounted; hidden when off '/'. */}
        <div className="min-w-0 flex-1" style={{ display: onSessions ? 'flex' : 'none' }}>
          <SessionsView />
        </div>
        <Outlet />
      </div>
      <Dialogs />
    </div>
  )
}

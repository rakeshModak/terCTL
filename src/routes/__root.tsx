import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { applyTheme } from '../lib/theme'
import { settingsAtom } from '../store/settings'
import { refreshAllAtom } from '../store/app'
import { checkForUpdateAtom } from '../store/updater'
import { loadAppVersionAtom } from '../store/version'
import { BootSplash } from '../components/chrome/BootSplash'
import { TitleBar } from '../components/chrome/TitleBar'
import { ActivityRail } from '../components/chrome/ActivityRail'
import { Dialogs } from '../components/Dialogs'
import { UpdateBanner } from '../components/UpdateBanner'
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
  const checkForUpdate = useSetAtom(checkForUpdateAtom)
  const loadVersion = useSetAtom(loadAppVersionAtom)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const onSessions = pathname === '/sessions'

  // Load hosts/groups/tags once when the shell mounts.
  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  // Quietly check for an app update on launch (surfaces the banner if found).
  useEffect(() => {
    void checkForUpdate()
  }, [checkForUpdate])

  // Read the real app version once, so the UI never shows a hardcoded number.
  useEffect(() => {
    void loadVersion()
  }, [loadVersion])

  // Re-derive the shadcn token set whenever the accent or base theme changes.
  // main.tsx already applied the persisted pair before the first render, so
  // this only does work on an actual change from Settings.
  useEffect(() => {
    applyTheme({ accent, theme })
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
      <UpdateBanner />
    </div>
  )
}

import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { applyTheme, watchSystemMode } from '../lib/theme'
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

function RootLayout() {
  const { accent, theme, mode } = useAtomValue(settingsAtom)
  const refreshAll = useSetAtom(refreshAllAtom)
  const checkForUpdate = useSetAtom(checkForUpdateAtom)
  const loadVersion = useSetAtom(loadAppVersionAtom)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const onSessions = pathname === '/sessions'

  useEffect(() => {
    void refreshAll()
  }, [])

  useEffect(() => {
    void checkForUpdate()
  }, [])

  useEffect(() => {
    void loadVersion()
  }, [])

  useEffect(() => {
    const choice = { accent, theme, mode }
    applyTheme(choice)
    if (mode !== 'system') return
    return watchSystemMode(() => applyTheme(choice))
  }, [accent, theme, mode])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-(--bg) text-(--text)">
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

import {
  createRootRoute,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { applyTheme, watchSystemMode } from '../lib/theme';
import { settingsAtom } from '../store/settings';
import {
  markTunnelClosedAtom,
  refreshAllAtom,
  setHostOsAtom,
} from '../store/app';
import { applyTransferProgressAtom } from '../store/transfer';
import { browserService } from '../services/browser.service';
import { hostsService } from '../services/hosts.service';
import { sftpService } from '../services/sftp.service';
import { checkForUpdateAtom } from '../store/updater';
import { loadAppVersionAtom } from '../store/version';
import { BootSplash } from '../components/chrome/BootSplash';
import { ThemeArt } from '../components/chrome/ThemeArt';
import Header from '../modules/layout/header';
import Sidebar from '../modules/layout/sidebar';
import { Dialogs } from '../components/Dialogs';
import { Toaster } from '../components/ui/sonner';
import { UpdateBanner } from '../components/UpdateBanner';
import SessionsView from '../modules/sessions';
import EditorView from '../modules/editor';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { accent, theme, mode } = useAtomValue(settingsAtom);
  const refreshAll = useSetAtom(refreshAllAtom);
  const checkForUpdate = useSetAtom(checkForUpdateAtom);
  const loadVersion = useSetAtom(loadAppVersionAtom);
  const applyTransferProgress = useSetAtom(applyTransferProgressAtom);
  const setHostOs = useSetAtom(setHostOsAtom);
  const markTunnelClosed = useSetAtom(markTunnelClosedAtom);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Both of these own live SSH shells, so they are mounted for the life of the
  // app and merely hidden when you navigate away. Rendering them through the
  // Outlet would unmount them, and a terminal cannot survive that.
  const onSessions = pathname === '/sessions';
  const onEditor = pathname === '/editor';

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void checkForUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadVersion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unlisten = sftpService.onTransferProgress(applyTransferProgress);
    return () => {
      void unlisten.then((off) => off());
    };
  }, [applyTransferProgress]);

  useEffect(() => {
    const unlisten = hostsService.onOsDetected(({ hostId, os }) =>
      setHostOs(hostId, os),
    );
    return () => {
      void unlisten.then((off) => off());
    };
  }, [setHostOs]);

  useEffect(() => {
    const unlisten = browserService.onTunnelClosed(({ tunnelId }) =>
      markTunnelClosed(tunnelId),
    );
    return () => {
      void unlisten.then((off) => off());
    };
  }, [markTunnelClosed]);

  useEffect(() => {
    const choice = { accent, theme, mode };
    applyTheme(choice);
    if (mode !== 'system') return;
    return watchSystemMode(() => applyTheme(choice));
  }, [accent, theme, mode]);

  return (
    <div className="relative isolate flex h-screen flex-col overflow-hidden bg-(--bg) text-(--text)">
      <ThemeArt slot="page" />
      <BootSplash />
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div
          className="min-w-0 flex-1"
          style={{ display: onSessions ? 'flex' : 'none' }}
        >
          <SessionsView />
        </div>
        <div
          className="min-w-0 flex-1"
          style={{ display: onEditor ? 'flex' : 'none' }}
        >
          <EditorView />
        </div>
        <Outlet />
      </div>
      <Dialogs />
      <Toaster />
      <UpdateBanner />
    </div>
  );
}

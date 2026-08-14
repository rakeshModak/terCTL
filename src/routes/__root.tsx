import {
  createRootRoute,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { applyTheme, watchSystemMode } from '../lib/theme';
import { CAN_CHOOSE_TITLE_BAR, settingsAtom } from '../store/settings';
import { refreshAllAtom, setHostOsAtom } from '../store/app';
import { applyTransferProgressAtom } from '../store/transfer';
import { hostsService } from '../services/hosts.service';
import { sftpService } from '../services/sftp.service';
import { checkForUpdateAtom } from '../store/updater';
import { loadAppVersionAtom } from '../store/version';
import { BootSplash } from '../components/chrome/BootSplash';
import Header from '../modules/layout/header';
import Sidebar from '../modules/layout/sidebar';
import { Dialogs } from '../components/Dialogs';
import { Toaster } from '../components/ui/sonner';
import { UpdateBanner } from '../components/UpdateBanner';
import SessionsView from '../modules/sessions';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { accent, theme, mode, systemTitleBar } = useAtomValue(settingsAtom);
  const refreshAll = useSetAtom(refreshAllAtom);
  const checkForUpdate = useSetAtom(checkForUpdateAtom);
  const loadVersion = useSetAtom(loadAppVersionAtom);
  const applyTransferProgress = useSetAtom(applyTransferProgressAtom);
  const setHostOs = useSetAtom(setHostOsAtom);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onSessions = pathname === '/sessions';

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
    const choice = { accent, theme, mode };
    applyTheme(choice);
    if (mode !== 'system') return;
    return watchSystemMode(() => applyTheme(choice));
  }, [accent, theme, mode]);

  useEffect(() => {
    if (!CAN_CHOOSE_TITLE_BAR) return;
    void getCurrentWindow().setDecorations(systemTitleBar);
  }, [systemTitleBar]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-(--bg) text-(--text)">
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
        <Outlet />
      </div>
      <Dialogs />
      <Toaster />
      <UpdateBanner />
    </div>
  );
}

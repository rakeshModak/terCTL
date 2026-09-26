import { createFileRoute } from '@tanstack/react-router';

// The remote editor. Like the terminal workspace, its UI is mounted
// persistently in the root layout rather than rendered here — unmounting it on
// every navigation would tear down the shell in its terminal panel, along with
// the editor's scroll position and the file tree's expanded folders.
export const Route = createFileRoute('/editor')({
  component: () => null,
});

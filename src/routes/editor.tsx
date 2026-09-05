import { createFileRoute } from '@tanstack/react-router';
import EditorView from '../modules/editor';

export const Route = createFileRoute('/editor')({
  component: EditorView,
});

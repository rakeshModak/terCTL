import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import { terminalFontFamily } from '@/constants/terminal-schemes';
import { ensureContrast, hexToHsl } from '@/lib/color';

import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/dockerfile/dockerfile.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/go/go.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/php/php.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/perl/perl.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/lua/lua.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/scss/scss.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/powershell/powershell.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/bat/bat.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/swift/swift.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/kotlin/kotlin.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/scala/scala.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/dart/dart.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/r/r.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/graphql/graphql.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/hcl/hcl.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/protobuf/protobuf.contribution.js';

monaco.languages.register({ id: 'json', extensions: ['.json'] });
monaco.languages.setMonarchTokensProvider('json', {
  tokenizer: {
    root: [
      [/"(?:[^"\\]|\\.)*"\s*(?=:)/, 'type'],
      [/"(?:[^"\\]|\\.)*"/, 'string'],
      [/\b(?:true|false|null)\b/, 'keyword'],
      [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
      [/[{}[\]]/, 'delimiter.bracket'],
      [/[,:]/, 'delimiter'],
    ],
  },
});
monaco.languages.setLanguageConfiguration('json', {
  brackets: [
    ['{', '}'],
    ['[', ']'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '"', close: '"' },
  ],
});

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker: (workerId: string, label: string) => Worker;
    };
  }
}

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

export const TERCTL_MONACO_THEME = 'terctl';

// WCAG AA for body text. Syntax colours come from the theme's own palette,
// but a hue that reads fine as a chart tint can fall under the floor as text,
// so each one is lifted through the same helper the ink ramp uses.
const SYNTAX_CONTRAST = 4.5;

function rules(t: Record<string, string>): monaco.editor.ITokenThemeRule[] {
  const bg = t['--background'] ?? '#ffffff';
  const legible = (token: string, fallback: string) =>
    ensureContrast(hexToHsl(t[token] ?? fallback), bg, SYNTAX_CONTRAST).replace(
      '#',
      '',
    );

  const text = legible('--foreground', '#333333');
  const muted = legible('--muted-foreground', '#6b7280');
  const dim = legible('--text-dim', '#666666');
  const brand = legible('--primary', '#3b6fd4');
  const green = legible('--green', '#0a7f57');
  const amber = legible('--amber', '#8a5a06');
  const blue = legible('--blue', '#1d5fd6');
  const purple = legible('--purple', '#6d28d9');
  const purple2 = legible('--purple-2', '#5b21b6');
  const red = legible('--red', '#c92a2a');

  return [
    { token: 'comment', foreground: muted, fontStyle: 'italic' },
    { token: 'string', foreground: green },
    { token: 'number', foreground: amber },
    { token: 'regexp', foreground: red },
    { token: 'keyword', foreground: brand },
    { token: 'operator', foreground: purple2 },
    { token: 'delimiter', foreground: dim },
    { token: 'type', foreground: blue },
    { token: 'identifier', foreground: text },
    { token: 'function', foreground: purple },
    { token: 'variable', foreground: text },
    { token: 'tag', foreground: brand },
    { token: 'attribute.name', foreground: blue },
    { token: 'attribute.value', foreground: green },
    { token: 'metatag', foreground: purple },
    { token: 'annotation', foreground: amber },
    { token: 'invalid', foreground: red },
  ];
}

export function applyMonacoTheme(t: Record<string, string>, dark: boolean) {
  const bg = t['--background'] ?? '#ffffff';
  const fg = t['--foreground'] ?? '#333333';
  const brand = t['--primary'] ?? '#3b6fd4';
  const overlay = (darkAlpha: string, lightAlpha: string) =>
    dark ? `#ffffff${darkAlpha}` : `#000000${lightAlpha}`;

  monaco.editor.defineTheme(TERCTL_MONACO_THEME, {
    base: dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: rules(t),
    colors: {
      'editor.background': bg,
      'editor.foreground': fg,
      'editorCursor.foreground': brand,
      // Token strokes are rgba(), which Monaco cannot parse, so seams and
      // washes use hex overlays keyed off the resolved mode instead.
      'editor.selectionBackground': `${brand}38`,
      'editor.inactiveSelectionBackground': `${brand}1f`,
      'editor.lineHighlightBackground': overlay('0a', '08'),
      'editor.findMatchBackground': `${brand}55`,
      'editor.findMatchHighlightBackground': `${brand}2a`,
      'editorLineNumber.foreground': t['--text-faintest'] ?? '#7f7f7f',
      'editorLineNumber.activeForeground': t['--text-dim'] ?? fg,
      'editorIndentGuide.background1': overlay('14', '12'),
      'editorIndentGuide.activeBackground1': overlay('2a', '24'),
      'editorWhitespace.foreground': overlay('1a', '18'),
      'editorGutter.background': bg,
      'editorWidget.background': t['--popover'] ?? bg,
      'editorWidget.foreground': fg,
      'editorWidget.border': overlay('1f', '1f'),
      'editorSuggestWidget.background': t['--popover'] ?? bg,
      'editorSuggestWidget.selectedBackground': `${brand}2a`,
      'input.background': t['--card'] ?? bg,
      'input.foreground': fg,
      'input.border': overlay('1f', '1f'),
      focusBorder: brand,
      'scrollbarSlider.background': overlay('1a', '18'),
      'scrollbarSlider.hoverBackground': overlay('2a', '28'),
      'scrollbarSlider.activeBackground': overlay('3a', '38'),
      'minimap.background': bg,
      'editorBracketMatch.background': `${brand}2a`,
      'editorBracketMatch.border': brand,
    },
  });
  monaco.editor.setTheme(TERCTL_MONACO_THEME);
}

export const editorFontFamily = terminalFontFamily;
export { monaco };

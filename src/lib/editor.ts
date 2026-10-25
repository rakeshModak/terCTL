import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';
import { terminalFontFamily } from '@/constants/terminal-schemes';
import { ensureContrast, hexToHsl } from '@/lib/color';

/**
 * CodeMirror wiring: the editor's look, derived from the app's own theme
 * tokens, and a grammar registry that fetches languages on demand.
 *
 * Every grammar is behind a dynamic import. That is the whole reason the
 * editor is cheap to open: the base editor is a few hundred kilobytes, and a
 * Rust file costs the Rust grammar and nothing else.
 */

export const editorFontFamily = terminalFontFamily;

// WCAG AA for body text. Syntax colours come from the theme's own palette,
// but a hue that reads fine as a chart tint can fall under the floor as text,
// so each one is lifted through the same helper the ink ramp uses.
const SYNTAX_CONTRAST = 4.5;

function palette(tokens: Record<string, string>) {
  const bg = tokens['--background'] ?? '#ffffff';
  const legible = (token: string, fallback: string) =>
    ensureContrast(hexToHsl(tokens[token] ?? fallback), bg, SYNTAX_CONTRAST);

  return {
    bg,
    text: legible('--foreground', '#333333'),
    muted: legible('--muted-foreground', '#6b7280'),
    dim: legible('--text-dim', '#666666'),
    brand: legible('--primary', '#3b6fd4'),
    green: legible('--green', '#0a7f57'),
    amber: legible('--amber', '#8a5a06'),
    blue: legible('--blue', '#1d5fd6'),
    purple: legible('--purple', '#6d28d9'),
    purple2: legible('--purple-2', '#5b21b6'),
    red: legible('--red', '#c92a2a'),
  };
}

function highlighting(tokens: Record<string, string>): Extension {
  const c = palette(tokens);

  // Lezer describes code with composable tags rather than the flat token
  // names a regex highlighter emits, so related tags share one colour here
  // instead of each grammar having to agree on a spelling.
  return syntaxHighlighting(
    HighlightStyle.define([
      {
        tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
        color: c.muted,
        fontStyle: 'italic',
      },
      {
        tag: [t.string, t.special(t.string), t.docString, t.attributeValue],
        color: c.green,
      },
      { tag: t.escape, color: c.purple2 },
      {
        tag: [t.number, t.integer, t.float, t.bool, t.null, t.atom],
        color: c.amber,
      },
      { tag: t.regexp, color: c.red },
      // Every grammar spells its keywords differently — `def` is a
      // definitionKeyword, `import` a moduleKeyword, `if` a controlKeyword.
      // Naming only the bare `keyword` tag leaves most of them uncoloured,
      // which is exactly how highlighting comes to look switched off.
      {
        tag: [
          t.keyword,
          t.controlKeyword,
          t.moduleKeyword,
          t.operatorKeyword,
          t.definitionKeyword,
          t.modifier,
          t.self,
        ],
        color: c.brand,
      },
      {
        tag: [
          t.operator,
          t.derefOperator,
          t.compareOperator,
          t.logicOperator,
          t.arithmeticOperator,
        ],
        color: c.purple2,
      },
      {
        tag: [
          t.punctuation,
          t.separator,
          t.bracket,
          t.paren,
          t.brace,
          t.squareBracket,
        ],
        color: c.dim,
      },
      {
        tag: [t.typeName, t.className, t.namespace, t.typeOperator],
        color: c.blue,
      },
      { tag: t.standard(t.variableName), color: c.blue },
      {
        tag: [t.variableName, t.propertyName, t.definition(t.variableName)],
        color: c.text,
      },
      {
        tag: [
          t.function(t.variableName),
          t.function(t.propertyName),
          t.definition(t.function(t.variableName)),
          t.labelName,
        ],
        color: c.purple,
      },
      { tag: [t.tagName, t.angleBracket], color: c.brand },
      { tag: t.attributeName, color: c.blue },
      {
        tag: [t.meta, t.documentMeta, t.processingInstruction],
        color: c.purple,
      },
      { tag: t.annotation, color: c.amber },
      { tag: t.invalid, color: c.red },
      // Markdown earns a little structure of its own.
      { tag: t.heading, color: c.brand, fontWeight: 'bold' },
      { tag: [t.link, t.url], color: c.blue, textDecoration: 'underline' },
      { tag: t.emphasis, fontStyle: 'italic' },
      { tag: t.strong, fontWeight: 'bold' },
      { tag: t.strikethrough, textDecoration: 'line-through' },
    ]),
  );
}

/**
 * The editor's chrome. `fontSize` is baked in rather than set as an option
 * because CodeMirror styles the text through CSS, and the gutter has to track
 * the same line height or the numbers drift out of step with the code.
 */
export function editorTheme(
  tokens: Record<string, string>,
  dark: boolean,
  fontSize: number,
): Extension {
  const c = palette(tokens);
  const lineHeight = Math.round(fontSize * 1.55);
  // Token strokes are rgba(), which is awkward to compose against an unknown
  // backdrop, so washes are hex overlays keyed off the resolved mode instead.
  const overlay = (darkAlpha: string, lightAlpha: string) =>
    dark ? `#ffffff${darkAlpha}` : `#000000${lightAlpha}`;

  return [
    EditorView.theme(
      {
        '&': {
          backgroundColor: c.bg,
          color: c.text,
          height: '100%',
        },
        '.cm-scroller': {
          fontFamily: editorFontFamily,
          fontSize: `${fontSize}px`,
          lineHeight: `${lineHeight}px`,
          fontVariantLigatures: 'contextual',
        },
        '.cm-content': {
          caretColor: c.brand,
          paddingTop: '10px',
          paddingBottom: '10px',
        },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: c.brand },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
          { backgroundColor: `${c.brand}38` },
        '.cm-activeLine': { backgroundColor: overlay('0a', '08') },
        '.cm-gutters': {
          backgroundColor: c.bg,
          color: tokens['--text-faintest'] ?? c.dim,
          border: 'none',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'transparent',
          color: tokens['--text-dim'] ?? c.text,
        },
        '.cm-selectionMatch': { backgroundColor: `${c.brand}2a` },
        '.cm-searchMatch': { backgroundColor: `${c.brand}2a` },
        '.cm-searchMatch.cm-searchMatch-selected': {
          backgroundColor: `${c.brand}55`,
        },
        '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
          backgroundColor: `${c.brand}2a`,
          outline: `1px solid ${c.brand}`,
        },
        '.cm-nonmatchingBracket': { color: c.red },
        '.cm-panels': {
          backgroundColor: tokens['--popover'] ?? c.bg,
          color: c.text,
        },
        '.cm-panels input, .cm-panels button': {
          backgroundColor: tokens['--card'] ?? c.bg,
          color: c.text,
          border: `1px solid ${overlay('1f', '1f')}`,
          borderRadius: '4px',
        },
        '.cm-tooltip': {
          backgroundColor: tokens['--popover'] ?? c.bg,
          color: c.text,
          border: `1px solid ${overlay('1f', '1f')}`,
        },
      },
      { dark },
    ),
    highlighting(tokens),
  ];
}

/**
 * Fetch the grammar for a language id from @/lib/language.
 *
 * Each arm is its own dynamic import, so the bundler gives every grammar a
 * chunk of its own and only the ones actually opened are ever downloaded.
 * `null` means "no grammar" — plain text, which needs none.
 */
export async function loadLanguage(id: string): Promise<Extension | null> {
  switch (id) {
    case 'javascript':
      return (await import('@codemirror/lang-javascript')).javascript();
    case 'jsx':
      return (await import('@codemirror/lang-javascript')).javascript({
        jsx: true,
      });
    case 'typescript':
      return (await import('@codemirror/lang-javascript')).javascript({
        typescript: true,
      });
    case 'tsx':
      return (await import('@codemirror/lang-javascript')).javascript({
        jsx: true,
        typescript: true,
      });
    case 'python':
      return (await import('@codemirror/lang-python')).python();
    case 'html':
      return (await import('@codemirror/lang-html')).html();
    case 'css':
      return (await import('@codemirror/lang-css')).css();
    case 'scss':
      return (await import('@codemirror/lang-sass')).sass({ indented: false });
    case 'json':
      return (await import('@codemirror/lang-json')).json();
    case 'markdown':
      return (await import('@codemirror/lang-markdown')).markdown();
    case 'xml':
      return (await import('@codemirror/lang-xml')).xml();
    case 'sql':
      return (await import('@codemirror/lang-sql')).sql();
    case 'rust':
      return (await import('@codemirror/lang-rust')).rust();
    case 'c':
    case 'cpp':
      return (await import('@codemirror/lang-cpp')).cpp();
    case 'java':
      return (await import('@codemirror/lang-java')).java();
    case 'php':
      return (await import('@codemirror/lang-php')).php();
    case 'go':
      return (await import('@codemirror/lang-go')).go();
    case 'yaml':
      return (await import('@codemirror/lang-yaml')).yaml();

    // Languages CodeMirror 6 has no dedicated grammar for still have a
    // stream-based mode, which highlights well enough to read by.
    //
    // Every specifier below is spelled out in full on purpose. A bundler can
    // only split a dynamic import it can read, and a path built from a
    // variable is opaque to it — Vite warns and the import fails at runtime.
    case 'shell':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/shell')).shell,
      );
    case 'powershell':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/powershell')).powerShell,
      );
    case 'ini':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/properties')).properties,
      );
    case 'toml':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/toml')).toml,
      );
    case 'protobuf':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/protobuf')).protobuf,
      );
    case 'dockerfile':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/dockerfile')).dockerFile,
      );
    case 'lua':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/lua')).lua,
      );
    case 'perl':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/perl')).perl,
      );
    case 'ruby':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/ruby')).ruby,
      );
    case 'swift':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/swift')).swift,
      );
    case 'r':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/r')).r,
      );
    case 'csharp':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/clike')).csharp,
      );
    case 'kotlin':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/clike')).kotlin,
      );
    case 'scala':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/clike')).scala,
      );
    case 'dart':
      return StreamLanguage.define(
        (await import('@codemirror/legacy-modes/mode/clike')).dart,
      );

    default:
      return null;
  }
}

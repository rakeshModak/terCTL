import { extensionOf } from '@/lib/path';

/**
 * Which language a file is written in, by name alone.
 *
 * This is deliberately a plain table with no editor dependency: the toolbar
 * needs the answer to render a label, and reaching into the editor's grammar
 * registry for it would pull the whole editor into any screen that shows one.
 * The ids here are the keys `loadLanguage` in @/lib/editor resolves to actual
 * grammars, which are fetched only when a file is opened.
 */

/** Files whose whole name decides it — they usually have no extension. */
const BY_NAME: Record<string, string> = {
  dockerfile: 'dockerfile',
  containerfile: 'dockerfile',
  makefile: 'shell',
  gnumakefile: 'shell',
  '.bashrc': 'shell',
  '.bash_profile': 'shell',
  '.bash_aliases': 'shell',
  '.zshrc': 'shell',
  '.zprofile': 'shell',
  '.profile': 'shell',
  '.gitconfig': 'ini',
  '.gitignore': 'shell',
  '.npmrc': 'ini',
  '.env': 'shell',
  crontab: 'shell',
  authorized_keys: 'shell',
  known_hosts: 'shell',
  sshd_config: 'ini',
  ssh_config: 'ini',
  hosts: 'ini',
  fstab: 'ini',
  'cargo.lock': 'toml',
  'go.mod': 'plaintext',
  'go.sum': 'plaintext',
};

/**
 * Extension to language. Exhaustive by necessity — there is no grammar
 * registry to fall back on any more, which is the point: nothing here costs
 * anything to load.
 */
const BY_EXTENSION: Record<string, string> = {
  // shells and config
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  ksh: 'shell',
  env: 'shell',
  ps1: 'powershell',
  psm1: 'powershell',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  service: 'ini',
  properties: 'ini',
  toml: 'toml',
  // data and markup
  json: 'json',
  jsonc: 'json',
  lock: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  svg: 'xml',
  plist: 'xml',
  xsd: 'xml',
  html: 'html',
  htm: 'html',
  vue: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  md: 'markdown',
  markdown: 'markdown',
  proto: 'protobuf',
  sql: 'sql',
  // programming languages
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  pyw: 'python',
  pyi: 'python',
  rs: 'rust',
  go: 'go',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  java: 'java',
  cs: 'csharp',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  sc: 'scala',
  dart: 'dart',
  swift: 'swift',
  php: 'php',
  rb: 'ruby',
  rake: 'ruby',
  gemfile: 'ruby',
  pl: 'perl',
  pm: 'perl',
  lua: 'lua',
  r: 'r',
  // plain text
  txt: 'plaintext',
  log: 'plaintext',
  csv: 'plaintext',
};

export function languageForFile(name: string): string {
  const lower = name.toLowerCase();

  const byName = BY_NAME[lower];
  if (byName) return byName;

  const ext = extensionOf(lower);
  if (!ext) return 'plaintext';

  return BY_EXTENSION[ext] ?? 'plaintext';
}

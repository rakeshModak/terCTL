const BY_LANGUAGE: Record<string, string> = {
  typescript: 'typescript',
  javascript: 'typescript',
  python: 'python',
  c: 'clangd',
  cpp: 'clangd',
  'objective-c': 'clangd',
  java: 'java',
  go: 'go',
  rust: 'rust',
  shell: 'bash',
  yaml: 'yaml',
};

export function serverForLanguage(language: string | null): string | null {
  return language ? (BY_LANGUAGE[language] ?? null) : null;
}

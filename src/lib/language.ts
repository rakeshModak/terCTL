import { extensionOf } from '@/lib/path';
import { monaco } from '@/lib/monaco';

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
};

const BY_EXTENSION: Record<string, string> = {
  toml: 'ini',
  cfg: 'ini',
  conf: 'ini',
  service: 'ini',
  env: 'shell',
  zsh: 'shell',
  fish: 'shell',
  mjs: 'javascript',
  cjs: 'javascript',
  jsonc: 'json',
  lock: 'json',
  htm: 'html',
  txt: 'plaintext',
  log: 'plaintext',
};

export function languageForFile(name: string): string {
  const lower = name.toLowerCase();

  const byName = BY_NAME[lower];
  if (byName) return byName;

  const ext = extensionOf(lower);
  if (!ext) return 'plaintext';

  const pinned = BY_EXTENSION[ext];
  if (pinned) return pinned;

  const dotted = `.${ext}`;
  for (const lang of monaco.languages.getLanguages()) {
    if (lang.extensions?.some((e) => e.toLowerCase() === dotted))
      return lang.id;
  }
  return 'plaintext';
}

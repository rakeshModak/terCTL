import type { IconType } from 'react-icons';
import { FaWindows } from 'react-icons/fa';
import {
  SiAlmalinux,
  SiAlpinelinux,
  SiApple,
  SiArchlinux,
  SiCentos,
  SiDebian,
  SiFedora,
  SiFreebsd,
  SiKalilinux,
  SiLinux,
  SiOpensuse,
  SiRaspberrypi,
  SiRedhat,
  SiRockylinux,
  SiUbuntu,
} from 'react-icons/si';

interface OsInfo {
  Icon: IconType;
  label: string;
}

const OS: Record<string, OsInfo> = {
  ubuntu: { Icon: SiUbuntu, label: 'Ubuntu' },
  debian: { Icon: SiDebian, label: 'Debian' },
  raspbian: { Icon: SiRaspberrypi, label: 'Raspberry Pi OS' },
  fedora: { Icon: SiFedora, label: 'Fedora' },
  centos: { Icon: SiCentos, label: 'CentOS' },
  rhel: { Icon: SiRedhat, label: 'Red Hat Enterprise Linux' },
  rocky: { Icon: SiRockylinux, label: 'Rocky Linux' },
  almalinux: { Icon: SiAlmalinux, label: 'AlmaLinux' },
  arch: { Icon: SiArchlinux, label: 'Arch Linux' },
  alpine: { Icon: SiAlpinelinux, label: 'Alpine Linux' },
  kali: { Icon: SiKalilinux, label: 'Kali Linux' },
  suse: { Icon: SiOpensuse, label: 'openSUSE' },
  linux: { Icon: SiLinux, label: 'Linux' },
  macos: { Icon: SiApple, label: 'macOS' },
  windows: { Icon: FaWindows, label: 'Windows' },
  freebsd: { Icon: SiFreebsd, label: 'FreeBSD' },
  openbsd: { Icon: SiFreebsd, label: 'OpenBSD' },
  netbsd: { Icon: SiFreebsd, label: 'NetBSD' },
  solaris: { Icon: SiLinux, label: 'Solaris' },
};

export function osInfo(os: string | null): OsInfo | null {
  return os ? (OS[os] ?? null) : null;
}

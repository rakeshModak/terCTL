export interface ServerStatusType {
  id: string;
  label: string;
  bin: string;
  installCommand: string;
  uninstallCommand: string;
  approxMb: number;
  installed: boolean;
  canInstall: boolean;
  missing: string[];
}

export interface HostServersType {
  freeKb: number;
  servers: ServerStatusType[];
}

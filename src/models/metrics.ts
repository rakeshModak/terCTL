export interface ProcInfo {
  name: string
  cpu: number
  mem: number
}

export interface Metrics {
  cpu: number
  cores: number
  load: string
  memUsedKb: number
  memTotalKb: number
  diskUsedKb: number
  diskTotalKb: number
  netRx: number
  netTx: number
  uptimeSec: number
  procs: ProcInfo[]
}

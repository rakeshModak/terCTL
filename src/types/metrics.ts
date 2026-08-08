export interface ProcInfoType {
  name: string
  cpu: number
  mem: number
}

export interface MetricsType {
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
  procs: ProcInfoType[]
}

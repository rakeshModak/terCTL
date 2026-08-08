export interface FileEntryType {
  name: string
  path: string
  isDir: boolean
  isLink: boolean
  size: number
  modified: number | null
}

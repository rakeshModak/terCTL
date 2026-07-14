export interface FileEntry {
  name: string
  path: string
  isDir: boolean
  isLink: boolean
  size: number
  modified: number | null
}

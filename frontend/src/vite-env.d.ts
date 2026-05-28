import type { ElectronAPI } from '../electron/shared/electron-api'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

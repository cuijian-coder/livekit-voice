import { contextBridge } from 'electron'

const config = {
  backend: {
    wsUrl: 'ws://localhost:3000/ws',
    apiUrl: 'http://localhost:3000',
  }
}

export function exposeConfigApi() {

  contextBridge.exposeInMainWorld(
    'electronAPI',
    {
      config,
      platform: process.platform,
    }
  )
}
import { app } from 'electron'
import { createMainWindow } from './window'
import { registerPermissionHandlers } from './permissions'

app.whenReady().then(() => {
  registerPermissionHandlers()
  createMainWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

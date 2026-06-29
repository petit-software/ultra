import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // main-process modules import 'electron'; stub it for Node tests
      electron: resolve(__dirname, 'test/electron-stub.ts'),
      '@': resolve(__dirname, 'src/renderer')
    }
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts']
  }
})

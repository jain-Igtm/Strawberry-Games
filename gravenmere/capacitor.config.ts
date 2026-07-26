import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.jainigtm.gravenmere',
  appName: 'World Explorer',
  webDir: 'dist',
  android: {
    backgroundColor: '#080a0a',
    allowMixedContent: false,
  },
}

export default config

import 'three'

declare module 'three' {
  interface BufferGeometry {
    parameters: {
      height: number
      [key: string]: unknown
    }
  }
}

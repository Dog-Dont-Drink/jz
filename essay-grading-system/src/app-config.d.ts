export {}

declare global {
  interface Window {
    __APP_CONFIG__?: {
      VERIFICATION_API_BASE_URL?: string
    }
  }
}


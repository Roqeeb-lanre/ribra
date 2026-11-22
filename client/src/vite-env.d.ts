/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OAuth client ID from Google Cloud. Leave empty to hide "Continue with Google". */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The parts of Google Identity Services (accounts.google.com/gsi/client) that Ribra uses. */
interface Window {
  google?: {
    accounts: {
      id: {
        initialize(options: {
          client_id: string;
          callback: (response: { credential: string }) => void;
          ux_mode?: 'popup' | 'redirect';
        }): void;
        renderButton(element: HTMLElement, options: Record<string, unknown>): void;
      };
    };
  };
}

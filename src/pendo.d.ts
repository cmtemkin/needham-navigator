interface PendoVisitor {
  id: string;
  [key: string]: unknown;
}

interface PendoAccount {
  id: string;
  name?: string;
  [key: string]: unknown;
}

interface PendoInitOptions {
  visitor: PendoVisitor;
  account: PendoAccount;
}

interface Pendo {
  initialize: (options: PendoInitOptions) => void;
  track: (eventName: string, metadata?: Record<string, unknown>) => void;
  isReady: () => boolean;
}

declare global {
  interface Window {
    pendo?: Pendo;
  }
}

export {};

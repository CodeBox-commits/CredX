declare module "tesseract.js" {
  export function createWorker(options?: {
    logger?: (message: unknown) => void;
  }): Promise<{
    load: () => Promise<void>;
    loadLanguage: (language: string) => Promise<void>;
    initialize: (language: string) => Promise<void>;
    recognize: (file: File) => Promise<{ data: { text: string } }>;
    terminate: () => Promise<void>;
  }>;
}

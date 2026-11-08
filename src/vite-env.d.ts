/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Default backend URL baked into the build (e.g. https://applypilot-api.onrender.com). */
  readonly VITE_API_URL?: string;
}

declare module 'mammoth/mammoth.browser' {
  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: unknown[] }>;
  };
  export default mammoth;
}

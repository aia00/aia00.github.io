/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
    readonly PUBLIC_ANALYTICS_ENDPOINT?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

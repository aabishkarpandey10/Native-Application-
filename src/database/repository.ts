/**
 * TypeScript module entry. Metro resolves `repository.native.ts` (iOS/Android)
 * or `repository.web.ts` (web) at bundle time — this file is the TS fallback.
 */
export * from "./repository.web";

/**
 * Sub-path the app is served under ("" at the domain root).
 * next/link, the router and next/form add it automatically; plain `fetch`
 * calls and raw URLs must add it themselves.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

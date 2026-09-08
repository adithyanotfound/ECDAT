/**
 * Barrel export for all server-side data-access functions.
 * UI layers import from here — never import prisma directly in components.
 */
export * from "./dashboard";
export * from "./scanning";
export * from "./assets";

// Utility to override fetch().json() return type to 'any' for the API project
// to avoid massive 'unknown' type errors during build.

export {};

declare global {
  interface Body {
    json(): Promise<any>;
  }
}

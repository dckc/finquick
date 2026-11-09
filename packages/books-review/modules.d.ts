/**
 * @file The modules a bundle's non-JavaScript files are, as the toybox
 * loads them: data.
 */

declare module '*.html' {
  const bytes: ArrayBuffer;
  export default bytes;
}
declare module '*.css' {
  const bytes: ArrayBuffer;
  export default bytes;
}

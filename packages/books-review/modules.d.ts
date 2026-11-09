/**
 * @file The modules a bundle's non-JavaScript files are, as the toybox
 * loads them: a `.txt` file is text; others, data.
 */

declare module '*.txt' {
  const text: string;
  export default text;
}
declare module '*.html' {
  const bytes: ArrayBuffer;
  export default bytes;
}
declare module '*.css' {
  const bytes: ArrayBuffer;
  export default bytes;
}
declare module '*.svg' {
  const bytes: ArrayBuffer;
  export default bytes;
}
declare module '*.webmanifest' {
  const bytes: ArrayBuffer;
  export default bytes;
}

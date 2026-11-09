/**
 * @file The pages and their files, by the paths the app socket serves them
 * at. See {@link FILES}.
 */
import booksPage from './site/books.html';
import style from './site/style.css';
import { ok } from './http.js';

// a bundle's files other than .js and .txt are data modules, bytes
const utf8 = new TextDecoder();
/** @param {ArrayBuffer} bytes */
const html = bytes => ok('text/html; charset=utf-8', utf8.decode(bytes));

/** The site, by path. */
export const FILES = harden({
  '/': html(booksPage),
  '/style.css': ok('text/css; charset=utf-8', utf8.decode(style)),
});

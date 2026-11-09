/**
 * @file The pages and their files, by the paths the app socket serves them
 * at. See {@link FILES}.
 */
import booksPage from './site/books.html';
import booksScript from './site/books.js.txt';
import prelude from './site/prelude.js.txt';
import reviewPage from './site/review.html';
import reviewScript from './site/review.js.txt';
import style from './site/style.css';
import timelineScript from './site/timeline/app.js.txt';
import timelineIcon from './site/timeline/icon.svg';
import timelinePage from './site/timeline/index.html';
import timelineManifest from './site/timeline/manifest.webmanifest';
import timelineWorker from './site/timeline/sw.js.txt';
import { ok, redirect } from './http.js';

// A bundle's .js files are the vat's own modules, so the browser's scripts
// are .js.txt, text modules; other files are data modules, bytes.
const utf8 = new TextDecoder();
/** @param {ArrayBuffer} bytes */
const html = bytes => ok('text/html; charset=utf-8', utf8.decode(bytes));
/** @param {string} text */
const js = text => ok('text/javascript; charset=utf-8', text);

/**
 * The site, by path. A page keeps its webkey in localStorage: a link's
 * fragment (the boot page's `#<key>`, or a review page's) is read once and
 * taken out of the address bar. The timeline page, under `/timeline/`, is
 * an app to install on a phone, so it has a manifest, an icon, and a
 * service worker scoped to it.
 */
export const FILES = harden({
  '/': html(booksPage),
  '/boot.js': js(booksScript),
  '/review': html(reviewPage),
  '/review.js': js(reviewScript),
  '/prelude.js': js(prelude),
  '/style.css': ok('text/css; charset=utf-8', utf8.decode(style)),
  '/timeline': redirect('/timeline/'),
  '/timeline/': html(timelinePage),
  '/timeline/app.js': js(timelineScript),
  '/timeline/sw.js': js(timelineWorker),
  '/timeline/manifest.webmanifest': ok(
    'application/manifest+json',
    utf8.decode(timelineManifest),
  ),
  '/timeline/icon.svg': ok('image/svg+xml', utf8.decode(timelineIcon)),
});

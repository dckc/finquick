# Dev notes

 - ES6, flow: const, modules, arrow functions, template strings
   - eslint for server side
     - no destructuring let/const yet. hm.
   - jspm for UI side
 - Q promises
 - ocap style: all authority passed in explicitly
 - docopt for arg parsing dervied from usage doc
 - gnucash db using mysql
   - follow locking protocol
 - freedesktop secret store (gnome keyring)
 - npm banking for OFX from credit cards
   - use capper persistent state for caching
 - [nightmare][] for headless browsing
   - generator functions, yield, Q.async()
 - [CSS Bootstrap][bs] and [Bacon.js][frp] for UI
   - table style
   - error dialogs, busy indicators
   - Functional Reactive Programming
 - android access: self-signed cert, CA
 - account balance UI reacts to DB changes using websockets, mysql-events
 
 
[bs]: http://getbootstrap.com/css/
[frp]: https://baconjs.github.io/
[nightmare]: http://www.nightmarejs.org/

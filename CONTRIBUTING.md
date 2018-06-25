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

## Service Definition: systemd user unit

`fincap.service` shows how I manage the service. An initial attempt
failed:

    vowAnsToVowJSONString err  Error: non-zero exit from secret-tool
         at ChildProcess.tool.on (.../finquick/ofxies/server/secret-tool.js:31:35)

ISSUE: UI shows empty diagnostic when secret-tool fails. Working theory is to
       use `dbus-native` rather than forking `secret-tool`.

This led me to enumerate the capabilities that this service needs and
think about how to represent them as systemd units.

### Ubuntu xdg user sessions

I also learned about `/etc/xdg/autostart` how Ubuntu's Xsession uses
upstart rather than systemd for user sessions. `pstree` shows nautilus
(from autostart) under gnome-session, but gpgagent (from
`/etc/X11/Xsession.d/90gpg-agent`) under upstart:

```
systemd-+-ModemManager-+-{gdbus}

        |-gnome-keyring-d-+-{gdbus}
        |                 |-{gmain}
        |                 |-3*[{ssh-agent}]
        |                 `-{timer}

        |-lightdm-+-Xorg---{InputThread}
        |         |-lightdm-+-upstart-+-at-spi-bus-laun-+-dbus-daemon
        |         |         |         |-dbus-daemon

        |         |         |         |-emacs-+
        |         |         |         |       |-{dconf worker}
        |         |         |         |       |-{gdbus}

        |         |         |         |-gnome-screensav-+-{dconf worker}
        |         |         |         |                 |-{gdbus}
        |         |         |         |                 `-{gmain}

        |         |         |         |-gnome-session-b-+-compiz-+-sh---gtk-window-deco-+-{dconf worker}
        |         |         |         |                 |-initctl
        |         |         |         |                 |-nautilus-+-{dconf worker}

        |         |         |         |-gnucash-+-{dconf worker}

        |         |         |         |-gpg-agent
        |         |         |         |-gstm-+-2*[ssh]

        |         |         |         |-indicator-datet-+-{dconf worker}
        |         |         |         |-thg-+-2*[hg]
```

## Bitbucket and Github

Version control was originally in mercurial as https://bitbucket.org/DanC/finquick:

 - 2012-04-14 6b553b57f7af toward web app access to gnucash db: pyramid alchemy scaffold

Using [hg-git](http://hg-git.github.io/), I keep a mirror at
https://github.com/dckc/finquick :

 - 2012-04-14 a1b1e4121990 toward web app access to gnucash db: pyramid alchemy scaffold

Issues are on bitbucket, so far.

grumble: github won't let me use an http URL to identify myself.  Why
force me to use an email address, where the only way people can learn
about me is to send me email, rather than letting them browse?

We're not alone in wanting an answer for [Logging lock-screen
events][832111]. In Apr 2015, Hashbrown gave a solution using
`dbus-monitor` in a shell script.

[832111]: https://superuser.com/questions/662974/logging-lock-screen-events/832111

But subprocesses are tricky to confine. The [node-dbus][] package does
just what we want: take a socket and provide the DBus protocol on
top. The hello-world examples use ambient authority, but with a little
UTSL, it's straightforward to see what authority it's appealing to and
pass it in explicitly.

    function createStream(opts) {
      if (opts.stream)
        return opts.stream;

    ...

    var busAddress = opts.busAddress || process.env.DBUS_SESSION_BUS_ADDRESS;

    ...

        case 'unix':
          if (params.abstract) {
            var abs = require('abstract-socket');
            return abs.connect('\u0000' + params.abstract);


The [abstract-socket][] package is a straightforward FFI call to make
an abstract [AF_UNIX][] socket:

> Linux also supports an abstract namespace which is independent of
> the filesystem. ... an abstract socket address is distinguished by
> the fact that `sun_path[0]` is a null byte (`'\0'`). ...  Socket
> permissions have no meaning for abstract sockets

[AF_UNIX]: http://man7.org/linux/man-pages/man7/unix.7.html
[node-dbus]: https://github.com/sidorares/node-dbus
[abstract-socket]: https://github.com/saghul/node-abstractsocket

For reference:

    $ ps ax | grep screens
    ... /usr/bin/gnome-screensaver --no-daemon
    $ dpkg -S /usr/bin/gnome-screensaver
    gnome-screensaver: /usr/bin/gnome-screensaver

    $ apt-cache show gnome-screensaver
    Installed-Size: 416
    Original-Maintainer: Guilherme de S. Pastore <gpastore@debian.org>
    Architecture: amd64
    Version: 3.6.1-7ubuntu4
    Recommends: gnome-power-manager | xfce4-power-manager, libpam-gnome-keyring
    Size: 87688
    SHA256: be3c2bd73164e2d5c4788b46e2b5a66bd939eb81cbee1079b1f35f419cb3f2d2
    Description-en: GNOME screen saver and locker
    Homepage: https://wiki.gnome.org/GnomeScreensaver

    https://git.gnome.org/browse/gnome-screensaver/tree/doc/dbus-interface.xml
    aca4e113239c098c3dd1536aee9d8a0c29a4b225
 
    $ npm install dbus-native --save
    $ npm view dbus-native
    ...
    dbus-native@0.2.3
    gitHead: 'a6ef757feb485d9f9a6367e2dc594fd5a456d1a2'
    integrity: 'sha512-6eQp/WrtlP7vf03ayw7NNcq1KNSTCb6Gx1E/bybNfMNCA4zsd1JdzgRCPuYDQxyEVVRnpXdThlVKwKokY6xJzA=='
    license: 'MIT'

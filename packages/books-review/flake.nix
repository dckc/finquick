{
  description = "books-review: an AI proposes where a GnuCash book's uncategorized splits go, and a person reviews, as vats on a toybox kernel";

  inputs = {
    vattr97.url = "github:dckc/vattr97/217296eb69758c4418a317c8b1d65bd4463ac1b6";
    nixpkgs.follows = "vattr97/nixpkgs";
  };

  outputs =
    {
      self,
      nixpkgs,
      vattr97,
    }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
      toybox = vattr97.packages.${system}.toybox;

      # the boot directory: this package's vats, and the toybox vats they
      # use, vendored from the vattr97 input as copies (a boot directory
      # refuses symlinks); scripts/boot-dir.js does the same from
      # node_modules
      boot = pkgs.runCommand "books-review-boot" { } ''
        cp -r ${./boot} $out
        chmod -R u+w $out
        cp ${vattr97}/packages/toybox/examples/webapp.js $out/webapp.js
      '';

      # toybox-serve on the books' boot directory; the caller hands in the
      # sockets (-S http=3 -S admin=4 -S app=5), -d state=, and
      # -d git-checkout=
      serve = pkgs.writeShellScriptBin "books-review-serve" ''
        exec ${toybox}/bin/toybox-serve -d boot=${boot} "$@"
      '';
    in
    {
      packages.${system} = {
        default = serve;
        inherit boot serve;
      };

      checks.${system} = {
        inherit serve;
        # the kernel boots from boot/, and finds every vat it makes beside it
        boot =
          pkgs.runCommand "books-review-boot-check" { } ''
            for f in boot/boot.js boot/worker.json books.js reviewer.js categorizer.js webapp.js; do
              test -f ${boot}/$f || { echo "no $f in the boot directory" >&2; exit 1; }
            done
            touch $out
          '';
      };
    };
}

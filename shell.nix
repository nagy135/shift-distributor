{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs_20
    pkgs.nodePackages.npm
  ];

  shellHook = ''
    echo "Node version: $(node -v)"
    echo "npm version: $(npm -v)"
  '';
}

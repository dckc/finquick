#!/usr/bin/env zx
/* global fs, argv */
// TODO: env for zx

const dateOf = fileName => {
  const parts = fileName.match(/Statement-(\d{4})(\d{2})(\d{2})/);
  if (!parts) throw Error(`bad fileName ${fileName}`);
  const [_all, y, m, d] = parts.map(digits => parseInt(digits, 10));
  return new Date(y, m - 1, d);
};

const main = args => {
  args.forEach(fn => {
    const time = dateOf(fn);
    console.log({ fn, time });
    fs.utimesSync(fn, time, time);
  });
};

main(argv._.slice(1));

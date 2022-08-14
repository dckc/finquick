#!/usr/bin/env zx
// @ts-check

/**
 * @file fix dates on YYYY-MM*.* files
 */

import path from 'path';
import { fs } from 'zx';

/** @param {string} filePath */
const parseYearMonthFile = (filePath) => {
  const parts = filePath.match(/^(\d{4})-(\d{2}).*\..*/);
  if (!parts) return [];
  const [_txt, yyyy, mm] = parts;
  const [year, month] = [parseInt(yyyy, 10), parseInt(mm, 10)];
  const midMonth = new Date(year, month - 1, 15);
  return [{ filePath, year, month, midMonth }];
};

const main = async (argv, { readdir, utimes, join }) => {
  const [_node, _zx, _script, dirPath] = argv;

  const files = await readdir(dirPath);
  const info = files.flatMap(parseYearMonthFile);
  //   console.log({ path, info });

  const fixDate = ({ filePath, midMonth }) => {
    console.log(midMonth, filePath);
    const fullPath = join(dirPath, filePath);
    const mtime = midMonth.valueOf() / 1000;
    return utimes(fullPath, mtime, mtime);
  };
  await Promise.all(info.map(fixDate));
};

main(process.argv, {
  readdir: fs.readdir,
  utimes: fs.utimes,
  join: path.join,
}).catch((err) => console.error(err));

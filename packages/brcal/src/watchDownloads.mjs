// @ts-check
import chokidar from 'chokidar';

/**
 *
 * @param {string[]} argv
 * @param {Object} io
 * @param {typeof chokidar.watch} io.watch
 */
const main = (argv, { watch }) => {
  const [target] = argv.slice(2);
  // One-liner for current directory
  watch(target, { ignoreInitial: true }).on('add', (event, path) => {
    console.log(event, `${path}`);
  });
};

main([...process.argv], { watch: chokidar.watch });

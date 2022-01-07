/* global Buffer */

async function read(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const main = async ({ stdin }) => {
  const txt = await read(stdin);
  console.log(txt.length);
};

/* global require, module, process */
if (require.main === module) {
  main({ stdin: process.stdin }).catch(console.error);
}

const { freeze } = Object;

const handler = {
  async fetch(_request: Request): Promise<Response> {
    return new Response('ertp-clerk: not implemented', { status: 501 });
  },
};

export default freeze(handler);

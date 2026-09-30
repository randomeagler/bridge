import { connect } from 'cloudflare:sockets';

export default {
  async fetch(req, env) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('ok');
    if (new URL(req.url).searchParams.get('token') !== env.TOKEN)
      return new Response('forbidden', { status: 403 });

    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const sock = connect({ hostname: env.TARGET_HOST, port: +env.TARGET_PORT });
    const w = sock.writable.getWriter();

    server.addEventListener('message', e => w.write(new Uint8Array(e.data)));
    server.addEventListener('close', () => sock.close().catch(() => {}));
    sock.readable
      .pipeTo(new WritableStream({
        write(chunk) { server.send(chunk); },
        close() { server.close(); },
        abort() { server.close(); },
      }))
      .catch(() => server.close());

    return new Response(null, { status: 101, webSocket: client });
  },
};

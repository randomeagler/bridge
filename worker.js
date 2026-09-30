import { connect } from 'cloudflare:sockets';

export default {
  async fetch(req, env) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('ok');

    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const sock = connect({ hostname: env.TARGET_HOST, port: +env.TARGET_PORT });
    const w = sock.writable.getWriter();
    const die = m => { try { server.close(1011, String(m).slice(0, 100)); } catch {} };
    const t = setTimeout(() => die('no data from ' + env.TARGET_HOST + ':' + env.TARGET_PORT + ' after 10s'), 10000);
    sock.opened.catch(e => die('TCP connect failed: ' + e.message));

    server.addEventListener('message', e => w.write(new Uint8Array(e.data)));
    server.addEventListener('close', () => sock.close().catch(() => {}));
    sock.readable
      .pipeTo(new WritableStream({
        write(chunk) { clearTimeout(t); server.send(chunk); },
        close() { server.close(); },
        abort() { server.close(); },
      }))
      .catch(e => die('TCP error: ' + (e && e.message)));

    return new Response(null, { status: 101, webSocket: client });
  },
};

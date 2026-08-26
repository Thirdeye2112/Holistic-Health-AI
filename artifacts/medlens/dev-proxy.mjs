import { createServer, request as httpRequest } from "http";

const PROXY_PORT = parseInt(process.env.PORT ?? "18282");
const METRO_PORT = 18283;
const API_PORT = 8080;

function forward(req, res, targetPort) {
  const headers = { ...req.headers, host: `localhost:${targetPort}` };
  if (targetPort === METRO_PORT) {
    // Metro's CorsMiddleware rejects non-localhost origins — strip them.
    delete headers["origin"];
    delete headers["referer"];
  }
  const opts = {
    hostname: "localhost",
    port: targetPort,
    path: req.url,
    method: req.method,
    headers,
  };
  const proxy = httpRequest(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });
  proxy.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
    }
    res.end(`Proxy error: ${err.message}`);
  });
  req.pipe(proxy, { end: true });
}

const server = createServer((req, res) => {
  const isApi = req.url?.startsWith("/api");
  forward(req, res, isApi ? API_PORT : METRO_PORT);
});

server.on("upgrade", (req, socket, head) => {
  const opts = {
    hostname: "localhost",
    port: METRO_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };
  const proxy = httpRequest(opts);
  proxy.on("upgrade", (_res, proxySocket, proxyHead) => {
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        Object.entries(_res.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n"
    );
    if (proxyHead?.length) proxySocket.unshift(proxyHead);
    proxySocket.pipe(socket, { end: true });
    socket.pipe(proxySocket, { end: true });
  });
  proxy.on("error", () => socket.destroy());
  proxy.end();
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(
    `[dev-proxy] :${PROXY_PORT} → Metro:${METRO_PORT} | API:${API_PORT}`
  );
});

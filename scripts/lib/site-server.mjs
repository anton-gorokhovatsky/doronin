import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
};

function safePath(root, requestPath) {
  const pathname = decodeURIComponent(new URL(requestPath, "http://local.test").pathname);
  const relative = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const file = resolve(root, `.${relative}`);
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    throw new Error("Path outside test root");
  }
  return file;
}

export async function startSiteServer(rootPath) {
  const root = resolve(rootPath);
  const server = createServer(async (request, response) => {
    try {
      const file = safePath(root, request.url || "/");
      const details = await stat(file);
      if (!details.isFile()) throw new Error("Not a file");

      const contentType = MIME[extname(file).toLowerCase()] || "application/octet-stream";
      const range = request.headers.range?.match(/bytes=(\d*)-(\d*)/);
      if (range) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Number(range[2]) : details.size - 1;
        response.writeHead(206, {
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
          "Content-Length": end - start + 1,
          "Content-Range": `bytes ${start}-${end}/${details.size}`,
          "Content-Type": contentType,
        });
        createReadStream(file, { start, end }).pipe(response);
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": details.size,
        "Content-Type": contentType,
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    }),
  };
}

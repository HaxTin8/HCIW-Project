import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import { buildPromptCatalog } from './prompt-catalog.js';
import { AuthStore } from './auth-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function noContent(res) {
  res.writeHead(204, { 'Cache-Control': 'no-store' });
  res.end();
}

function notFound(res) {
  json(res, 404, { error: 'not_found' });
}

function unauthorized(res) {
  json(res, 401, { error: 'unauthorized' });
}

function badRequest(res, message) {
  json(res, 400, { error: message || 'bad_request' });
}

function serverError(res, error) {
  console.error('[server]', error);
  json(res, 500, { error: 'internal_error' });
}

function parseAuthToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

function readBody(req, limitBytes = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  if (!body.length) return {};
  return JSON.parse(body.toString('utf8'));
}

function annotateCatalog(catalog, statusMap) {
  return {
    version: catalog.version,
    generatedAt: catalog.generatedAt,
    groups: catalog.groups.map((group) => ({
      id: group.id,
      title: group.title,
      description: group.description,
      prompts: group.prompts.map((prompt) => ({
        ...prompt,
        hasRecording: Boolean(statusMap[prompt.id] && statusMap[prompt.id].hasRecording),
        updatedAt: statusMap[prompt.id] ? statusMap[prompt.id].updatedAt : null
      }))
    }))
  };
}

function resolveStaticPath(staticRoot, requestPath) {
  let pathname = decodeURIComponent(requestPath);
  if (pathname === '/') pathname = '/index.html';
  const absolutePath = path.normalize(path.join(staticRoot, pathname));
  if (!absolutePath.startsWith(staticRoot)) {
    return null;
  }
  return absolutePath;
}

async function proxyToPiper(req, res, requestUrl, piperBaseUrl) {
  if (!piperBaseUrl) {
    json(res, 502, { error: 'piper_unavailable' });
    return;
  }

  const baseUrl = new URL(piperBaseUrl);
  const upstreamPath = requestUrl.pathname.replace('/api/tts', '') || '/';
  const normalizedBasePath = baseUrl.pathname.endsWith('/')
    ? baseUrl.pathname.slice(0, -1)
    : baseUrl.pathname;
  const normalizedUpstreamPath = upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`;

  baseUrl.pathname = `${normalizedBasePath}${normalizedUpstreamPath}` || '/';
  baseUrl.search = requestUrl.search;

  const headers = {
    Accept: req.headers.accept || '*/*'
  };
  if (req.headers['content-type']) {
    headers['Content-Type'] = req.headers['content-type'];
  }

  const options = {
    method: req.method,
    headers
  };

  if (!['GET', 'HEAD'].includes(req.method)) {
    options.body = await readBody(req);
  }

  let upstreamRes;
  try {
    upstreamRes = await fetch(baseUrl, options);
  } catch (error) {
    json(res, 502, {
      error: 'piper_unreachable',
      detail: error.message
    });
    return;
  }
  const responseHeaders = {
    'Cache-Control': 'no-store'
  };
  const contentType = upstreamRes.headers.get('content-type');
  if (contentType) {
    responseHeaders['Content-Type'] = contentType;
  }

  res.writeHead(upstreamRes.status, responseHeaders);
  if (!upstreamRes.body) {
    res.end();
    return;
  }

  Readable.fromWeb(upstreamRes.body).pipe(res);
}

function createAppServer(options = {}) {
  const configuredStaticRoot = options.staticRoot || process.env.APP_STATIC_ROOT || ROOT;
  const staticRoot = path.resolve(configuredStaticRoot);
  const dataDir = options.dataDir || process.env.APP_DATA_DIR || path.join(ROOT, '.local-data');
  const port = Number(options.port || process.env.APP_PORT || process.env.PORT || 3000);
  const piperBaseUrl = options.piperBaseUrl || process.env.PIPER_BASE_URL || 'http://specula-piper:5000';
  const store = options.store || new AuthStore({ dataDir });

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    try {
      if (requestUrl.pathname.startsWith('/api/tts/')) {
        await proxyToPiper(req, res, requestUrl, piperBaseUrl);
        return;
      }

      if (requestUrl.pathname === '/api/family-voice/auth/register' && req.method === 'POST') {
        const body = await readJson(req);
        const user = store.createUser(body.username, body.password);
        const session = store.createToken(user.id);
        json(res, 201, {
          token: session.token,
          user: {
            id: user.id,
            username: user.username
          }
        });
        return;
      }

      if (requestUrl.pathname === '/api/family-voice/auth/login' && req.method === 'POST') {
        const body = await readJson(req);
        const user = store.authenticateUser(body.username, body.password);
        if (!user) {
          unauthorized(res);
          return;
        }
        const session = store.createToken(user.id);
        json(res, 200, {
          token: session.token,
          user
        });
        return;
      }

      if (requestUrl.pathname === '/api/family-voice/auth/logout' && req.method === 'POST') {
        const token = parseAuthToken(req);
        if (token) {
          store.revokeToken(token);
        }
        noContent(res);
        return;
      }

      if (requestUrl.pathname.startsWith('/api/family-voice/')) {
        const token = parseAuthToken(req);
        const user = store.getUserByToken(token);
        if (!user) {
          unauthorized(res);
          return;
        }

        if (requestUrl.pathname === '/api/family-voice/auth/me' && req.method === 'GET') {
          json(res, 200, { user });
          return;
        }

        if (requestUrl.pathname === '/api/family-voice/library' && req.method === 'GET') {
          const catalog = buildPromptCatalog(ROOT);
          const statusMap = store.listRecordingStatus(user.id);
          json(res, 200, annotateCatalog(catalog, statusMap));
          return;
        }

        if (requestUrl.pathname.startsWith('/api/family-voice/recordings/')) {
          const promptId = decodeURIComponent(requestUrl.pathname.replace('/api/family-voice/recordings/', ''));
          const catalog = buildPromptCatalog(ROOT);
          if (!catalog.promptMap[promptId]) {
            badRequest(res, 'invalid_prompt_id');
            return;
          }

          if (req.method === 'PUT') {
            const mimeType = req.headers['content-type'] || 'audio/webm';
            const audioBuffer = await readBody(req, 20 * 1024 * 1024);
            if (!audioBuffer.length) {
              badRequest(res, 'empty_audio');
              return;
            }
            const saved = store.saveRecording(user.id, promptId, audioBuffer, mimeType);
            json(res, 200, {
              promptId,
              hasRecording: true,
              updatedAt: saved.updated_at
            });
            return;
          }

          if (req.method === 'GET') {
            const recording = store.getRecording(user.id, promptId);
            if (!recording) {
              notFound(res);
              return;
            }
            const absolutePath = path.join(store.recordingsDir, recording.file_path);
            if (!fs.existsSync(absolutePath)) {
              notFound(res);
              return;
            }
            res.writeHead(200, {
              'Content-Type': recording.mime_type,
              'Cache-Control': 'no-store'
            });
            fs.createReadStream(absolutePath).pipe(res);
            return;
          }

          if (req.method === 'DELETE') {
            const deleted = store.deleteRecording(user.id, promptId);
            json(res, 200, { promptId, deleted });
            return;
          }
        }

        notFound(res);
        return;
      }

      const staticPath = resolveStaticPath(staticRoot, requestUrl.pathname);
      if (!staticPath) {
        json(res, 403, { error: 'forbidden' });
        return;
      }

      fs.stat(staticPath, (error, stats) => {
        let filePath = staticPath;
        if (!error && stats.isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        } else if (error && !path.extname(filePath)) {
          filePath = path.join(staticRoot, 'index.html');
        }

        fs.readFile(filePath, (readError, data) => {
          if (readError) {
            res.writeHead(readError.code === 'ENOENT' ? 404 : 500, {
              'Content-Type': 'text/plain; charset=utf-8'
            });
            res.end(readError.code === 'ENOENT' ? 'File non trovato' : 'Errore del server');
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': 'no-store'
          });
          res.end(data);
        });
      });
    } catch (error) {
      if (error && error.message === 'payload_too_large') {
        json(res, 413, { error: 'payload_too_large' });
        return;
      }
      if (error instanceof SyntaxError) {
        badRequest(res, 'invalid_json');
        return;
      }
      if (error && error.message === 'username_password_required') {
        badRequest(res, 'username_password_required');
        return;
      }
      if (error && /UNIQUE constraint failed: users\.username/i.test(error.message)) {
        badRequest(res, 'username_taken');
        return;
      }
      serverError(res, error);
    }
  });

  server.on('error', (error) => {
    console.error('[server] errore:', error.message);
  });

  return {
    port,
    server,
    start() {
      return new Promise((resolve) => {
        server.listen(port, '0.0.0.0', () => resolve({ port }));
      });
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const app = createAppServer();
  app.start().then(({ port }) => {
    console.log(`Specula Elementae pronta su http://localhost:${port}`);
  });
}

export {
  createAppServer
};

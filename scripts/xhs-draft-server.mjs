import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PORT = Number(process.env.XHS_DRAFT_PORT || 3021);
const CDP_PORT = Number(process.env.XHS_CDP_PORT || 9222);
const UPLOAD_DIR = join(process.cwd(), '.xhs-upload-cache');

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.webSocketUrl);
    this.ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        this.pending.get(message.id)(message);
        this.pending.delete(message.id);
      }
    };
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    await this.send('Runtime.enable');
    await this.send('Page.enable');
  }

  send(method, params = {}) {
    return new Promise(resolve => {
      const id = ++this.id;
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.result?.exceptionDetails) {
      throw new Error(result.result.exceptionDetails.text || 'CDP evaluation failed');
    }
    return result.result?.result?.value;
  }

  close() {
    this.ws?.close();
  }
}

async function getXhsPage() {
  const pages = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const page = pages.find(item => item.url.includes('creator.xiaohongshu.com'));
  if (!page) {
    throw new Error(`请先用带调试端口的 Edge 打开小红书创作服务平台: ${CDP_PORT}`);
  }
  const client = new CdpClient(page.webSocketDebuggerUrl);
  await client.connect();
  return client;
}

async function waitFor(client, expression, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await client.eval(expression)) return true;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return false;
}

async function createLongArticleDraft(payload) {
  const title = String(payload.content?.title || '').trim().slice(0, 64);
  const tags = Array.isArray(payload.content?.tags)
    ? payload.content.tags.map(tag => `#${String(tag).replace(/^#/, '').trim()}`).filter(tag => tag.length > 1)
    : [];
  const body = [
    String(payload.content?.bodyMarkdown || '').trim(),
    tags.length ? `\n${tags.join(' ')}` : ''
  ].join('\n').trim();

  if (!title) throw new Error('标题为空，无法创建小红书草稿');
  if (!body) throw new Error('正文为空，无法创建小红书草稿');

  const client = await getXhsPage();
  try {
    await client.send('Page.bringToFront');
    await client.eval(`location.href = 'https://creator.xiaohongshu.com/publish/publish?source=official&target=article'`);
    await waitFor(client, `document.body.innerText.includes('新的创作') || document.querySelector('[placeholder="输入标题"]')`);

    const hasEditor = await client.eval(`Boolean(document.querySelector('[placeholder="输入标题"]') && document.querySelector('[contenteditable="true"]'))`);
    if (!hasEditor) {
      await client.eval(`(() => {
        const button = Array.from(document.querySelectorAll('button,*')).find(el => (el.innerText || '').trim() === '新的创作');
        if (!button) return false;
        button.click();
        return true;
      })()`);
    }

    const ready = await waitFor(client, `Boolean(document.querySelector('[placeholder="输入标题"]') && document.querySelector('[contenteditable="true"]'))`, 20000);
    if (!ready) throw new Error('没有找到小红书长文编辑器');

    await client.eval(`(() => {
      const title = ${JSON.stringify(title)};
      const input = document.querySelector('[placeholder="输入标题"]');
      input.focus();
      input.value = title;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);

    await client.eval(`(() => {
      const editor = document.querySelector('[contenteditable="true"]');
      editor.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, ${JSON.stringify(body)});
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(body)} }));
      return true;
    })()`);

    await new Promise(resolve => setTimeout(resolve, 1000));
    const clicked = await client.eval(`(() => {
      const button = Array.from(document.querySelectorAll('button')).find(el => (el.innerText || '').trim() === '暂存离开');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!clicked) throw new Error('没有找到“暂存离开”按钮');

    return {
      success: true,
      draftId: payload.idempotencyKey || `xhs-${Date.now()}`,
      managementUrl: 'https://creator.xiaohongshu.com/publish/publish?source=official&target=article',
      targetKind: 'webhook-draft'
    };
  } finally {
    client.close();
  }
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function parseMultipart(buffer, contentType) {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) throw new Error('Missing multipart boundary');
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(boundaryBuffer);
  while (start !== -1) {
    const next = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    if (next === -1) break;
    const part = buffer.subarray(start + boundaryBuffer.length + 2, next - 2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd > -1) {
      const headers = part.subarray(0, headerEnd).toString('utf8');
      const content = part.subarray(headerEnd + 4);
      const name = headers.match(/name="([^"]+)"/)?.[1] || '';
      const filename = headers.match(/filename="([^"]+)"/)?.[1] || '';
      parts.push({ name, filename, content });
    }
    start = next;
  }
  return parts;
}

async function handleMediaUpload(request) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const body = await readBody(request);
  const parts = parseMultipart(body, request.headers['content-type'] || '');
  const file = parts.find(part => part.name === 'file' && part.filename);
  if (!file) throw new Error('No file part found');
  const safeName = file.filename.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
  const mediaRef = `${Date.now()}-${safeName}`;
  await writeFile(join(UPLOAD_DIR, mediaRef), file.content);
  return { success: true, mediaRef };
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  response.end(JSON.stringify(payload));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, authorization, idempotency-key, x-ai-workbench-timestamp, x-ai-workbench-signature'
      });
      response.end();
      return;
    }

    if (request.method === 'POST' && request.url === '/xhs/media') {
      sendJson(response, 200, await handleMediaUpload(request));
      return;
    }

    if (request.method === 'POST' && request.url === '/xhs/draft') {
      const body = await readBody(request);
      const payload = JSON.parse(body.toString('utf8'));
      if (payload.type === 'connection-test') {
        sendJson(response, 200, { success: true });
        return;
      }
      sendJson(response, 200, await createLongArticleDraft(payload));
      return;
    }

    sendJson(response, 404, { success: false, message: 'Not found' });
  } catch (error) {
    sendJson(response, 500, {
      success: false,
      error: {
        code: 'XHS_DRAFT_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false
      }
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`XHS draft server listening on http://127.0.0.1:${PORT}`);
  console.log(`Draft URL: http://127.0.0.1:${PORT}/xhs/draft`);
  console.log(`Media URL: http://127.0.0.1:${PORT}/xhs/media`);
});

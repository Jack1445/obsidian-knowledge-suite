import { writeFile } from 'node:fs/promises';

const port = process.env.OBSIDIAN_DEBUG_PORT ?? '9223';
const expression = process.argv.slice(2).join(' ');
const screenshotPath = process.env.OBSIDIAN_SCREENSHOT_PATH;

if (!expression) {
	throw new Error('Usage: node scripts/obsidian-cdp.mjs <JavaScript expression>');
}

const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
const page = targets.find((target) => target.type === 'page' && target.url === 'app://obsidian.md/index.html');
if (!page?.webSocketDebuggerUrl) throw new Error('No Obsidian page target found.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
	socket.addEventListener('open', resolve, { once: true });
	socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', (event) => {
	const message = JSON.parse(event.data);
	if (!message.id) return;
	const request = pending.get(message.id);
	if (!request) return;
	pending.delete(message.id);
	if (message.error) request.reject(new Error(message.error.message));
	else request.resolve(message.result);
});

function send(method, params = {}) {
	const id = nextId++;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject });
		socket.send(JSON.stringify({ id, method, params }));
	});
}

const result = await send('Runtime.evaluate', {
	expression,
	awaitPromise: true,
	returnByValue: true,
	userGesture: true,
});

if (screenshotPath) {
	const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
	await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
}
socket.close();

if (result.exceptionDetails) {
	throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
}

console.log(JSON.stringify(result.result.value, null, 2));

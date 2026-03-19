import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { execFile, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env');

const DEFAULT_WRITER_MODEL = 'gpt-5.4';
const DEFAULT_REVIEWER_MODEL = 'gpt-5.4';
const DEFAULT_MAX_ROUNDS = 4;
const DEFAULT_MAX_REVIEW_ROUTES = 3;
const DEFAULT_BUILD_COMMAND = 'npm run build';
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const MAX_OUTPUT_CHARS = 24000;
const VISUAL_BROWSER_CANDIDATES = ['google-chrome-stable', 'google-chrome', 'chromium-browser', 'chromium'];
const VISUAL_VIEWPORTS = [
    { name: 'desktop', width: 1600, height: 1200 },
    { name: 'mobile', width: 390, height: 844 }
];

const WRITER_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        summary: { type: 'string' },
        changed_files: { type: 'array', items: { type: 'string' } },
        validation: { type: 'string' },
        review_routes: { type: 'array', items: { type: 'string' } },
        unresolved_risks: { type: 'array', items: { type: 'string' } }
    },
    required: ['summary', 'changed_files', 'validation', 'review_routes', 'unresolved_risks']
};

const REVIEWER_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        approved: { type: 'boolean' },
        summary: { type: 'string' },
        must_fix: { type: 'array', items: { type: 'string' } },
        nice_to_have: { type: 'array', items: { type: 'string' } },
        visual_summary: { type: 'string' },
        visual_limitations: { type: 'string' }
    },
    required: ['approved', 'summary', 'must_fix', 'nice_to_have', 'visual_summary', 'visual_limitations']
};

const HELP_TEXT = `Usage:
  npm run agent:pair -- --task="your request"
  npm run agent:pair -- "your request"

Options:
  --task=TEXT                Task for the writer/reviewer pair.
  --writer-model=MODEL       Default: ${DEFAULT_WRITER_MODEL}
  --reviewer-model=MODEL     Default: ${DEFAULT_REVIEWER_MODEL}
  --max-rounds=N             Default: ${DEFAULT_MAX_ROUNDS}
  --max-review-routes=N      Max visual review routes. Default: ${DEFAULT_MAX_REVIEW_ROUTES}
  --build-command=CMD        Validation command after each writer round. Default: "${DEFAULT_BUILD_COMMAND}"
  --disable-visual-review    Skip screenshot capture and visual evidence.
  --oss                      Use Codex local OSS provider instead of the default provider.
  --local-provider=NAME      Local OSS provider: ollama or lmstudio.
  --allow-dirty              Deprecated no-op. Dirty worktrees are allowed by default.
  --help                     Show this message.

Environment:
  CODEX_WRITER_MODEL         Optional writer model override.
  CODEX_REVIEWER_MODEL       Optional reviewer model override.
  CODEX_DISABLE_VISUAL_REVIEW=1  Optional hard disable for screenshot-based review.
  CODEX_VISUAL_BROWSER       Optional browser binary override for screenshots.
  CODEX_USE_OSS=1            Optional default to local OSS provider.
  CODEX_LOCAL_PROVIDER       Optional local OSS provider override.
  CODEX_BIN                  Optional path override for the codex executable.

Requirements:
  - Codex CLI must be installed and available as "codex".
  - For cloud-backed Codex usage, run "codex login" first.
  - For fully local runs, use --oss or set CODEX_USE_OSS=1 and ensure Ollama or LM Studio is running.
`;

function parseEnvValue(raw) {
    if (!raw) {
        return '';
    }

    const trimmed = raw.trim();
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
}

async function loadDotEnv() {
    try {
        const text = await fs.readFile(envPath, 'utf8');
        for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            const eqIndex = trimmed.indexOf('=');
            if (eqIndex === -1) {
                continue;
            }

            const key = trimmed.slice(0, eqIndex).trim();
            const value = parseEnvValue(trimmed.slice(eqIndex + 1));
            if (!(key in process.env)) {
                process.env[key] = value;
            }
        }
    } catch {
        // Ignore missing .env
    }
}

function clampInt(value, fallback, min, max) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, numeric));
}

function parseArgs(argv) {
    const options = {
        task: '',
        writerModel: '',
        reviewerModel: '',
        maxRounds: DEFAULT_MAX_ROUNDS,
        maxReviewRoutes: DEFAULT_MAX_REVIEW_ROUTES,
        buildCommand: DEFAULT_BUILD_COMMAND,
        visualReview: process.env.CODEX_DISABLE_VISUAL_REVIEW !== '1',
        allowDirty: false,
        useOss: process.env.CODEX_USE_OSS === '1',
        localProvider: process.env.CODEX_LOCAL_PROVIDER || '',
        help: false,
        positionals: []
    };

    for (const arg of argv) {
        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }

        if (arg === '--allow-dirty') {
            options.allowDirty = true;
            continue;
        }

        if (arg === '--disable-visual-review') {
            options.visualReview = false;
            continue;
        }

        if (arg === '--oss') {
            options.useOss = true;
            continue;
        }

        if (arg.startsWith('--task=')) {
            options.task = arg.slice('--task='.length).trim();
            continue;
        }

        if (arg.startsWith('--writer-model=')) {
            options.writerModel = arg.slice('--writer-model='.length).trim();
            continue;
        }

        if (arg.startsWith('--reviewer-model=')) {
            options.reviewerModel = arg.slice('--reviewer-model='.length).trim();
            continue;
        }

        if (arg.startsWith('--max-rounds=')) {
            options.maxRounds = clampInt(arg.slice('--max-rounds='.length), DEFAULT_MAX_ROUNDS, 1, 12);
            continue;
        }

        if (arg.startsWith('--max-review-routes=')) {
            options.maxReviewRoutes = clampInt(
                arg.slice('--max-review-routes='.length),
                DEFAULT_MAX_REVIEW_ROUTES,
                1,
                5
            );
            continue;
        }

        if (arg.startsWith('--build-command=')) {
            options.buildCommand = arg.slice('--build-command='.length).trim() || DEFAULT_BUILD_COMMAND;
            continue;
        }

        if (arg.startsWith('--local-provider=')) {
            options.localProvider = arg.slice('--local-provider='.length).trim();
            continue;
        }

        if (arg.startsWith('--')) {
            throw new Error(`Unknown option: ${arg}`);
        }

        options.positionals.push(arg);
    }

    return options;
}

async function readTaskFromInput(options) {
    if (options.task) {
        return options.task;
    }

    if (options.positionals.length > 0) {
        return options.positionals.join(' ').trim();
    }

    if (!process.stdin.isTTY) {
        const chunks = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks).toString('utf8').trim();
    }

    return '';
}

function ensureInsideRepo(candidatePath) {
    const absolute = path.isAbsolute(candidatePath)
        ? path.resolve(candidatePath)
        : path.resolve(repoRoot, candidatePath);

    if (absolute !== repoRoot && !absolute.startsWith(`${repoRoot}${path.sep}`)) {
        throw new Error(`Path escapes repository root: ${candidatePath}`);
    }

    return absolute;
}

function toRepoRelative(candidatePath) {
    return path.relative(repoRoot, ensureInsideRepo(candidatePath)) || '.';
}

function cleanArray(values) {
    return Array.from(
        new Set(
            (Array.isArray(values) ? values : [])
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        )
    );
}

function subtractArray(values, ignored) {
    const ignoredSet = new Set(cleanArray(ignored));
    return cleanArray(values).filter((value) => !ignoredSet.has(value));
}

function truncateText(text, limit = MAX_OUTPUT_CHARS) {
    const value = String(text || '');
    if (value.length <= limit) {
        return value;
    }

    return `${value.slice(0, limit)}\n\n...[truncated ${value.length - limit} chars]`;
}

function normalizeRoute(route) {
    let normalized = String(route || '').trim();
    if (!normalized) {
        return '';
    }

    try {
        const parsed = new URL(normalized);
        normalized = parsed.pathname || '/';
    } catch {
        // Already path-like.
    }

    if (!normalized.startsWith('/')) {
        normalized = `/${normalized}`;
    }

    if (!path.posix.extname(normalized) && !normalized.endsWith('/')) {
        normalized = `${normalized}/`;
    }

    return normalized;
}

function printSection(title, body) {
    console.log(`\n[${title}]`);
    if (body) {
        console.log(body);
    }
}

function shortId(value) {
    const text = String(value || '').trim();
    return text ? text.slice(0, 8) : '';
}

function cleanProgressText(text, limit = 220) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return '';
    }

    if (normalized.length <= limit) {
        return normalized;
    }

    return `${normalized.slice(0, limit - 16)}...[truncated]`;
}

function appendBoundedText(current, addition, limit = 120000) {
    const next = `${current}${addition}`;
    if (next.length <= limit) {
        return next;
    }

    return next.slice(next.length - limit);
}

function createProgressReporter(role) {
    let lastMessage = '';

    return (message) => {
        const cleaned = cleanProgressText(message);
        if (!cleaned || cleaned === lastMessage) {
            return;
        }

        lastMessage = cleaned;
        console.log(`[${role}] ${cleaned}`);
    };
}

function humanizeToken(value) {
    return String(value || '')
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function describeCommandValue(value) {
    if (!value) {
        return '';
    }

    if (typeof value === 'string') {
        return cleanProgressText(value, 200);
    }

    if (Array.isArray(value)) {
        return cleanProgressText(value.map((item) => String(item)).join(' '), 200);
    }

    if (typeof value === 'object') {
        if (Array.isArray(value.argv) && value.argv.length > 0) {
            return cleanProgressText(value.argv.map((item) => String(item)).join(' '), 200);
        }

        if (typeof value.command === 'string') {
            return cleanProgressText(value.command, 200);
        }

        if (typeof value.cmd === 'string') {
            return cleanProgressText(value.cmd, 200);
        }

        if (typeof value.program === 'string' && Array.isArray(value.args)) {
            return cleanProgressText([value.program, ...value.args.map((item) => String(item))].join(' '), 200);
        }
    }

    return '';
}

function extractCommandFromItem(item) {
    if (!item || typeof item !== 'object') {
        return '';
    }

    return (
        describeCommandValue(item.command) ||
        describeCommandValue(item.cmd) ||
        describeCommandValue(item.argv) ||
        describeCommandValue(item.shell_command) ||
        describeCommandValue(item.exec) ||
        describeCommandValue(item.payload?.command) ||
        describeCommandValue(item.input?.command)
    );
}

function extractPathFromItem(item) {
    if (!item || typeof item !== 'object') {
        return '';
    }

    const directKeys = ['path', 'file_path', 'filePath', 'target_path', 'targetPath', 'relative_path', 'uri'];
    for (const key of directKeys) {
        const value = item[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    const nestedKeys = ['file', 'target', 'payload', 'input'];
    for (const key of nestedKeys) {
        const nested = item[key];
        if (nested && typeof nested === 'object') {
            const candidate = extractPathFromItem(nested);
            if (candidate) {
                return candidate;
            }
        }
    }

    return '';
}

function extractExitCode(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const candidates = [item.exit_code, item.exitCode, item.status_code, item.statusCode, item.code];
    for (const candidate of candidates) {
        if (Number.isInteger(candidate)) {
            return candidate;
        }
    }

    const nestedKeys = ['result', 'payload', 'output'];
    for (const key of nestedKeys) {
        const nested = item[key];
        if (nested && typeof nested === 'object') {
            const candidate = extractExitCode(nested);
            if (candidate !== null) {
                return candidate;
            }
        }
    }

    return null;
}

function summarizeItemLifecycle(item, phase) {
    const itemType = String(item?.type || '').trim().toLowerCase();
    if (!itemType) {
        return null;
    }

    if (itemType.includes('message')) {
        return null;
    }

    if (itemType.includes('reason')) {
        return phase === 'started' ? 'Reasoning through the task.' : null;
    }

    if (itemType === 'error') {
        return item?.message ? `Notice: ${item.message}` : 'Notice: agent reported an error.';
    }

    const command = extractCommandFromItem(item);
    if (command && ['command', 'shell', 'exec', 'terminal'].some((token) => itemType.includes(token))) {
        const exitCode = extractExitCode(item);
        if (phase === 'started') {
            return `Running command: ${command}`;
        }

        if (phase === 'completed') {
            return exitCode !== null
                ? `Command finished (exit ${exitCode}): ${command}`
                : `Command finished: ${command}`;
        }

        return `Command update: ${command}`;
    }

    const filePath = extractPathFromItem(item);
    if (filePath && ['file', 'patch', 'write', 'edit'].some((token) => itemType.includes(token))) {
        if (phase === 'started') {
            return `Editing ${filePath}`;
        }

        if (phase === 'completed') {
            return `Updated ${filePath}`;
        }

        return `Working on ${filePath}`;
    }

    if (itemType.includes('plan')) {
        return phase === 'completed' ? 'Plan updated.' : 'Updating plan.';
    }

    if (phase === 'started') {
        return `Started ${humanizeToken(itemType)}.`;
    }

    if (phase === 'completed') {
        return `Finished ${humanizeToken(itemType)}.`;
    }

    return `Updated ${humanizeToken(itemType)}.`;
}

function summarizeStructuredEvent(event) {
    const type = String(event?.type || '').trim();
    if (!type) {
        return null;
    }

    if (type === 'thread.started') {
        return event.thread_id ? `Session started (${shortId(event.thread_id)}).` : 'Session started.';
    }

    if (type === 'turn.started') {
        return 'Turn started.';
    }

    if (type === 'turn.completed') {
        return 'Turn completed.';
    }

    if (type === 'error') {
        return event.message ? `Notice: ${event.message}` : 'Notice: agent reported an error.';
    }

    if (type === 'item.started') {
        return summarizeItemLifecycle(event.item, 'started');
    }

    if (type === 'item.updated') {
        return summarizeItemLifecycle(event.item, 'updated');
    }

    if (type === 'item.completed') {
        return summarizeItemLifecycle(event.item, 'completed');
    }

    if (type.endsWith('.started')) {
        return `Started ${humanizeToken(type.slice(0, -'.started'.length))}.`;
    }

    if (type.endsWith('.completed')) {
        return `Finished ${humanizeToken(type.slice(0, -'.completed'.length))}.`;
    }

    return null;
}

function summarizeCodexTextLine(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed) {
        return null;
    }

    const ignoredPatterns = [
        'WARNING: proceeding, even though we could not update PATH',
        'state db discrepancy during find_thread_path_by_id_str_in_subdir',
        'state_db: failed to read backfill state',
        'shell_snapshot: Failed to create shell snapshot',
        'startup websocket prewarm setup failed',
        'responses_websocket: failed to connect to websocket',
        'stream disconnected - retrying sampling request',
        'attempt to write a readonly database'
    ];

    if (ignoredPatterns.some((pattern) => trimmed.includes(pattern))) {
        return null;
    }

    if (trimmed.startsWith('Caused by:') || trimmed === 'Read-only file system (os error 30)') {
        return null;
    }

    let cleaned = trimmed
        .replace(/^\d{4}-\d{2}-\d{2}T\S+\s+(?:WARN|ERROR)\s+\S+:\s+/, '')
        .replace(/^WARNING:\s+/, '')
        .trim();

    if (!cleaned) {
        return null;
    }

    if (cleaned.includes('falling back to HTTP')) {
        return 'Falling back to HTTPS transport.';
    }

    const looksOperational = /^\d{4}-\d{2}-\d{2}T/.test(trimmed) || /\b(?:warn|error|failed|fallback|timeout)\b/i.test(cleaned);
    if (!looksOperational) {
        return null;
    }

    return cleaned;
}

function handleCodexStreamLine({ line, reportProgress }) {
    const trimmed = String(line || '').trim();
    if (!trimmed) {
        return;
    }

    try {
        const event = JSON.parse(trimmed);
        if (event && typeof event === 'object' && !Array.isArray(event)) {
            const summary = summarizeStructuredEvent(event);
            if (summary) {
                reportProgress(summary);
            }
            return;
        }
    } catch {
        // Fall through to raw line handling.
    }

    const summary = summarizeCodexTextLine(trimmed);
    if (summary) {
        reportProgress(summary);
    }
}

async function runStreamingCommand(command, args, { cwd, role, timeout = DEFAULT_TIMEOUT_MS, input = '' }) {
    return new Promise((resolve) => {
        const reportProgress = createProgressReporter(role);
        reportProgress('Launching Codex CLI.');

        const child = spawn(command, args, {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let settled = false;
        let timedOut = false;
        let forceKillTimer = null;

        const finish = (result) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(killTimer);
            if (forceKillTimer) {
                clearTimeout(forceKillTimer);
            }
            resolve(result);
        };

        const attachReader = (stream, source) => {
            const reader = createInterface({ input: stream });

            reader.on('line', (line) => {
                if (source === 'stdout') {
                    stdout = appendBoundedText(stdout, `${line}\n`);
                } else {
                    stderr = appendBoundedText(stderr, `${line}\n`);
                }

                handleCodexStreamLine({ line, reportProgress });
            });
        };

        attachReader(child.stdout, 'stdout');
        attachReader(child.stderr, 'stderr');

        if (child.stdin) {
            child.stdin.end(input);
        }

        const killTimer = setTimeout(() => {
            timedOut = true;
            reportProgress(`Timed out after ${Math.round(timeout / 60000)} minutes. Stopping agent.`);
            child.kill('SIGTERM');
            forceKillTimer = setTimeout(() => {
                child.kill('SIGKILL');
            }, 5000);
            forceKillTimer.unref?.();
        }, timeout);

        child.on('error', (error) => {
            finish({
                ok: false,
                code: null,
                stdout,
                stderr: appendBoundedText(stderr, `${error.message || String(error)}\n`),
                timedOut,
                signal: null
            });
        });

        child.on('close', (code, signal) => {
            if (timedOut) {
                finish({
                    ok: false,
                    code,
                    stdout,
                    stderr,
                    timedOut: true,
                    signal
                });
                return;
            }

            finish({
                ok: code === 0,
                code,
                stdout,
                stderr,
                timedOut: false,
                signal
            });
        });
    });
}

async function safeExecFile(command, args, options = {}) {
    try {
        const result = await execFileAsync(command, args, {
            cwd: repoRoot,
            maxBuffer: 8 * 1024 * 1024,
            timeout: DEFAULT_TIMEOUT_MS,
            ...options
        });
        return {
            ok: true,
            code: 0,
            stdout: result.stdout || '',
            stderr: result.stderr || ''
        };
    } catch (error) {
        return {
            ok: false,
            code: Number.isInteger(error?.code) ? error.code : null,
            stdout: error?.stdout || '',
            stderr: error?.stderr || error?.message || String(error)
        };
    }
}

async function runShellCommand(command, timeout = DEFAULT_TIMEOUT_MS) {
    return safeExecFile('/bin/bash', ['-lc', command], { timeout });
}

async function getGitStatusOutput() {
    const result = await safeExecFile('git', ['-C', repoRoot, 'status', '--short']);
    return (result.stdout || '').trim();
}

async function getChangedFiles() {
    const changed = await safeExecFile('git', ['-C', repoRoot, 'status', '--short']);
    return (changed.stdout || '')
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => line.slice(3).trim());
}

async function writeJsonFile(filePath, value) {
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function resolveCodexBinary() {
    const explicit = String(process.env.CODEX_BIN || '').trim();
    if (explicit) {
        const result = await safeExecFile(explicit, ['--version']);
        if (result.ok) {
            return explicit;
        }
        throw new Error(`CODEX_BIN is set but not executable: ${explicit}`);
    }

    const fromPath = await runShellCommand('command -v codex');
    const pathCandidate = (fromPath.stdout || '').trim().split('\n')[0]?.trim();
    if (fromPath.ok && pathCandidate) {
        const result = await safeExecFile(pathCandidate, ['--version']);
        if (result.ok) {
            return pathCandidate;
        }
    }

    const vscodeCandidate = await runShellCommand('ls -dt "$HOME"/.vscode-server/extensions/openai.chatgpt-*/bin/linux-x86_64/codex 2>/dev/null | head -n 1');
    const vscodePath = (vscodeCandidate.stdout || '').trim().split('\n')[0]?.trim();
    if (vscodePath) {
        const result = await safeExecFile(vscodePath, ['--version']);
        if (result.ok) {
            return vscodePath;
        }
    }

    throw new Error(
        'Could not find a working codex binary. Set CODEX_BIN explicitly or make sure "codex" is available in PATH.'
    );
}

async function runCodexAgent({
    role,
    prompt,
    schema,
    model,
    useOss,
    localProvider,
    sandbox,
    reasoningEffort,
    images = []
}) {
    const tempDirectory = await fs.mkdtemp(path.join('/tmp', `agent-pair-${role}-`));
    const schemaPath = path.join(tempDirectory, `${role}-schema.json`);
    const outputPath = path.join(tempDirectory, `${role}-output.json`);
    await writeJsonFile(schemaPath, schema);

    const codexBin = await resolveCodexBinary();
    const args = ['exec', '--ephemeral', '--json', '-C', repoRoot, '--output-schema', schemaPath, '-o', outputPath];

    if (sandbox === 'workspace-write') {
        args.push('--full-auto');
    } else {
        args.push('--full-auto', '-s', sandbox);
    }

    if (model) {
        args.push('-m', model);
    }

    if (useOss) {
        args.push('--oss');
        if (localProvider) {
            args.push('--local-provider', localProvider);
        }
    }

    if (reasoningEffort) {
        args.push('-c', `model_reasoning_effort="${reasoningEffort}"`);
    }

    for (const imagePath of images) {
        args.push('--image', imagePath);
    }

    const promptInput = prompt.endsWith('\n') ? prompt : `${prompt}\n`;
    args.push('-');

    const result = await runStreamingCommand(codexBin, args, { cwd: repoRoot, role, input: promptInput });
    if (!result.ok) {
        throw new Error(
            `${role} codex exec failed.\nstdout:\n${truncateText(result.stdout, 4000)}\n\nstderr:\n${truncateText(result.stderr, 4000)}`
        );
    }

    const outputText = await fs.readFile(outputPath, 'utf8').catch(() => '');
    if (!outputText.trim()) {
        throw new Error(`${role} codex exec finished without writing structured output.`);
    }

    try {
        return JSON.parse(outputText);
    } catch (error) {
        throw new Error(`${role} structured output was not valid JSON: ${error.message}`);
    }
}

function getMimeType(filePath) {
    switch (path.extname(filePath).toLowerCase()) {
        case '.css':
            return 'text/css; charset=utf-8';
        case '.html':
            return 'text/html; charset=utf-8';
        case '.ico':
            return 'image/x-icon';
        case '.jpeg':
        case '.jpg':
            return 'image/jpeg';
        case '.js':
        case '.mjs':
            return 'text/javascript; charset=utf-8';
        case '.json':
            return 'application/json; charset=utf-8';
        case '.png':
            return 'image/png';
        case '.svg':
            return 'image/svg+xml; charset=utf-8';
        case '.txt':
            return 'text/plain; charset=utf-8';
        case '.webp':
            return 'image/webp';
        case '.xml':
            return 'application/xml; charset=utf-8';
        default:
            return 'application/octet-stream';
    }
}

async function resolveStaticAsset(staticRoot, requestPath) {
    const parsedUrl = new URL(requestPath, 'http://127.0.0.1');
    const pathname = decodeURIComponent(parsedUrl.pathname);
    const candidates = [];

    if (pathname.endsWith('/')) {
        candidates.push(`${pathname}index.html`);
    } else {
        candidates.push(pathname);
        if (!path.posix.extname(pathname)) {
            candidates.push(`${pathname}/index.html`);
            candidates.push(`${pathname}.html`);
        }
    }

    for (const candidate of candidates) {
        const absolute = path.resolve(staticRoot, `.${candidate}`);
        if (absolute !== staticRoot && !absolute.startsWith(`${staticRoot}${path.sep}`)) {
            continue;
        }

        const stats = await fs.stat(absolute).catch(() => null);
        if (stats?.isFile()) {
            return absolute;
        }
    }

    return null;
}

async function startStaticServer(staticRoot) {
    const server = http.createServer(async (request, response) => {
        const assetPath = await resolveStaticAsset(staticRoot, request.url || '/');
        if (!assetPath) {
            response.statusCode = 404;
            response.end('Not found');
            return;
        }

        try {
            const buffer = await fs.readFile(assetPath);
            response.statusCode = 200;
            response.setHeader('Content-Type', getMimeType(assetPath));
            response.end(buffer);
        } catch {
            response.statusCode = 500;
            response.end('Internal server error');
        }
    });

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to start local static server for visual review.');
    }

    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        async close() {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });
        }
    };
}

async function detectVisualBrowser() {
    if (process.env.CODEX_VISUAL_BROWSER) {
        const explicit = process.env.CODEX_VISUAL_BROWSER.trim();
        if (!explicit) {
            return '';
        }
        const result = await safeExecFile(explicit, ['--version']);
        return result.ok ? explicit : '';
    }

    for (const candidate of VISUAL_BROWSER_CANDIDATES) {
        const result = await safeExecFile(candidate, ['--version']);
        if (result.ok) {
            return candidate;
        }
    }

    return '';
}

function chromeArgsForScreenshot(url, outputPath, viewport) {
    return [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        `--window-size=${viewport.width},${viewport.height}`,
        '--virtual-time-budget=2000',
        `--screenshot=${outputPath}`,
        url
    ];
}

async function captureScreenshot(browserCommand, url, outputPath, viewport) {
    const result = await safeExecFile(browserCommand, chromeArgsForScreenshot(url, outputPath, viewport), {
        timeout: 90000
    });

    if (!result.ok) {
        return {
            ok: false,
            error: truncateText(`${result.stdout}\n${result.stderr}`.trim(), 4000)
        };
    }

    return {
        ok: true,
        file_path: outputPath
    };
}

async function pickRepresentativeContentRoute(contentType) {
    const directoryMap = {
        blog: path.join(repoRoot, 'src', 'content', 'blog'),
        notes: path.join(repoRoot, 'src', 'content', 'notes'),
        pages: path.join(repoRoot, 'src', 'content', 'pages'),
        projects: path.join(repoRoot, 'src', 'content', 'projects')
    };
    const targetDirectory = directoryMap[contentType];
    if (!targetDirectory) {
        return '';
    }

    const files = await fs.readdir(targetDirectory).catch(() => []);
    const firstFile = files
        .filter((file) => file.endsWith('.md') || file.endsWith('.mdx'))
        .sort()[0];

    if (!firstFile) {
        return '';
    }

    const slug = firstFile.replace(/\.(md|mdx)$/, '');
    if (contentType === 'blog') {
        return `/blog/${slug}/`;
    }
    if (contentType === 'notes') {
        return `/notes/${slug}/`;
    }
    if (contentType === 'projects') {
        return `/projects/${slug}/`;
    }

    return `/${slug}/`;
}

async function inferRoutesFromFiles(changedFiles, maxRoutes) {
    const routes = [];
    let hasGlobalUiChange = false;

    for (const file of cleanArray(changedFiles)) {
        if (file === 'src/pages/index.astro') {
            routes.push('/');
            continue;
        }

        if (file.startsWith('src/content/blog/')) {
            routes.push(`/blog/${path.basename(file).replace(/\.(md|mdx)$/, '')}/`);
            continue;
        }

        if (file.startsWith('src/content/projects/')) {
            routes.push(`/projects/${path.basename(file).replace(/\.(md|mdx)$/, '')}/`);
            continue;
        }

        if (file.startsWith('src/content/notes/')) {
            routes.push(`/notes/${path.basename(file).replace(/\.(md|mdx)$/, '')}/`);
            continue;
        }

        if (file.startsWith('src/content/pages/')) {
            routes.push(`/${path.basename(file).replace(/\.(md|mdx)$/, '')}/`);
            continue;
        }

        if (
            file.startsWith('src/components/') ||
            file.startsWith('src/layouts/') ||
            file.startsWith('src/styles/') ||
            file.startsWith('src/pages/') ||
            file.startsWith('src/data/')
        ) {
            hasGlobalUiChange = true;
        }
    }

    if (hasGlobalUiChange) {
        routes.push('/');
        routes.push('/about/');
        const representativeBlog = await pickRepresentativeContentRoute('blog');
        if (representativeBlog) {
            routes.push(representativeBlog);
        }
    }

    return cleanArray(routes.map(normalizeRoute)).slice(0, maxRoutes);
}

async function collectVisualEvidence({ enabled, routes, maxRoutes }) {
    if (!enabled) {
        return {
            enabled: false,
            images: [],
            summary: 'Visual review is disabled by configuration.'
        };
    }

    const normalizedRoutes = cleanArray(routes.map(normalizeRoute)).slice(0, maxRoutes);
    if (normalizedRoutes.length === 0) {
        return {
            enabled: false,
            images: [],
            summary: 'No visual review routes were provided for this round.'
        };
    }

    const browserCommand = await detectVisualBrowser();
    if (!browserCommand) {
        return {
            enabled: false,
            images: [],
            summary: 'No supported headless browser was found for screenshot capture.'
        };
    }

    const distRoot = path.join(repoRoot, 'dist');
    const distStats = await fs.stat(distRoot).catch(() => null);
    if (!distStats?.isDirectory()) {
        return {
            enabled: false,
            images: [],
            summary: 'The dist/ directory is missing, so screenshot capture could not run.'
        };
    }

    const tempDirectory = await fs.mkdtemp(path.join('/tmp', 'agent-pair-visual-'));
    const server = await startStaticServer(distRoot).catch((error) => ({
        error: error instanceof Error ? error.message : String(error)
    }));

    if ('error' in server) {
        return {
            enabled: false,
            images: [],
            summary: `Visual review server could not start: ${server.error}`
        };
    }

    const images = [];
    const errors = [];

    try {
        for (let index = 0; index < normalizedRoutes.length; index += 1) {
            const route = normalizedRoutes[index];
            const viewports = index === 0 ? VISUAL_VIEWPORTS : [VISUAL_VIEWPORTS[0]];

            for (const viewport of viewports) {
                const outputPath = path.join(tempDirectory, `${String(index + 1).padStart(2, '0')}-${viewport.name}.png`);
                const targetUrl = new URL(route, server.baseUrl).toString();
                const screenshot = await captureScreenshot(browserCommand, targetUrl, outputPath, viewport);

                if (!screenshot.ok) {
                    errors.push(`${route} [${viewport.name}]: ${screenshot.error}`);
                    continue;
                }

                images.push({
                    route,
                    viewport: viewport.name,
                    file_path: screenshot.file_path
                });
            }
        }
    } finally {
        await server.close();
    }

    return {
        enabled: images.length > 0,
        images,
        summary: [
            `Visual review browser: ${browserCommand}`,
            `Review routes: ${normalizedRoutes.join(', ') || '[none]'}`,
            images.length > 0
                ? `Captured screenshots: ${images.map((item) => `${item.route} [${item.viewport}]`).join(', ')}`
                : 'Captured screenshots: [none]',
            errors.length > 0 ? `Capture issues: ${errors.join(' | ')}` : ''
        ]
            .filter(Boolean)
            .join('\n')
    };
}

function buildWriterPrompt({ task, round, reviewerFeedback, baselineWarning, buildCommand }) {
    return [
        'You are the writer agent for this repository.',
        `Repository root: ${repoRoot}`,
        `Current round: ${round}`,
        `Original user task: ${task}`,
        '',
        reviewerFeedback
            ? `Reviewer feedback from the previous round:\n${reviewerFeedback}`
            : 'There is no reviewer feedback yet. Start from the user task.',
        '',
        baselineWarning,
        '',
        'Execution requirements:',
        '- Modify the repository directly as needed.',
        '- Keep scope tight to the user task and reviewer feedback.',
        '- Respect the existing project structure and style.',
        `- Before finishing, make sure the repo should still pass this validation command: ${buildCommand}`,
        '- Include review_routes for the pages that should be visually checked after this round.',
        '- If the change is global UI, include representative routes rather than only one page.',
        '',
        'Structured response requirements:',
        '- summary: what changed and why',
        '- changed_files: repository-relative file paths changed this round',
        '- validation: what you checked yourself before finishing',
        '- review_routes: 1-3 concrete user-facing routes like /, /about/, /blog/some-post/',
        '- unresolved_risks: known limitations or remaining concerns'
    ].join('\n');
}

function buildReviewerPrompt({
    task,
    round,
    writerPrompt,
    writerSummary,
    buildResult,
    visualEvidence,
    baselineWarning
}) {
    return [
        'You are the reviewer agent for this repository.',
        `Repository root: ${repoRoot}`,
        `Current round: ${round}`,
        `Original user task: ${task}`,
        '',
        'Writer execution prompt:',
        writerPrompt,
        '',
        'Writer self-report:',
        writerSummary,
        '',
        baselineWarning,
        '',
        'Automatic validation result:',
        `Build command: ${buildResult.command}`,
        `Build ok: ${buildResult.ok}`,
        `Exit code: ${buildResult.exit_code}`,
        buildResult.stdout_tail ? `stdout:\n${buildResult.stdout_tail}` : 'stdout: [empty]',
        buildResult.stderr_tail ? `stderr:\n${buildResult.stderr_tail}` : 'stderr: [empty]',
        '',
        'Visual evidence:',
        visualEvidence.summary,
        '',
        'Review requirements:',
        '- Inspect the actual repo state and current diff; do not trust the writer summary alone.',
        '- Use attached screenshots when available to judge layout, typography, spacing, and responsiveness.',
        '- Block on correctness issues, broken builds, inconsistent content, or clearly weak layout.',
        '- If screenshots are missing or insufficient, say so in visual_limitations.',
        '',
        'Structured response requirements:',
        '- approved: true only if the current state is ready',
        '- summary: overall judgment',
        '- must_fix: blocking issues',
        '- nice_to_have: non-blocking suggestions',
        '- visual_summary: what the screenshots suggest visually',
        '- visual_limitations: honest limit statement'
    ].join('\n');
}

async function main() {
    await loadDotEnv();
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
        console.log(HELP_TEXT);
        return;
    }

    const task = await readTaskFromInput(options);
    if (!task) {
        console.error('Missing task.\n');
        console.error(HELP_TEXT);
        process.exit(1);
    }

    const writerModel = options.writerModel || process.env.CODEX_WRITER_MODEL || DEFAULT_WRITER_MODEL;
    const reviewerModel = options.reviewerModel || process.env.CODEX_REVIEWER_MODEL || DEFAULT_REVIEWER_MODEL;

    const startingStatus = await getGitStatusOutput();
    const baselineChangedFiles = await getChangedFiles();

    const baselineWarning = startingStatus
        ? `Warning: the repository already had local changes before the loop started.\n${startingStatus}`
        : 'The repository was clean when this loop started.';

    printSection(
        'Agent Pair',
        [
            `Writer model: ${writerModel}`,
            `Reviewer model: ${reviewerModel}`,
            `Use OSS provider: ${options.useOss}`,
            `Local provider: ${options.localProvider || '[default]'}`,
            `Max rounds: ${options.maxRounds}`,
            `Visual review enabled: ${options.visualReview}`,
            `Max review routes: ${options.maxReviewRoutes}`,
            `Build command: ${options.buildCommand}`,
            `Baseline changed files: ${baselineChangedFiles.length}`,
            `Task: ${task}`
        ].join('\n')
    );

    let reviewerFeedback = '';

    for (let round = 1; round <= options.maxRounds; round += 1) {
        printSection(`Round ${round}`, 'Writer turn started.');

        const writerPrompt = buildWriterPrompt({
            task,
            round,
            reviewerFeedback,
            baselineWarning,
            buildCommand: options.buildCommand
        });

        const writerResult = await runCodexAgent({
            role: 'writer',
            prompt: writerPrompt,
            schema: WRITER_SCHEMA,
            model: writerModel,
            useOss: options.useOss,
            localProvider: options.localProvider,
            sandbox: 'workspace-write',
            reasoningEffort: 'xhigh'
        });

        const buildResult = await runShellCommand(options.buildCommand);
        const currentChangedFiles = await getChangedFiles();
        const actualChangedFiles = cleanArray([
            ...writerResult.changed_files,
            ...subtractArray(currentChangedFiles, baselineChangedFiles)
        ]);

        const reviewRoutes = cleanArray(writerResult.review_routes).length > 0
            ? cleanArray(writerResult.review_routes).map(normalizeRoute).slice(0, options.maxReviewRoutes)
            : await inferRoutesFromFiles(actualChangedFiles, options.maxReviewRoutes);

        const visualEvidence = buildResult.ok
            ? await collectVisualEvidence({
                enabled: options.visualReview,
                routes: reviewRoutes,
                maxRoutes: options.maxReviewRoutes
            })
            : {
                enabled: false,
                images: [],
                summary: 'Build failed, so screenshot-based visual review was skipped.'
            };

        const writerSummary = [
            `Summary: ${writerResult.summary}`,
            `Changed files: ${actualChangedFiles.join(', ') || '[none]'}`,
            `Review routes: ${reviewRoutes.join(', ') || '[none]'}`,
            `Validation: ${writerResult.validation}`,
            `Unresolved risks: ${cleanArray(writerResult.unresolved_risks).join(' | ') || '[none]'}`
        ].join('\n');

        printSection('Writer Summary', writerSummary);
        printSection('Visual Evidence', visualEvidence.summary);

        const reviewerPrompt = buildReviewerPrompt({
            task,
            round,
            writerPrompt,
            writerSummary,
            buildResult: {
                ok: buildResult.ok,
                command: options.buildCommand,
                exit_code: buildResult.code,
                stdout_tail: truncateText(buildResult.stdout, 5000),
                stderr_tail: truncateText(buildResult.stderr, 5000)
            },
            visualEvidence,
            baselineWarning
        });

        const reviewResult = await runCodexAgent({
            role: 'reviewer',
            prompt: reviewerPrompt,
            schema: REVIEWER_SCHEMA,
            model: reviewerModel,
            useOss: options.useOss,
            localProvider: options.localProvider,
            sandbox: 'read-only',
            reasoningEffort: 'xhigh',
            images: visualEvidence.images.map((item) => item.file_path)
        });

        const mustFix = cleanArray(reviewResult.must_fix);
        const niceToHave = cleanArray(reviewResult.nice_to_have);
        const reviewSummary = [
            `Approved: ${Boolean(reviewResult.approved)}`,
            `Summary: ${reviewResult.summary}`,
            `Must fix: ${mustFix.join(' | ') || '[none]'}`,
            `Nice to have: ${niceToHave.join(' | ') || '[none]'}`,
            `Visual summary: ${reviewResult.visual_summary}`,
            `Visual limitations: ${reviewResult.visual_limitations}`
        ].join('\n');

        printSection('Reviewer Verdict', reviewSummary);

        if (reviewResult.approved) {
            console.log('\nReviewer approved the change. Loop finished.');
            return;
        }

        reviewerFeedback = [
            reviewResult.summary,
            mustFix.length ? `Blocking issues:\n- ${mustFix.join('\n- ')}` : 'No explicit blocking issues were listed.',
            niceToHave.length ? `Optional suggestions:\n- ${niceToHave.join('\n- ')}` : ''
        ]
            .filter(Boolean)
            .join('\n\n');
    }

    console.error('\nReached the max round limit without reviewer approval.');
    process.exit(2);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});

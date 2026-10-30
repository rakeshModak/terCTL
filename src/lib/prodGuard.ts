import type { IMarker, Terminal } from '@xterm/xterm';

/**
 * Production guard: decides whether a command line is one worth a second look
 * before it runs on a server marked as production, and holds the keystroke
 * that would run it until the user says yes.
 *
 * Deliberately a short list. Every rule here costs the user a click each time
 * it fires, so it covers commands that destroy data or take the box down and
 * nothing that is merely risky. Rules match the *command* position only —
 * `grep reboot app.log` names reboot as an argument and must not fire.
 *
 * It is a guard rail, not a lock: aliases, scripts, variables (`$CMD`) and
 * anything typed inside another program are out of its sight.
 */

/**
 * Words that run the command after them rather than being the command, each
 * with the options that take a value — so in `sudo -u deploy rm -rf x` the
 * command is `rm`, not `deploy`. Per wrapper because the same letter differs:
 * `sudo -E` is a flag, `xargs -E` takes one.
 */
const WRAPPERS: Record<string, string[]> = {
  sudo: ['-u', '-g', '-U', '-C', '-h', '-p', '-r', '-t', '-D', '-R', '-T'],
  doas: ['-u', '-C'],
  env: ['-u', '-C', '-S'],
  nohup: [],
  time: ['-o', '-f'],
  exec: ['-a'],
  command: [],
  builtin: [],
  nice: ['-n'],
  ionice: ['-c', '-n', '-p'],
  stdbuf: ['-i', '-o', '-e'],
  xargs: ['-I', '-L', '-P', '-d', '-s', '-E', '-n', '-a'],
  // `timeout [opts] DURATION cmd` — the duration is handled below.
  timeout: ['-s', '-k'],
};

/** Run their `-c` argument as a command line of its own. */
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish', 'su']);

const SQL_CLIENTS = new Set([
  'mysql',
  'mariadb',
  'psql',
  'sqlite3',
  'clickhouse-client',
]);

const DESTRUCTIVE_SQL = /\b(drop\s+(table|database|schema)|truncate)\b/i;

const POWER = 'Restarts or shuts down the server';
const DELETE = 'Deletes files and folders recursively';
const FORMAT = 'Formats a disk';
const RAW_WRITE = 'Writes raw data over a disk or file';
const FORCE_PUSH = 'Overwrites the remote branch history';
const SQL = 'Deletes database tables or data';
const HISTORY = 'Re-runs an earlier command from history, unseen';

/**
 * Splits a line into commands (on `;`, `&&`, `||`, `|`, `&`, parentheses and
 * backticks) and each command into words, honouring quotes and backslashes.
 * Not a shell parser — just enough that quoted text stays one argument and
 * `a && rm -rf b` yields `rm` in command position.
 */
export function splitCommands(line: string): string[][] {
  const commands: string[][] = [];
  let words: string[] = [];
  let word = '';
  let started = false;
  let quote: '"' | "'" | null = null;

  const endWord = () => {
    if (started) words.push(word);
    word = '';
    started = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length) commands.push(words);
    words = [];
  };

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"' && i + 1 < line.length)
        word += line[++i];
      else word += c;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      started = true;
    } else if (c === '\\' && i + 1 < line.length) {
      word += line[++i];
      started = true;
    } else if (c === ' ' || c === '\t') {
      endWord();
    } else if (';&|()`\n\r'.includes(c)) {
      endCommand();
    } else if (c === '#' && !started) {
      break; // the rest is a shell comment
    } else {
      word += c;
      started = true;
    }
  }
  endCommand();
  return commands;
}

const baseName = (w: string) => w.slice(w.lastIndexOf('/') + 1);

/** Drops `sudo -u x`, `env A=1`, `timeout 5`, `VAR=value` and friends from
 *  the front, leaving the command that actually runs. */
function stripWrappers(words: string[]): string[] {
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    const name = baseName(w);
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) {
      i++;
    } else if (Object.hasOwn(WRAPPERS, name)) {
      i++;
      while (i < words.length && words[i].startsWith('-')) {
        // `command -v rm` looks rm up rather than running it.
        if (name === 'command' && /^-[vV]$/.test(words[i])) return [];
        if (WRAPPERS[name].includes(words[i])) i++;
        i++;
      }
      if (name === 'timeout') i++; // the duration
    } else {
      break;
    }
  }
  return words.slice(i);
}

/** `-rf`, `-fR`, `-r` — a short-option cluster that contains any of `letters`. */
const hasShortFlag = (args: string[], letters: string) =>
  args.some(
    (a) =>
      /^-[A-Za-z]+$/.test(a) &&
      [...letters].some((l) => a.slice(1).includes(l)),
  );

function checkCommand(words: string[], depth: number): string | null {
  const [head, ...args] = stripWrappers(words);
  if (!head) return null;
  const cmd = baseName(head);

  // `!!`, `!-2`, `!rm`, `sudo !!`: the shell swaps in a past command that
  // never appears on screen, so there is nothing to judge but the risk.
  if (/^!(!|-?\d|[A-Za-z])/.test(head)) return HISTORY;

  switch (cmd) {
    case 'rm':
      return hasShortFlag(args, 'rR') || args.includes('--recursive')
        ? DELETE
        : null;
    case 'find':
      if (args.includes('-delete')) return DELETE;
      for (const flag of ['-exec', '-execdir', '-ok', '-okdir']) {
        const at = args.indexOf(flag);
        if (at >= 0 && depth < 3) {
          const reason = checkCommand(args.slice(at + 1), depth + 1);
          if (reason) return reason;
        }
      }
      return null;
    case 'reboot':
    case 'poweroff':
    case 'halt':
      return POWER;
    case 'shutdown':
      // `shutdown -c` cancels a pending shutdown — the opposite of risky.
      return args.includes('-c') ? null : POWER;
    case 'init':
    case 'telinit':
      return args[0] === '0' || args[0] === '6' ? POWER : null;
    case 'systemctl':
      return args.some((a) =>
        ['reboot', 'poweroff', 'halt', 'kexec'].includes(a),
      )
        ? POWER
        : null;
    case 'mke2fs':
      return FORMAT;
    case 'dd':
      return args.some((a) => a.startsWith('of=')) ? RAW_WRITE : null;
    case 'fc':
      // `fc -s` re-runs the last command without showing it.
      return args.includes('-s') ? HISTORY : null;
    case 'git': {
      // Skip git's own options (`git -C dir push`) to find the subcommand.
      let i = 0;
      while (i < args.length && args[i].startsWith('-')) {
        if (args[i] === '-C' || args[i] === '-c') i++;
        i++;
      }
      if (args[i] !== 'push') return null;
      const pushArgs = args.slice(i + 1);
      // --force-with-lease refuses to clobber work it hasn't seen, so it
      // stays quiet; plain --force and -f don't.
      return pushArgs.includes('--force') || hasShortFlag(pushArgs, 'f')
        ? FORCE_PUSH
        : null;
    }
  }

  // `bash -c 'rm -rf x'`, `su -c 'reboot'`: the real command is an argument.
  if (SHELLS.has(cmd) && depth < 3) {
    const at = args.indexOf('-c');
    if (at >= 0 && at + 1 < args.length) {
      return riskyAt(args[at + 1], depth + 1);
    }
  }
  if (cmd.startsWith('mkfs')) return FORMAT;
  // A line typed at a mysql> or psql prompt: the SQL keyword is the command.
  if (/^(drop|truncate)$/i.test(cmd)) return SQL;
  if (SQL_CLIENTS.has(cmd) && args.some((a) => DESTRUCTIVE_SQL.test(a)))
    return SQL;
  return null;
}

function riskyAt(line: string, depth: number): string | null {
  const commands = splitCommands(line);
  for (const words of commands) {
    const reason = checkCommand(words, depth);
    if (reason) return reason;
  }
  // `echo "DROP TABLE x" | mysql` — the SQL travels through a pipe, so the
  // client has no argument to inspect. Any SQL client on the line opens up
  // the whole line to the SQL check.
  if (
    commands.some((w) =>
      SQL_CLIENTS.has(baseName(stripWrappers(w)[0] ?? '')),
    ) &&
    DESTRUCTIVE_SQL.test(line)
  ) {
    return SQL;
  }
  return null;
}

/**
 * Why `line` needs confirming, or null when it can run straight away. Checks
 * every command on the line, so `cd /srv && rm -rf build` is caught.
 */
export function riskyCommand(line: string): string | null {
  return riskyAt(line, 0);
}

/** Characters that end a shell prompt — `$`, `#`, `%`, `>`, the glyphs
 *  popular zsh themes use — and the `': ` of bash's reverse-i-search. */
const PROMPT_END = /(?:[$#%>❯➜»✗λ]|':)\s/g;

/**
 * Readings of a screen line whose prompt end isn't known
 * (`user@box:~$ rm -rf x`): the line itself, then the rest after each
 * prompt-ending character. Over-reading only costs a rare extra prompt;
 * under-reading would miss one.
 */
export function screenReadings(line: string): string[] {
  const out = [line];
  for (const m of line.matchAll(PROMPT_END)) {
    out.push(line.slice(m.index + m[0].length));
  }
  return out;
}

export function riskyScreenLine(line: string): string | null {
  for (const reading of screenReadings(line)) {
    const reason = riskyCommand(reading);
    if (reason) return reason;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Input guard
// ---------------------------------------------------------------------------

/** Keys that make a shell run the line: Enter, Ctrl+J, Ctrl+O (bash's
 *  operate-and-get-next), and keypad Enter in application keypad mode. */
const RUN_KEYS = new Set(['\r', '\n', '\x0f', '\x1bOM']);
const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';
/** Ctrl+C, Ctrl+D, Ctrl+L: the shell abandons or redraws the line. */
const LINE_RESETS = new Set(['\x03', '\x04', '\x0c']);
const MAX_SHOWN = 160;

const stripPasteMarks = (data: string) =>
  data.replaceAll(PASTE_START, '').replaceAll(PASTE_END, '');

const printable = (data: string) =>
  [...data].filter((c) => c >= ' ' && c !== '\x7f').join('');

/** Cursor-position and device-attribute reports, OSC and DCS answers. */
const isTerminalReply = (data: string) =>
  (data.startsWith('\x1b[') && /^\[[\d;?>]*[Rcn]$/.test(data.slice(1))) ||
  data.startsWith('\x1b]') ||
  data.startsWith('\x1bP');

/** A line ending in an unescaped backslash continues on the next one. */
const continues = (line: string) => /(^|[^\\])(\\\\)*\\$/.test(line);

export interface HeldCommand {
  /** The command as shown to the user, trimmed and shortened. */
  line: string;
  reason: string;
}

/**
 * Sits between xterm and the session, holding back a keystroke or paste that
 * would run a destructive command until `confirm` resolves true. When
 * `guarded()` is false everything passes straight through, so a host that
 * isn't marked production pays one function call per keystroke.
 *
 * What the shell is about to run is read two ways, and either can trip it:
 *  - from the screen, which already reflects ↑ history and Tab completion;
 *  - from the keys typed since the prompt, which covers fast typing whose
 *    echo hasn't come back from the server yet.
 *
 * Full-screen programs use the alternate buffer, where the line under the
 * cursor isn't a shell line — but tmux and screen do too, and production
 * shells often live inside them. There, only the typed keys are checked.
 */
export function createInputGuard(
  term: Pick<Terminal, 'buffer' | 'registerMarker'>,
  send: (data: string) => void,
  guarded: () => boolean,
  confirm: (held: HeldCommand) => Promise<boolean>,
) {
  // Where the user's input began: the cursor position at the first keystroke
  // after a prompt, i.e. just past the prompt. A marker rather than a row
  // number, so it follows the line as output scrolls and scrollback trims.
  let start: { marker: IMarker | undefined; col: number } | null = null;
  let typed = '';
  // Earlier lines of a command continued with a trailing backslash.
  let carried = '';
  let holding = false;
  // Keys pressed while the dialog is up, sent in order once it closes.
  let queued: string[] = [];

  const resetLine = () => {
    start?.marker?.dispose();
    start = null;
    typed = '';
  };
  const reset = () => {
    resetLine();
    carried = '';
  };

  /** The line the shell is holding, read off the screen: the part after the
   *  prompt when the prompt's end is known, and the whole logical line. */
  const screenLine = () => {
    const buf = term.buffer.active;
    const row = buf.baseY + buf.cursorY;
    let first = row;
    while (first > 0 && buf.getLine(first)?.isWrapped) first--;
    let last = row;
    while (buf.getLine(last + 1)?.isWrapped) last++;
    const text = (from: number, col: number) => {
      let out = '';
      for (let r = from; r <= last; r++) {
        out +=
          buf.getLine(r)?.translateToString(r === last, r === from ? col : 0) ??
          '';
      }
      return out;
    };
    // A start marker on a different logical line is stale — Tab listing
    // candidates, for one, redraws the prompt further down.
    const marker = start?.marker;
    const afterPrompt =
      start &&
      marker &&
      !marker.isDisposed &&
      marker.line >= first &&
      marker.line <= row
        ? text(marker.line, start.col)
        : null;
    return { afterPrompt, full: text(first, 0) };
  };

  /** Everything that might be the line the shell is holding right now. */
  const readings = (): string[] => {
    if (term.buffer.active.type === 'alternate') return [typed];
    const { afterPrompt, full } = screenLine();
    return [
      ...(afterPrompt !== null ? [afterPrompt] : []),
      ...screenReadings(full),
      typed,
    ];
  };

  const check = (suffix = ''): HeldCommand | null => {
    for (const reading of readings()) {
      const line = carried + reading + suffix;
      const reason = riskyCommand(line);
      if (reason) {
        const shown = line.trim();
        return {
          reason,
          line:
            shown.length > MAX_SHOWN ? `${shown.slice(0, MAX_SHOWN)}…` : shown,
        };
      }
    }
    return null;
  };

  /** What to remember about a line once it has been sent with a run key. */
  const afterRun = () => {
    // Not the whole screen line: carried text must be command only, with no
    // prompt in front of it.
    const current =
      (term.buffer.active.type === 'alternate'
        ? null
        : screenLine().afterPrompt) ?? typed;
    const next = continues(current.trimEnd())
      ? carried + current.trimEnd().slice(0, -1) + ' '
      : '';
    reset();
    carried = next;
  };

  const hold = (held: HeldCommand, data: string) => {
    holding = true;
    void confirm(held).then((ok) => {
      holding = false;
      // Cancel sends nothing and leaves the line as typed, so a slip can be
      // fixed rather than retyped. Running it again asks again.
      if (ok) {
        send(data);
        afterRun();
      }
      const rest = queued;
      queued = [];
      for (const d of rest) input(d);
    });
  };

  function input(data: string) {
    if (!guarded()) {
      if (start || typed || carried) reset();
      send(data);
      return;
    }
    if (holding) {
      // Usually terminal replies to the server's queries; the user's keys go
      // to the dialog. Queued, not dropped, so a program waiting on a reply
      // isn't left hanging, and not sent early, so order is kept.
      queued.push(data);
      return;
    }

    // Alt+Enter arrives as ESC + Enter; treat it as the Enter it ends in.
    if (
      RUN_KEYS.has(data) ||
      (data[0] === '\x1b' && RUN_KEYS.has(data.slice(1)))
    ) {
      const held = check();
      if (held) return hold(held, data);
      send(data);
      afterRun();
      return;
    }

    // A paste with a newline in it runs lines without a run key.
    if (data.length > 1 && /[\r\n]/.test(data)) {
      const lines = stripPasteMarks(data).split(/\r\n?|\n/);
      const held =
        check(lines[0]) ??
        lines
          .slice(1)
          .map((line): HeldCommand | null => {
            const reason = riskyCommand(line);
            return reason ? { reason, line: line.trim() } : null;
          })
          .find(Boolean) ??
        null;
      if (held) return hold(held, data);
      send(data);
      reset();
      return;
    }

    if (LINE_RESETS.has(data)) {
      send(data);
      reset();
      return;
    }

    // Only a key the user pressed marks where input began, not the
    // terminal's own replies to the server (cursor reports, device
    // attributes, OSC answers), which can arrive before the prompt is drawn.
    if (!start && !isTerminalReply(data)) {
      start = {
        marker: term.registerMarker(0),
        col: term.buffer.active.cursorX,
      };
    }
    if (data === '\x7f' || data === '\b') typed = typed.slice(0, -1);
    else if (data === '\x15')
      typed = ''; // Ctrl+U
    else if (!data.startsWith('\x1b') || data.startsWith(PASTE_START))
      typed += printable(stripPasteMarks(data));
    send(data);
  }

  return { input, dispose: reset };
}

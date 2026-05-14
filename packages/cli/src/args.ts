import type { CliCommand, CliFormat, CliOptions, CliParseResult } from "./types.js";
import { usageError } from "./usage.js";

const COMMANDS = new Set<CliCommand>([
  "diagnostics",
  "search",
  "read",
  "read-folder",
  "create-preview",
  "create",
  "append-preview",
  "append",
  "help"
]);

const BOOLEAN_FLAGS = new Set(["json", "help", "h"]);
const VALUE_FLAGS = new Set([
  "query",
  "q",
  "folder",
  "account",
  "limit",
  "id",
  "title",
  "body",
  "content",
  "separator"
]);

export function parseCliArgs(argv: string[]): CliParseResult {
  const options: CliOptions = {};
  let format: CliFormat = "text";
  let command: CliCommand | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === undefined) {
      continue;
    }

    if (token === "--") {
      return {
        ok: false,
        format,
        exitCode: 2,
        error: usageError("Unexpected positional arguments after --.")
      };
    }

    if (token.startsWith("--")) {
      const parsed = parseLongFlag(token);
      if (!parsed.ok) {
        return usageFailure(format, parsed.message);
      }

      if (BOOLEAN_FLAGS.has(parsed.name)) {
        options[parsed.name] = true;
        if (parsed.name === "json") {
          format = "json";
        }
        continue;
      }

      if (!VALUE_FLAGS.has(parsed.name)) {
        return usageFailure(format, `Unknown option --${parsed.name}.`);
      }

      const inlineValue = parsed.value;
      if (inlineValue !== undefined) {
        options[canonicalFlagName(parsed.name)] = inlineValue;
        continue;
      }

      const next = argv[index + 1];
      if (next === undefined || next.startsWith("-")) {
        return usageFailure(format, `Option --${parsed.name} requires a value.`);
      }

      options[canonicalFlagName(parsed.name)] = next;
      index += 1;
      continue;
    }

    if (token.startsWith("-")) {
      if (token === "-h") {
        options.help = true;
        continue;
      }

      if (token === "-q") {
        const next = argv[index + 1];
        if (next === undefined || next.startsWith("-")) {
          return usageFailure(format, "Option -q requires a value.");
        }
        options.query = next;
        index += 1;
        continue;
      }

      return usageFailure(format, `Unknown option ${token}.`);
    }

    if (command !== undefined) {
      return usageFailure(format, `Unexpected positional argument ${token}.`);
    }

    if (!COMMANDS.has(token as CliCommand)) {
      return usageFailure(format, `Unknown command ${token}.`);
    }

    command = token as CliCommand;
  }

  if (options.help === true || options.h === true) {
    return {
      ok: true,
      request: {
        command: "help",
        format,
        options
      }
    };
  }

  if (command === undefined) {
    return usageFailure(format, "Command is required.");
  }

  return {
    ok: true,
    request: {
      command,
      format,
      options
    }
  };
}

function parseLongFlag(token: string):
  | {
      ok: true;
      name: string;
      value?: string;
    }
  | {
      ok: false;
      message: string;
    } {
  const raw = token.slice(2);
  if (raw.length === 0) {
    return {
      ok: false,
      message: "Empty option name."
    };
  }

  const equalsIndex = raw.indexOf("=");
  if (equalsIndex === -1) {
    return {
      ok: true,
      name: raw
    };
  }

  return {
    ok: true,
    name: raw.slice(0, equalsIndex),
    value: raw.slice(equalsIndex + 1)
  };
}

function canonicalFlagName(name: string): string {
  if (name === "q") {
    return "query";
  }

  return name;
}

function usageFailure(format: CliFormat, message: string): CliParseResult {
  return {
    ok: false,
    format,
    exitCode: 2,
    error: usageError(message)
  };
}

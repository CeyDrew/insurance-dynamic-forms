import { ExpressionError } from './expression-error';

export type TokenType = 'number' | 'string' | 'identifier' | 'operator' | 'eof';

export interface Token {
  type: TokenType;
  /** Source text of the token (for strings, including the quotes). */
  text: string;
  /** Parsed value for number and string tokens. */
  value?: number | string;
  offset: number;
}

const TWO_CHAR_OPERATORS = ['==', '!=', '<=', '>=', '&&', '||'];
const ONE_CHAR_OPERATORS = '()+-*/%<>!,';
const ESCAPES: Record<string, string> = { '\\': '\\', "'": "'", '"': '"', n: '\n', t: '\t' };
const HINTS: Record<string, string> = { '=': '==', '&': '&&', '|': '||' };

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';
const isIdentStart = (c: string | undefined) =>
  c !== undefined && ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_');
const isIdentPart = (c: string | undefined) => isIdentStart(c) || isDigit(c);
const isWhitespace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

/** Splits the whole source into tokens, ending with an `eof` token. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  const fail = (message: string, offset: number): never => {
    throw new ExpressionError(message, 'syntax', source, offset);
  };

  const readString = (quote: string): Token => {
    const start = pos;
    pos++;
    let value = '';
    while (pos < source.length) {
      const ch = source[pos];
      if (ch === quote) {
        pos++;
        return { type: 'string', text: source.slice(start, pos), value, offset: start };
      }
      if (ch === '\\') {
        const next = source[pos + 1];
        const escaped = next === undefined ? undefined : ESCAPES[next];
        if (escaped === undefined) {
          fail(`Geçersiz kaçış dizisi '\\${next ?? ''}'`, pos);
        }
        value += escaped;
        pos += 2;
      } else {
        value += ch;
        pos++;
      }
    }
    return fail('Kapanmamış metin', start);
  };

  while (pos < source.length) {
    const c = source[pos];
    const start = pos;
    if (isWhitespace(c)) {
      pos++;
    } else if (isDigit(c)) {
      while (isDigit(source[pos])) pos++;
      if (source[pos] === '.' && isDigit(source[pos + 1])) {
        pos++;
        while (isDigit(source[pos])) pos++;
      }
      const text = source.slice(start, pos);
      tokens.push({ type: 'number', text, value: Number(text), offset: start });
    } else if (c === "'" || c === '"') {
      tokens.push(readString(c));
    } else if (isIdentStart(c)) {
      while (isIdentPart(source[pos])) pos++;
      tokens.push({ type: 'identifier', text: source.slice(start, pos), offset: start });
    } else {
      const two = source.slice(pos, pos + 2);
      if (TWO_CHAR_OPERATORS.includes(two)) {
        tokens.push({ type: 'operator', text: two, offset: start });
        pos += 2;
      } else if (ONE_CHAR_OPERATORS.includes(c)) {
        tokens.push({ type: 'operator', text: c, offset: start });
        pos++;
      } else if (HINTS[c]) {
        fail(`'${c}' yerine '${HINTS[c]}' kullanın`, start);
      } else {
        fail(`Beklenmeyen karakter '${c}'`, start);
      }
    }
  }
  tokens.push({ type: 'eof', text: '', offset: source.length });
  return tokens;
}

import { BinaryOperator, ExpressionNode } from './ast';
import { ExpressionError, ExpressionErrorKind } from './expression-error';
import { arityText, FUNCTIONS, isFunctionName } from './functions';
import { Token, tokenize } from './tokenizer';

/** Precedence levels of binary operators, lowest first. */
const LEVELS: BinaryOperator[][] = [
  ['||'],
  ['&&'],
  ['==', '!='],
  ['<', '<=', '>', '>='],
  ['+', '-'],
  ['*', '/', '%'],
];

/** Recursive descent parser; grammar in `docs/rule-language.md`. */
export function parseExpression(source: string): ExpressionNode {
  const tokens = tokenize(source);
  let index = 0;

  const peek = () => tokens[index];
  const next = () => tokens[index++];
  const isOperator = (token: Token, ...ops: string[]) =>
    token.type === 'operator' && ops.includes(token.text);
  const fail = (message: string, token: Token, kind: ExpressionErrorKind = 'syntax'): never => {
    throw new ExpressionError(message, kind, source, token.offset);
  };
  const found = (token: Token) => (token.type === 'eof' ? 'ifade bitti' : `'${token.text}' bulundu`);

  const binary = (level: number): ExpressionNode => {
    if (level === LEVELS.length) return unary();
    let left = binary(level + 1);
    while (isOperator(peek(), ...LEVELS[level])) {
      const op = next();
      const right = binary(level + 1);
      left = { kind: 'binary', operator: op.text as BinaryOperator, left, right, offset: op.offset };
    }
    return left;
  };

  const unary = (): ExpressionNode => {
    const token = peek();
    if (isOperator(token, '!', '-')) {
      next();
      const operator = token.text as '!' | '-';
      return { kind: 'unary', operator, operand: unary(), offset: token.offset };
    }
    return primary();
  };

  const primary = (): ExpressionNode => {
    const token = next();
    if (token.type === 'number' || token.type === 'string') {
      return { kind: 'literal', value: token.value!, offset: token.offset };
    }
    if (token.type === 'identifier') {
      if (token.text === 'true' || token.text === 'false') {
        return { kind: 'literal', value: token.text === 'true', offset: token.offset };
      }
      if (token.text === 'null') {
        return { kind: 'literal', value: null, offset: token.offset };
      }
      if (isOperator(peek(), '(')) {
        return call(token);
      }
      return { kind: 'variable', name: token.text, offset: token.offset };
    }
    if (isOperator(token, '(')) {
      const inner = binary(0);
      expectClose();
      return inner;
    }
    return fail(`Değer bekleniyordu, ${found(token)}`, token);
  };

  const call = (nameToken: Token): ExpressionNode => {
    const name = nameToken.text;
    if (!isFunctionName(name)) {
      return fail(`Bilinmeyen fonksiyon '${name}'`, nameToken, 'unknownFunction');
    }
    next(); // the opening parenthesis
    const args: ExpressionNode[] = [];
    if (!isOperator(peek(), ')')) {
      args.push(binary(0));
      while (isOperator(peek(), ',')) {
        next();
        args.push(binary(0));
      }
    }
    expectClose();
    const { minArgs, maxArgs } = FUNCTIONS[name];
    if (args.length < minArgs || args.length > maxArgs) {
      fail(`'${name}' fonksiyonu ${arityText(name)}, ${args.length} verildi`, nameToken, 'arity');
    }
    return { kind: 'call', name, args, offset: nameToken.offset };
  };

  const expectClose = () => {
    const token = next();
    if (!isOperator(token, ')')) {
      fail(`')' bekleniyordu, ${found(token)}`, token);
    }
  };

  if (peek().type === 'eof') {
    throw new ExpressionError('İfade boş', 'syntax', source, 0);
  }
  const ast = binary(0);
  const rest = peek();
  if (rest.type !== 'eof') {
    fail(`Beklenmeyen '${rest.text}'`, rest);
  }
  return ast;
}

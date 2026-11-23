import { ExpressionNode } from './ast';
import { evaluate, EvaluationContext } from './evaluator';
import { parseExpression } from './parser';
import { Value } from './value';

/** A parsed expression with the field names it reads. */
export interface CompiledExpression {
  readonly source: string;
  readonly ast: ExpressionNode;
  /** Field ids referenced anywhere in the expression, sorted. */
  readonly variables: readonly string[];
  evaluate(context: EvaluationContext): Value;
}

/** Parses `source`; throws `ExpressionError` with line and column if it is invalid. */
export function compileExpression(source: string): CompiledExpression {
  const ast = parseExpression(source);
  const variables = [...collectVariables(ast, new Set<string>())].sort();
  return { source, ast, variables, evaluate: (context) => evaluate(ast, context) };
}

function collectVariables(node: ExpressionNode, into: Set<string>): Set<string> {
  switch (node.kind) {
    case 'variable':
      into.add(node.name);
      break;
    case 'unary':
      collectVariables(node.operand, into);
      break;
    case 'binary':
      collectVariables(node.left, into);
      collectVariables(node.right, into);
      break;
    case 'call':
      node.args.forEach((arg) => collectVariables(arg, into));
      break;
  }
  return into;
}

/** `YYYY-MM-DD` for the local date of `now`. */
export function isoToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

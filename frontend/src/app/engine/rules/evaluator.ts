import { ExpressionNode } from './ast';
import { FunctionContext, FUNCTIONS } from './functions';
import { isTruthy, Value, valuesEqual } from './value';

export interface EvaluationContext extends FunctionContext {
  /** Current value of a field; `undefined` is read as `null`. */
  read(name: string): unknown;
}

type BinaryNode = Extract<ExpressionNode, { kind: 'binary' }>;
type CallableFunction = (args: Value[], context: FunctionContext) => Value;

const isNumber = (v: Value): v is number => typeof v === 'number';

/** Interprets a parsed expression. Never throws: invalid operations yield `null`. */
export function evaluate(node: ExpressionNode, context: EvaluationContext): Value {
  switch (node.kind) {
    case 'literal':
      return node.value;
    case 'variable':
      return (context.read(node.name) ?? null) as Value;
    case 'unary': {
      const operand = evaluate(node.operand, context);
      if (node.operator === '!') {
        return !isTruthy(operand);
      }
      return isNumber(operand) ? -operand : null;
    }
    case 'binary':
      return binary(node, context);
    case 'call': {
      const args = node.args.map((arg) => evaluate(arg, context));
      return (FUNCTIONS[node.name].call as CallableFunction)(args, context);
    }
  }
}

function binary(node: BinaryNode, context: EvaluationContext): Value {
  // Short-circuit: the right side is not read, so it does not become a signal dependency.
  if (node.operator === '&&') {
    return isTruthy(evaluate(node.left, context)) && isTruthy(evaluate(node.right, context));
  }
  if (node.operator === '||') {
    return isTruthy(evaluate(node.left, context)) || isTruthy(evaluate(node.right, context));
  }
  const a = evaluate(node.left, context);
  const b = evaluate(node.right, context);
  switch (node.operator) {
    case '==':
      return valuesEqual(a, b);
    case '!=':
      return !valuesEqual(a, b);
    case '<':
    case '<=':
    case '>':
    case '>=':
      return compare(node.operator, a, b);
    case '+':
      if (isNumber(a) && isNumber(b)) return a + b;
      if (typeof a === 'string' && typeof b === 'string') return a + b;
      return null;
    default:
      return arithmetic(node.operator, a, b);
  }
}

function compare(operator: '<' | '<=' | '>' | '>=', a: Value, b: Value): boolean {
  const comparable = (isNumber(a) && isNumber(b)) || (typeof a === 'string' && typeof b === 'string');
  if (!comparable) {
    return false;
  }
  const [x, y] = [a as number | string, b as number | string];
  switch (operator) {
    case '<':
      return x < y;
    case '<=':
      return x <= y;
    case '>':
      return x > y;
    case '>=':
      return x >= y;
  }
}

function arithmetic(operator: '-' | '*' | '/' | '%', a: Value, b: Value): Value {
  if (!isNumber(a) || !isNumber(b)) {
    return null;
  }
  switch (operator) {
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b === 0 ? null : a / b;
    case '%':
      return b === 0 ? null : a % b;
  }
}

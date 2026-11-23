import { FunctionName } from './functions';
import { Value } from './value';

export type BinaryOperator =
  | '||'
  | '&&'
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | '+'
  | '-'
  | '*'
  | '/'
  | '%';

export type ExpressionNode =
  | { kind: 'literal'; value: Value; offset: number }
  | { kind: 'variable'; name: string; offset: number }
  | { kind: 'unary'; operator: '!' | '-'; operand: ExpressionNode; offset: number }
  | {
      kind: 'binary';
      operator: BinaryOperator;
      left: ExpressionNode;
      right: ExpressionNode;
      offset: number;
    }
  | { kind: 'call'; name: FunctionName; args: ExpressionNode[]; offset: number };

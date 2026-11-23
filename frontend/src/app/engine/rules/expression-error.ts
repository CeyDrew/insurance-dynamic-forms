export type ExpressionErrorKind = 'syntax' | 'unknownFunction' | 'arity';

/** A rule expression could not be parsed. `line` and `column` are 1-based. */
export class ExpressionError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(
    message: string,
    readonly kind: ExpressionErrorKind,
    source: string,
    readonly offset: number,
  ) {
    super(message);
    this.name = 'ExpressionError';
    const before = source.slice(0, offset);
    const lastBreak = before.lastIndexOf('\n');
    this.line = before.split('\n').length;
    this.column = offset - lastBreak;
  }
}

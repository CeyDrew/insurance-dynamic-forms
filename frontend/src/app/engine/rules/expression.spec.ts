import fixture from '../../../../../fixtures/expression-cases.json';
import { compileExpression } from './expression';
import { ExpressionError } from './expression-error';

/** Shared with the Java engine: both must produce exactly these results. */
interface Fixture {
  today: string;
  evaluate: { expression: string; vars?: Record<string, unknown>; result: unknown }[];
  errors: { expression: string; kind: string; message: string; line: number; column: number }[];
  dependencies: { expression: string; variables: string[] }[];
}

const cases = fixture as Fixture;

function evaluate(expression: string, vars: Record<string, unknown> = {}) {
  return compileExpression(expression).evaluate({ read: (name) => vars[name], today: cases.today });
}

describe('expression engine (shared fixture)', () => {
  it.each(cases.evaluate.map((c) => [c.expression, c.vars ?? {}, c.result] as const))(
    '%j with %j = %j',
    (expression, vars, result) => {
      expect(evaluate(expression, vars)).toEqual(result);
    },
  );

  it.each(cases.errors.map((c) => [c.expression, c] as const))('rejects %j', (expression, expected) => {
    let error: unknown;
    try {
      compileExpression(expression);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ExpressionError);
    const { kind, message, line, column } = error as ExpressionError;
    expect({ kind, message, line, column }).toEqual({
      kind: expected.kind,
      message: expected.message,
      line: expected.line,
      column: expected.column,
    });
  });

  it.each(cases.dependencies.map((c) => [c.expression, c.variables] as const))(
    '%j reads %j',
    (expression, variables) => {
      expect(compileExpression(expression).variables).toEqual(variables);
    },
  );
});

describe('expression engine', () => {
  it('only reads the variables it needs (short-circuit)', () => {
    const read = vi.fn((name: string) => ({ a: false, b: true })[name]);

    compileExpression('a && b').evaluate({ read, today: cases.today });

    expect(read.mock.calls.map(([name]) => name)).toEqual(['a']);
  });

  it('never throws while evaluating odd input', () => {
    const odd = [undefined, null, NaN, {}, [], 'x', -0, [null], { a: undefined }];
    const expression = compileExpression(
      'round(a / b, c) + len(a) - count(b) * daysBetween(a, c) % age(b) || contains(a, b) && !isEmpty(c)',
    );

    for (const a of odd) {
      for (const b of odd) {
        for (const c of odd) {
          const vars: Record<string, unknown> = { a, b, c };
          expect(() => expression.evaluate({ read: (n) => vars[n], today: cases.today })).not.toThrow();
        }
      }
    }
  });
});

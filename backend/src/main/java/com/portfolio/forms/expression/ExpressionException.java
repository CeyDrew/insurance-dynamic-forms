package com.portfolio.forms.expression;

/** A rule expression could not be parsed. {@code line} and {@code column} are 1-based. */
public class ExpressionException extends RuntimeException {

	public enum Kind {
		SYNTAX("syntax"), UNKNOWN_FUNCTION("unknownFunction"), ARITY("arity");

		private final String fixtureName;

		Kind(String fixtureName) {
			this.fixtureName = fixtureName;
		}

		/** Name used in {@code fixtures/expression-cases.json} and by the TypeScript engine. */
		public String fixtureName() {
			return fixtureName;
		}
	}

	private final Kind kind;
	private final int offset;
	private final int line;
	private final int column;

	public ExpressionException(String message, Kind kind, String source, int offset) {
		super(message);
		this.kind = kind;
		this.offset = offset;
		String before = source.substring(0, offset);
		this.line = (int) before.chars().filter(c -> c == '\n').count() + 1;
		this.column = offset - before.lastIndexOf('\n');
	}

	public Kind kind() {
		return kind;
	}

	public int offset() {
		return offset;
	}

	public int line() {
		return line;
	}

	public int column() {
		return column;
	}
}

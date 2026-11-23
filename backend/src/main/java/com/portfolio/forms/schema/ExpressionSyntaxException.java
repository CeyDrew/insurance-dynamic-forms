package com.portfolio.forms.schema;

/** A rule expression could not be read. {@code column} is 1-based. */
public class ExpressionSyntaxException extends RuntimeException {

	private final int column;

	public ExpressionSyntaxException(String message, int column) {
		super(message);
		this.column = column;
	}

	public int column() {
		return column;
	}
}

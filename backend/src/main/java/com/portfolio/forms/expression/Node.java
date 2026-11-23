package com.portfolio.forms.expression;

import java.util.List;

/** Expression syntax tree. {@code offset} is the position of the node's first token in the source. */
public sealed interface Node {

	int offset();

	/** {@code value} is null, a {@link Double}, {@link String} or {@link Boolean}. */
	record Literal(Object value, int offset) implements Node {
	}

	record Variable(String name, int offset) implements Node {
	}

	/** {@code operator} is {@code "!"} or {@code "-"}. */
	record Unary(String operator, Node operand, int offset) implements Node {
	}

	record Binary(String operator, Node left, Node right, int offset) implements Node {
	}

	record Call(String name, List<Node> args, int offset) implements Node {
	}
}

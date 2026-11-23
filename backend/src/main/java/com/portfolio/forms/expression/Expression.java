package com.portfolio.forms.expression;

import java.time.LocalDate;
import java.util.Collections;
import java.util.Map;
import java.util.SortedSet;
import java.util.TreeSet;
import java.util.function.Function;

/**
 * A parsed rule expression. Same language and results as the TypeScript engine in
 * {@code frontend/src/app/engine/rules}; both are tested against {@code fixtures/expression-cases.json}.
 * No dynamic code execution: tokenizer, recursive descent parser and a tree-walking interpreter.
 */
public final class Expression {

	private final String source;
	private final Node ast;
	private final SortedSet<String> variables;

	private Expression(String source, Node ast) {
		this.source = source;
		this.ast = ast;
		this.variables = Collections.unmodifiableSortedSet(collectVariables(ast, new TreeSet<>()));
	}

	/** Parses {@code source}; throws {@link ExpressionException} with line and column if it is invalid. */
	public static Expression compile(String source) {
		String text = source == null ? "" : source;
		return new Expression(text, Parser.parse(text));
	}

	public String source() {
		return source;
	}

	public Node ast() {
		return ast;
	}

	/** Field ids referenced anywhere in the expression. */
	public SortedSet<String> variables() {
		return variables;
	}

	/** Evaluates with field values looked up by {@code read}; unknown names read as {@code null}. */
	public Object evaluate(Function<String, Object> read, LocalDate today) {
		return new Evaluator(read, today).evaluate(ast);
	}

	public Object evaluate(Map<String, ?> values, LocalDate today) {
		return evaluate(values::get, today);
	}

	/** Evaluates and applies the language's truthiness rule; for visibleWhen, requiredWhen and disabledWhen. */
	public boolean test(Function<String, Object> read, LocalDate today) {
		return Values.isTruthy(evaluate(read, today));
	}

	private static SortedSet<String> collectVariables(Node node, SortedSet<String> into) {
		switch (node) {
			case Node.Variable variable -> into.add(variable.name());
			case Node.Unary unary -> collectVariables(unary.operand(), into);
			case Node.Binary binary -> {
				collectVariables(binary.left(), into);
				collectVariables(binary.right(), into);
			}
			case Node.Call call -> call.args().forEach(arg -> collectVariables(arg, into));
			case Node.Literal literal -> {
			}
		}
		return into;
	}

	@Override
	public String toString() {
		return source;
	}
}

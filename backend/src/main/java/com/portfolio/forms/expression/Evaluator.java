package com.portfolio.forms.expression;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

/** Interprets a parsed expression. Never throws: invalid operations yield {@code null}. */
final class Evaluator {

	private final Function<String, Object> read;
	private final LocalDate today;

	Evaluator(Function<String, Object> read, LocalDate today) {
		this.read = read;
		this.today = today;
	}

	Object evaluate(Node node) {
		return switch (node) {
			case Node.Literal literal -> literal.value();
			case Node.Variable variable -> Values.normalize(read.apply(variable.name()));
			case Node.Unary unary -> {
				Object operand = evaluate(unary.operand());
				if (unary.operator().equals("!")) {
					yield !Values.isTruthy(operand);
				}
				yield operand instanceof Double d ? -d : null;
			}
			case Node.Binary binary -> binary(binary);
			case Node.Call call -> {
				List<Object> args = new ArrayList<>(call.args().size());
				for (Node arg : call.args()) {
					args.add(evaluate(arg));
				}
				yield Functions.get(call.name()).implementation().call(args, today);
			}
		};
	}

	private Object binary(Node.Binary node) {
		// Short-circuit: the right side is not evaluated when the left decides the result.
		switch (node.operator()) {
			case "&&" -> {
				return Values.isTruthy(evaluate(node.left())) && Values.isTruthy(evaluate(node.right()));
			}
			case "||" -> {
				return Values.isTruthy(evaluate(node.left())) || Values.isTruthy(evaluate(node.right()));
			}
			default -> {
			}
		}
		Object a = evaluate(node.left());
		Object b = evaluate(node.right());
		return switch (node.operator()) {
			case "==" -> Values.equal(a, b);
			case "!=" -> !Values.equal(a, b);
			case "<", "<=", ">", ">=" -> compare(node.operator(), a, b);
			case "+" -> {
				if (a instanceof Double x && b instanceof Double y) {
					yield x + y;
				}
				if (a instanceof String x && b instanceof String y) {
					yield x + y;
				}
				yield null;
			}
			default -> arithmetic(node.operator(), a, b);
		};
	}

	private static boolean compare(String operator, Object a, Object b) {
		int order;
		if (a instanceof Double x && b instanceof Double y) {
			// Not Double.compare: it orders -0.0 before 0.0, unlike the TypeScript engine.
			order = x < y ? -1 : x > y ? 1 : x.doubleValue() == y.doubleValue() ? 0 : 2;
		}
		else if (a instanceof String x && b instanceof String y) {
			order = Integer.signum(x.compareTo(y));
		}
		else {
			return false;
		}
		if (order == 2) {
			return false; // NaN
		}
		return switch (operator) {
			case "<" -> order < 0;
			case "<=" -> order <= 0;
			case ">" -> order > 0;
			default -> order >= 0;
		};
	}

	private static Object arithmetic(String operator, Object a, Object b) {
		if (!(a instanceof Double x) || !(b instanceof Double y)) {
			return null;
		}
		return switch (operator) {
			case "-" -> x - y;
			case "*" -> x * y;
			case "/" -> y == 0 ? null : x / y;
			default -> y == 0 ? null : x % y;
		};
	}
}

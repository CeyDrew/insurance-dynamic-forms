package com.portfolio.forms.expression;

import java.util.ArrayList;
import java.util.List;

import com.portfolio.forms.expression.ExpressionException.Kind;
import com.portfolio.forms.expression.Tokenizer.Token;
import com.portfolio.forms.expression.Tokenizer.Type;

/** Recursive descent parser; grammar in {@code docs/rule-language.md}. */
final class Parser {

	/** Precedence levels of binary operators, lowest first. */
	private static final List<List<String>> LEVELS = List.of(
			List.of("||"),
			List.of("&&"),
			List.of("==", "!="),
			List.of("<", "<=", ">", ">="),
			List.of("+", "-"),
			List.of("*", "/", "%"));

	private final String source;
	private final List<Token> tokens;
	private int index;

	private Parser(String source) {
		this.source = source;
		this.tokens = Tokenizer.tokenize(source);
	}

	static Node parse(String source) {
		return new Parser(source).run();
	}

	private Node run() {
		if (peek().type() == Type.EOF) {
			throw new ExpressionException("İfade boş", Kind.SYNTAX, source, 0);
		}
		Node ast = binary(0);
		Token rest = peek();
		if (rest.type() != Type.EOF) {
			throw error("Beklenmeyen '" + rest.text() + "'", rest, Kind.SYNTAX);
		}
		return ast;
	}

	private Node binary(int level) {
		if (level == LEVELS.size()) {
			return unary();
		}
		Node left = binary(level + 1);
		while (isOperator(peek(), LEVELS.get(level))) {
			Token op = next();
			Node right = binary(level + 1);
			left = new Node.Binary(op.text(), left, right, op.offset());
		}
		return left;
	}

	private Node unary() {
		Token token = peek();
		if (isOperator(token, List.of("!", "-"))) {
			next();
			return new Node.Unary(token.text(), unary(), token.offset());
		}
		return primary();
	}

	private Node primary() {
		Token token = next();
		switch (token.type()) {
			case NUMBER, STRING -> {
				return new Node.Literal(token.value(), token.offset());
			}
			case IDENTIFIER -> {
				switch (token.text()) {
					case "true" -> {
						return new Node.Literal(true, token.offset());
					}
					case "false" -> {
						return new Node.Literal(false, token.offset());
					}
					case "null" -> {
						return new Node.Literal(null, token.offset());
					}
					default -> {
						if (isOperator(peek(), List.of("("))) {
							return call(token);
						}
						return new Node.Variable(token.text(), token.offset());
					}
				}
			}
			default -> {
				if (isOperator(token, List.of("("))) {
					Node inner = binary(0);
					expectClose();
					return inner;
				}
				throw error("Değer bekleniyordu, " + found(token), token, Kind.SYNTAX);
			}
		}
	}

	private Node call(Token nameToken) {
		String name = nameToken.text();
		Functions.Spec spec = Functions.get(name);
		if (spec == null) {
			throw error("Bilinmeyen fonksiyon '" + name + "'", nameToken, Kind.UNKNOWN_FUNCTION);
		}
		next(); // the opening parenthesis
		List<Node> args = new ArrayList<>();
		if (!isOperator(peek(), List.of(")"))) {
			args.add(binary(0));
			while (isOperator(peek(), List.of(","))) {
				next();
				args.add(binary(0));
			}
		}
		expectClose();
		if (args.size() < spec.minArgs() || args.size() > spec.maxArgs()) {
			throw error("'" + name + "' fonksiyonu " + spec.arityText() + ", " + args.size() + " verildi", nameToken,
					Kind.ARITY);
		}
		return new Node.Call(name, List.copyOf(args), nameToken.offset());
	}

	private void expectClose() {
		Token token = next();
		if (!isOperator(token, List.of(")"))) {
			throw error("')' bekleniyordu, " + found(token), token, Kind.SYNTAX);
		}
	}

	private Token peek() {
		return tokens.get(index);
	}

	private Token next() {
		return tokens.get(index++);
	}

	private static boolean isOperator(Token token, List<String> operators) {
		return token.type() == Type.OPERATOR && operators.contains(token.text());
	}

	private static String found(Token token) {
		return token.type() == Type.EOF ? "ifade bitti" : "'" + token.text() + "' bulundu";
	}

	private ExpressionException error(String message, Token token, Kind kind) {
		return new ExpressionException(message, kind, source, token.offset());
	}
}

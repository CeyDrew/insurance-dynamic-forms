package com.portfolio.forms.schema;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Tokenizes a rule expression and collects the field and function names it uses,
 * checking the token order well enough to reject malformed input.
 *
 * <p>This is only what definition validation needs: it does not build a tree or
 * evaluate anything. The full parser and evaluator replace it in phase 2.
 */
public final class ExpressionScanner {

	public record Result(Set<String> variables, Set<String> functions) {
	}

	private final String source;
	private int pos;
	private boolean expectOperand = true;
	/** One entry per open parenthesis: true for a function call, false for grouping. */
	private final Deque<Boolean> parens = new ArrayDeque<>();
	private boolean callJustOpened;
	private final Set<String> variables = new LinkedHashSet<>();
	private final Set<String> functions = new LinkedHashSet<>();

	private ExpressionScanner(String source) {
		this.source = source;
	}

	public static Result scan(String expression) {
		ExpressionScanner scanner = new ExpressionScanner(expression == null ? "" : expression);
		scanner.run();
		return new Result(Set.copyOf(scanner.variables), Set.copyOf(scanner.functions));
	}

	private void run() {
		if (source.isBlank()) {
			throw new ExpressionSyntaxException("İfade boş", 1);
		}
		while (true) {
			skipWhitespace();
			if (pos >= source.length()) {
				break;
			}
			int start = pos;
			char c = source.charAt(pos);
			boolean afterCallOpen = callJustOpened;
			callJustOpened = false;
			if (Character.isDigit(c)) {
				readNumber();
				operand(start);
			}
			else if (c == '\'' || c == '"') {
				readString(c);
				operand(start);
			}
			else if (Character.isLetter(c) || c == '_') {
				identifier(start);
			}
			else if (c == '(') {
				pos++;
				requireOperandPosition(start, "(");
				parens.push(false);
			}
			else if (c == ')') {
				pos++;
				closeParen(start, afterCallOpen);
			}
			else if (c == ',') {
				pos++;
				if (expectOperand || parens.isEmpty() || !parens.peek()) {
					throw error("Beklenmeyen ','", start);
				}
				expectOperand = true;
			}
			else if (c == '!' && !peekIs(pos + 1, '=')) {
				pos++;
				requireOperandPosition(start, "!");
			}
			else if (c == '-' && expectOperand) {
				pos++; // unary minus
			}
			else {
				binaryOperator(start);
			}
		}
		if (!parens.isEmpty()) {
			throw error("Kapanmamış parantez", source.length());
		}
		if (expectOperand) {
			throw error("İfade eksik bitiyor", source.length());
		}
	}

	private void identifier(int start) {
		while (pos < source.length()
				&& (Character.isLetterOrDigit(source.charAt(pos)) || source.charAt(pos) == '_')) {
			pos++;
		}
		String name = source.substring(start, pos);
		int afterName = pos;
		skipWhitespace();
		if (pos < source.length() && source.charAt(pos) == '(') {
			requireOperandPosition(start, name);
			pos++;
			functions.add(name);
			parens.push(true);
			callJustOpened = true;
			return;
		}
		pos = afterName;
		if (!name.equals("true") && !name.equals("false") && !name.equals("null")) {
			variables.add(name);
		}
		operand(start);
	}

	private void closeParen(int start, boolean afterCallOpen) {
		if (parens.isEmpty()) {
			throw error("Fazladan ')'", start);
		}
		boolean emptyCall = afterCallOpen && parens.peek();
		if (expectOperand && !emptyCall) {
			throw error("Beklenmeyen ')'", start);
		}
		parens.pop();
		expectOperand = false;
	}

	private void binaryOperator(int start) {
		char c = source.charAt(pos);
		String two = pos + 1 < source.length() ? source.substring(pos, pos + 2) : "";
		switch (two) {
			case "==", "!=", "<=", ">=", "&&", "||" -> pos += 2;
			default -> {
				switch (c) {
					case '+', '-', '*', '/', '%', '<', '>' -> pos++;
					case '=' -> throw error("'=' yerine '==' kullanın", start);
					case '&' -> throw error("'&' yerine '&&' kullanın", start);
					case '|' -> throw error("'|' yerine '||' kullanın", start);
					default -> throw error("Beklenmeyen karakter '" + c + "'", start);
				}
			}
		}
		if (expectOperand) {
			throw error("Operatörden önce değer bekleniyordu: '" + source.substring(start, pos) + "'", start);
		}
		expectOperand = true;
	}

	private void readNumber() {
		while (pos < source.length() && Character.isDigit(source.charAt(pos))) {
			pos++;
		}
		if (peekIs(pos, '.') && pos + 1 < source.length() && Character.isDigit(source.charAt(pos + 1))) {
			pos++;
			while (pos < source.length() && Character.isDigit(source.charAt(pos))) {
				pos++;
			}
		}
	}

	private void readString(char quote) {
		int start = pos;
		pos++;
		while (pos < source.length()) {
			char c = source.charAt(pos);
			if (c == '\\') {
				pos += 2;
				continue;
			}
			pos++;
			if (c == quote) {
				return;
			}
		}
		throw error("Kapanmamış metin", start);
	}

	private void operand(int start) {
		if (!expectOperand) {
			throw error("Beklenmeyen değer '" + source.substring(start, pos) + "', arada operatör eksik", start);
		}
		expectOperand = false;
	}

	private void requireOperandPosition(int start, String token) {
		if (!expectOperand) {
			throw error("Beklenmeyen '" + token + "', arada operatör eksik", start);
		}
	}

	private void skipWhitespace() {
		while (pos < source.length() && Character.isWhitespace(source.charAt(pos))) {
			pos++;
		}
	}

	private boolean peekIs(int index, char c) {
		return index < source.length() && source.charAt(index) == c;
	}

	private ExpressionSyntaxException error(String message, int index) {
		return new ExpressionSyntaxException(message, index + 1);
	}
}

package com.portfolio.forms.expression;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Splits a whole expression into tokens, ending with an {@code EOF} token. */
final class Tokenizer {

	enum Type {
		NUMBER, STRING, IDENTIFIER, OPERATOR, EOF
	}

	/** {@code text} is the source text (for strings, with quotes); {@code value} is set for numbers and strings. */
	record Token(Type type, String text, Object value, int offset) {
	}

	private static final Set<String> TWO_CHAR_OPERATORS = Set.of("==", "!=", "<=", ">=", "&&", "||");
	private static final String ONE_CHAR_OPERATORS = "()+-*/%<>!,";
	private static final Map<Character, Character> ESCAPES =
			Map.of('\\', '\\', '\'', '\'', '"', '"', 'n', '\n', 't', '\t');
	private static final Map<Character, String> HINTS = Map.of('=', "==", '&', "&&", '|', "||");

	private final String source;
	private int pos;

	private Tokenizer(String source) {
		this.source = source;
	}

	static List<Token> tokenize(String source) {
		return new Tokenizer(source).run();
	}

	private List<Token> run() {
		List<Token> tokens = new ArrayList<>();
		while (pos < source.length()) {
			char c = source.charAt(pos);
			int start = pos;
			if (isWhitespace(c)) {
				pos++;
			}
			else if (isDigit(c)) {
				while (pos < source.length() && isDigit(source.charAt(pos))) {
					pos++;
				}
				if (charAt(pos) == '.' && isDigit(charAt(pos + 1))) {
					pos++;
					while (pos < source.length() && isDigit(source.charAt(pos))) {
						pos++;
					}
				}
				String text = source.substring(start, pos);
				tokens.add(new Token(Type.NUMBER, text, Double.parseDouble(text), start));
			}
			else if (c == '\'' || c == '"') {
				tokens.add(readString(c));
			}
			else if (isIdentifierStart(c)) {
				while (pos < source.length() && isIdentifierPart(source.charAt(pos))) {
					pos++;
				}
				tokens.add(new Token(Type.IDENTIFIER, source.substring(start, pos), null, start));
			}
			else {
				String two = source.substring(pos, Math.min(pos + 2, source.length()));
				if (TWO_CHAR_OPERATORS.contains(two)) {
					tokens.add(new Token(Type.OPERATOR, two, null, start));
					pos += 2;
				}
				else if (ONE_CHAR_OPERATORS.indexOf(c) >= 0) {
					tokens.add(new Token(Type.OPERATOR, String.valueOf(c), null, start));
					pos++;
				}
				else if (HINTS.containsKey(c)) {
					throw error("'" + c + "' yerine '" + HINTS.get(c) + "' kullanın", start);
				}
				else {
					throw error("Beklenmeyen karakter '" + c + "'", start);
				}
			}
		}
		tokens.add(new Token(Type.EOF, "", null, source.length()));
		return tokens;
	}

	private Token readString(char quote) {
		int start = pos;
		pos++;
		StringBuilder value = new StringBuilder();
		while (pos < source.length()) {
			char ch = source.charAt(pos);
			if (ch == quote) {
				pos++;
				return new Token(Type.STRING, source.substring(start, pos), value.toString(), start);
			}
			if (ch == '\\') {
				Character next = pos + 1 < source.length() ? source.charAt(pos + 1) : null;
				Character escaped = next == null ? null : ESCAPES.get(next);
				if (escaped == null) {
					throw error("Geçersiz kaçış dizisi '\\" + (next == null ? "" : next) + "'", pos);
				}
				value.append(escaped.charValue());
				pos += 2;
			}
			else {
				value.append(ch);
				pos++;
			}
		}
		throw error("Kapanmamış metin", start);
	}

	private char charAt(int index) {
		return index < source.length() ? source.charAt(index) : '\0';
	}

	private ExpressionException error(String message, int offset) {
		return new ExpressionException(message, ExpressionException.Kind.SYNTAX, source, offset);
	}

	private static boolean isDigit(char c) {
		return c >= '0' && c <= '9';
	}

	private static boolean isIdentifierStart(char c) {
		return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_';
	}

	private static boolean isIdentifierPart(char c) {
		return isIdentifierStart(c) || isDigit(c);
	}

	private static boolean isWhitespace(char c) {
		return c == ' ' || c == '\t' || c == '\n' || c == '\r';
	}
}

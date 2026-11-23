package com.portfolio.forms.expression;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Runtime values of the rule language: {@code null}, {@link Double}, {@link String}, {@link Boolean},
 * {@link List} and {@link Map}. Dates are {@code YYYY-MM-DD} strings.
 */
public final class Values {

	private Values() {
	}

	/** Converts caller-supplied values (any {@link Number}, nested collections) to the canonical types. */
	public static Object normalize(Object value) {
		if (value instanceof Number number) {
			return number.doubleValue();
		}
		if (value instanceof List<?> list) {
			List<Object> copy = new ArrayList<>(list.size());
			list.forEach(item -> copy.add(normalize(item)));
			return copy;
		}
		if (value instanceof Map<?, ?> map) {
			Map<String, Object> copy = new LinkedHashMap<>();
			map.forEach((k, v) -> copy.put(String.valueOf(k), normalize(v)));
			return copy;
		}
		return value;
	}

	/** {@code null}, {@code false}, {@code 0}, {@code ""} and empty lists are falsy. */
	public static boolean isTruthy(Object value) {
		if (value == null) {
			return false;
		}
		if (value instanceof Boolean b) {
			return b;
		}
		if (value instanceof Double d) {
			return d != 0 && !d.isNaN();
		}
		if (value instanceof String s) {
			return !s.isEmpty();
		}
		if (value instanceof List<?> list) {
			return !list.isEmpty();
		}
		return true;
	}

	/** Strict, deep equality: different types are never equal. */
	public static boolean equal(Object a, Object b) {
		if (a == null || b == null) {
			return a == b;
		}
		if (a instanceof Double x && b instanceof Double y) {
			return x.doubleValue() == y.doubleValue();
		}
		if (a instanceof List<?> x && b instanceof List<?> y) {
			if (x.size() != y.size()) {
				return false;
			}
			for (int i = 0; i < x.size(); i++) {
				if (!equal(x.get(i), y.get(i))) {
					return false;
				}
			}
			return true;
		}
		if (a instanceof Map<?, ?> x && b instanceof Map<?, ?> y) {
			if (x.size() != y.size()) {
				return false;
			}
			for (Map.Entry<?, ?> entry : x.entrySet()) {
				if (!y.containsKey(entry.getKey()) || !equal(entry.getValue(), y.get(entry.getKey()))) {
					return false;
				}
			}
			return true;
		}
		if (a instanceof String || a instanceof Boolean) {
			return Objects.equals(a, b);
		}
		return false;
	}
}

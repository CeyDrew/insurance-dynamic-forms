package com.portfolio.forms.expression;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Built-in functions. Names, arities and results match the TypeScript engine. */
public final class Functions {

	interface Implementation {
		Object call(List<Object> args, LocalDate today);
	}

	record Spec(int minArgs, int maxArgs, Implementation implementation) {

		/** "1 argüman alır", "1-2 argüman alır", "en az 2 argüman alır", "argüman almaz". */
		String arityText() {
			if (maxArgs == 0) {
				return "argüman almaz";
			}
			if (maxArgs == Integer.MAX_VALUE) {
				return "en az " + minArgs + " argüman alır";
			}
			if (minArgs == maxArgs) {
				return minArgs + " argüman alır";
			}
			return minArgs + "-" + maxArgs + " argüman alır";
		}
	}

	private static final Pattern ISO_DATE = Pattern.compile("^(\\d{4})-(\\d{2})-(\\d{2})$");

	private static final Map<String, Spec> FUNCTIONS = Map.ofEntries(
			Map.entry("currentYear", new Spec(0, 0, (args, today) -> (double) today.getYear())),
			Map.entry("today", new Spec(0, 0, (args, today) -> today.toString())),
			Map.entry("age", new Spec(1, 1, (args, today) -> age(args.get(0), today))),
			Map.entry("daysBetween", new Spec(2, 2, (args, today) -> daysBetween(args.get(0), args.get(1)))),
			Map.entry("len", new Spec(1, 1, (args, today) -> len(args.get(0)))),
			Map.entry("count", new Spec(1, 1, (args, today) -> count(args.get(0)))),
			Map.entry("contains", new Spec(2, 2, (args, today) -> contains(args.get(0), args.get(1)))),
			Map.entry("isEmpty", new Spec(1, 1, (args, today) -> isEmpty(args.get(0)))),
			Map.entry("round", new Spec(1, 2, (args, today) -> round(args.get(0), args.size() > 1 ? args.get(1) : 0.0))),
			Map.entry("min", new Spec(2, Integer.MAX_VALUE, (args, today) -> extreme(args, true))),
			Map.entry("max", new Spec(2, Integer.MAX_VALUE, (args, today) -> extreme(args, false))),
			Map.entry("abs", new Spec(1, 1, (args, today) -> args.get(0) instanceof Double d ? Math.abs(d) : null)));

	public static final Set<String> NAMES = FUNCTIONS.keySet();

	private Functions() {
	}

	static Spec get(String name) {
		return FUNCTIONS.get(name);
	}

	/** The date for a calendar-valid {@code YYYY-MM-DD} string, otherwise {@code null}. */
	static LocalDate parseDate(Object value) {
		if (!(value instanceof String text)) {
			return null;
		}
		Matcher m = ISO_DATE.matcher(text);
		if (!m.matches()) {
			return null;
		}
		int year = Integer.parseInt(m.group(1));
		int month = Integer.parseInt(m.group(2));
		int day = Integer.parseInt(m.group(3));
		if (month < 1 || month > 12 || day < 1 || day > LocalDate.of(year, month, 1).lengthOfMonth()) {
			return null;
		}
		return LocalDate.of(year, month, day);
	}

	private static Object age(Object value, LocalDate today) {
		LocalDate birth = parseDate(value);
		if (birth == null) {
			return null;
		}
		boolean beforeBirthday = today.getMonthValue() < birth.getMonthValue()
				|| (today.getMonthValue() == birth.getMonthValue() && today.getDayOfMonth() < birth.getDayOfMonth());
		return (double) (today.getYear() - birth.getYear() - (beforeBirthday ? 1 : 0));
	}

	private static Object daysBetween(Object from, Object to) {
		LocalDate a = parseDate(from);
		LocalDate b = parseDate(to);
		return a == null || b == null ? null : (double) (b.toEpochDay() - a.toEpochDay());
	}

	private static Object len(Object value) {
		if (value == null) {
			return 0.0;
		}
		if (value instanceof String s) {
			return (double) s.length();
		}
		return value instanceof List<?> list ? (double) list.size() : null;
	}

	private static Object count(Object value) {
		if (value == null) {
			return 0.0;
		}
		return value instanceof List<?> list ? (double) list.size() : null;
	}

	private static Object contains(Object haystack, Object needle) {
		if (haystack instanceof List<?> list) {
			return list.stream().anyMatch(item -> Values.equal(item, needle));
		}
		if (haystack instanceof String s && needle instanceof String n) {
			return s.contains(n);
		}
		return false;
	}

	private static Object isEmpty(Object value) {
		return value == null || (value instanceof String s && s.isBlank())
				|| (value instanceof List<?> list && list.isEmpty());
	}

	private static Object round(Object value, Object digits) {
		if (!(value instanceof Double n) || !(digits instanceof Double d) || d != Math.floor(d) || d < 0 || d > 10) {
			return null;
		}
		double factor = Math.pow(10, d);
		double result = Math.signum(n) * Math.floor(Math.abs(n) * factor + 0.5) / factor;
		return result == 0 ? 0.0 : result; // no -0, same JSON as the TypeScript engine
	}

	private static Object extreme(List<Object> args, boolean min) {
		double result = min ? Double.POSITIVE_INFINITY : Double.NEGATIVE_INFINITY;
		for (Object arg : args) {
			if (!(arg instanceof Double d)) {
				return null;
			}
			result = min ? Math.min(result, d) : Math.max(result, d);
		}
		return result;
	}
}

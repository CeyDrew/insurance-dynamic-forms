package com.portfolio.forms.submission;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.portfolio.forms.expression.Expression;
import com.portfolio.forms.expression.Values;
import com.portfolio.forms.lookup.LookupService;
import com.portfolio.forms.schema.FieldDefinition;
import com.portfolio.forms.schema.FieldType;
import com.portfolio.forms.schema.FormDefinition;
import com.portfolio.forms.schema.OptionDefinition;
import com.portfolio.forms.schema.StepDefinition;
import com.portfolio.forms.schema.ValidatorDefinition;

import tools.jackson.databind.JsonNode;

/**
 * Re-checks submitted answers on the server with the same rules the browser used: the
 * client is not trusted. Visibility, requiredness and computed values are evaluated again
 * with the shared expression engine; hidden fields are stored as null, computed fields are
 * recomputed, unknown keys are rejected. Error messages match the frontend's.
 */
@Component
public class SubmissionValidator {

	public record SubmissionError(String field, String code, String message) {
	}

	/** {@code answers} is the canonical form of the submission; meaningful only when there are no errors. */
	public record Result(List<SubmissionError> errors, Map<String, Object> answers) {

		public boolean valid() {
			return errors.isEmpty();
		}
	}

	private static final DateTimeFormatter TR_DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");

	private final LookupService lookups;

	SubmissionValidator(LookupService lookups) {
		this.lookups = lookups;
	}

	public Result validate(FormDefinition definition, Map<String, ?> values, LocalDate today) {
		return new Run(definition, values == null ? Map.of() : values, today).execute();
	}

	private final class Run {

		private final LocalDate today;
		private final List<SubmissionError> errors = new ArrayList<>();
		private final Map<String, Expression> compiled = new HashMap<>();
		private final Map<String, Boolean> stepVisibility = new HashMap<>();
		private final Map<String, StepDefinition> stepOfField = new HashMap<>();
		private final Map<String, Object> raw;
		private final Scope top;

		@SuppressWarnings("unchecked")
		Run(FormDefinition definition, Map<String, ?> values, LocalDate today) {
			this.today = today;
			this.raw = (Map<String, Object>) Values.normalize(values);
			Map<String, FieldDefinition> fields = new LinkedHashMap<>();
			for (StepDefinition step : definition.steps()) {
				for (FieldDefinition field : step.fields()) {
					fields.put(field.id(), field);
					stepOfField.put(field.id(), step);
				}
			}
			this.top = new Scope(null, fields, raw, id -> stepVisible(stepOfField.get(id)));
		}

		Result execute() {
			for (String key : raw.keySet()) {
				FieldDefinition field = top.fields.get(key);
				if (field == null || (field.type() == FieldType.INFO && raw.get(key) != null)) {
					error(key, "UNKNOWN_FIELD", "Formda böyle bir alan yok");
				}
			}
			Map<String, Object> answers = new LinkedHashMap<>();
			validateFields(top, "", answers);
			return new Result(List.copyOf(errors), answers);
		}

		private boolean stepVisible(StepDefinition step) {
			return stepVisibility.computeIfAbsent(step.id(),
					id -> step.visibleWhen() == null || test(step.visibleWhen(), top));
		}

		// ---- walking the fields ---------------------------------------------------------

		private void validateFields(Scope scope, String prefix, Map<String, Object> out) {
			for (FieldDefinition field : scope.fields.values()) {
				String id = field.id();
				String path = prefix + id;
				switch (field.type()) {
					case INFO -> {
						// no value
					}
					case COMPUTED -> out.put(id, canonical(scope.value(id)));
					case REPEATER -> out.put(id, scope.visible(id) ? repeater(field, scope, path) : null);
					default -> {
						if (!scope.visible(id)) {
							out.put(id, null); // whatever the client sent for a hidden field is dropped
						}
						else {
							Object value = scope.raw.get(id);
							input(field, value, path, required(field, scope));
							out.put(id, canonical(value));
						}
					}
				}
			}
		}

		private List<Object> repeater(FieldDefinition field, Scope scope, String path) {
			Object value = scope.raw.get(field.id());
			if (value != null && !(value instanceof List<?>)) {
				error(path, "INVALID_TYPE", "Değer tipi hatalı");
				return null;
			}
			List<?> rows = value == null ? List.of() : (List<?>) value;
			if (rows.isEmpty()) {
				if (required(field, scope)) {
					error(path, "REQUIRED", "En az bir satır eklenmeli");
				}
			}
			else {
				validators(field, rows, path);
			}
			Set<String> childIds = new HashSet<>();
			Map<String, FieldDefinition> children = new LinkedHashMap<>();
			field.fields().forEach(child -> {
				children.put(child.id(), child);
				childIds.add(child.id());
			});
			List<Object> out = new ArrayList<>();
			for (int i = 0; i < rows.size(); i++) {
				String rowPath = path + "[" + i + "]";
				if (!(rows.get(i) instanceof Map<?, ?> rowValues)) {
					error(rowPath, "INVALID_TYPE", "Değer tipi hatalı");
					continue;
				}
				@SuppressWarnings("unchecked")
				Map<String, Object> row = (Map<String, Object>) rowValues;
				for (String key : row.keySet()) {
					if (!childIds.contains(key)) {
						error(rowPath + "." + key, "UNKNOWN_FIELD", "Formda böyle bir alan yok");
					}
				}
				Scope rowScope = new Scope(scope, children, row, id -> scope.visible(field.id()));
				Map<String, Object> rowOut = new LinkedHashMap<>();
				validateFields(rowScope, rowPath + ".", rowOut);
				out.add(rowOut);
			}
			return out;
		}

		private boolean required(FieldDefinition field, Scope scope) {
			return Boolean.TRUE.equals(field.required())
					|| (field.requiredWhen() != null && test(field.requiredWhen(), scope));
		}

		// ---- one input value -------------------------------------------------------------

		private void input(FieldDefinition field, Object value, String path, boolean required) {
			if (isEmpty(value)) {
				if (required) {
					error(path, "REQUIRED", "Bu alan zorunlu");
				}
				return;
			}
			if (!hasType(field.type(), value)) {
				error(path, "INVALID_TYPE", "Değer tipi hatalı");
				return;
			}
			List<OptionDefinition> options = options(field);
			if (options != null) {
				Set<String> allowed = new HashSet<>();
				options.forEach(o -> allowed.add(o.value()));
				List<?> chosen = value instanceof List<?> list ? list : List.of(value);
				if (!allowed.containsAll(chosen)) {
					error(path, "INVALID_OPTION", "Geçersiz seçim");
					return;
				}
			}
			validators(field, value, path);
		}

		private List<OptionDefinition> options(FieldDefinition field) {
			if (field.options() != null) {
				return field.options();
			}
			if (field.optionsSource() != null) {
				return lookups.optionsForUrl(field.optionsSource().url()).orElse(null);
			}
			return null;
		}

		/** Reports the first failing validator, as the frontend shows the first error. */
		private void validators(FieldDefinition field, Object value, String path) {
			if (field.validators() == null) {
				return;
			}
			boolean repeater = field.type() == FieldType.REPEATER;
			for (ValidatorDefinition validator : field.validators()) {
				JsonNode limit = validator.value();
				String message = switch (validator.type()) {
					case MIN_LENGTH -> ((String) value).length() < limit.intValue()
							? "En az " + number(limit) + " karakter olmalı" : null;
					case MAX_LENGTH -> ((String) value).length() > limit.intValue()
							? "En fazla " + number(limit) + " karakter olabilir" : null;
					case PATTERN -> Pattern.compile("^(?:" + limit.stringValue() + ")$").matcher((String) value).matches()
							? null : "Geçersiz biçim";
					case MIN -> (Double) value < limit.doubleValue() ? "En az " + number(limit) + " olmalı" : null;
					case MAX -> (Double) value > limit.doubleValue() ? "En fazla " + number(limit) + " olabilir" : null;
					case MIN_DATE -> LocalDate.parse((String) value).isBefore(date(limit))
							? date(limit).format(TR_DATE) + " veya sonrası olmalı" : null;
					case MAX_DATE -> LocalDate.parse((String) value).isAfter(date(limit))
							? date(limit).format(TR_DATE) + " veya öncesi olmalı" : null;
					case MIN_ITEMS -> ((List<?>) value).size() < limit.intValue()
							? (repeater ? "En az " + number(limit) + " satır olmalı"
									: "En az " + number(limit) + " seçim yapılmalı")
							: null;
					case MAX_ITEMS -> ((List<?>) value).size() > limit.intValue()
							? (repeater ? "En fazla " + number(limit) + " satır eklenebilir"
									: "En fazla " + number(limit) + " seçim yapılabilir")
							: null;
				};
				if (message != null) {
					String code = validator.type().name();
					error(path, code, validator.message() != null ? validator.message() : message);
					return;
				}
			}
		}

		private LocalDate date(JsonNode limit) {
			return "today".equals(limit.stringValue()) ? today : LocalDate.parse(limit.stringValue());
		}

		// ---- expressions -----------------------------------------------------------------

		private boolean test(String source, Scope scope) {
			return compiled.computeIfAbsent(source, Expression::compile).test(scope::read, today);
		}

		private Object evaluate(String source, Scope scope) {
			return compiled.computeIfAbsent(source, Expression::compile).evaluate(scope::read, today);
		}

		private void error(String field, String code, String message) {
			errors.add(new SubmissionError(field, code, message));
		}

		/**
		 * Field values seen by rules: a row scope falls back to the form scope. Values are worked
		 * out lazily and memoized, so evaluation order follows the dependencies; definitions are
		 * checked for cycles before they are saved, and a re-entered field reads as null.
		 */
		private final class Scope {

			final Scope parent;
			final Map<String, FieldDefinition> fields;
			final Map<String, Object> raw;
			final Predicate<String> parentVisible;
			final Map<String, Object> values = new HashMap<>();
			final Map<String, Boolean> visibility = new HashMap<>();
			final Set<String> evaluating = new HashSet<>();

			Scope(Scope parent, Map<String, FieldDefinition> fields, Map<String, Object> raw,
					Predicate<String> parentVisible) {
				this.parent = parent;
				this.fields = fields;
				this.raw = raw;
				this.parentVisible = parentVisible;
			}

			Object read(String name) {
				if (fields.containsKey(name)) {
					return value(name);
				}
				return parent == null ? null : parent.read(name);
			}

			boolean visible(String id) {
				Boolean cached = visibility.get(id);
				if (cached != null) {
					return cached;
				}
				FieldDefinition field = fields.get(id);
				boolean visible = parentVisible.test(id)
						&& (field.visibleWhen() == null || test(field.visibleWhen(), this));
				visibility.put(id, visible);
				return visible;
			}

			Object value(String id) {
				if (values.containsKey(id)) {
					return values.get(id);
				}
				if (!evaluating.add(id)) {
					return null;
				}
				try {
					FieldDefinition field = fields.get(id);
					Object value;
					if (!visible(id) || field.type() == FieldType.INFO) {
						value = null;
					}
					else if (field.type() == FieldType.COMPUTED) {
						value = evaluate(field.expression(), this);
					}
					else {
						value = raw.get(id);
					}
					values.put(id, value);
					return value;
				}
				finally {
					evaluating.remove(id);
				}
			}
		}
	}

	private static boolean isEmpty(Object value) {
		return value == null || (value instanceof String s && s.isBlank()) || (value instanceof List<?> l && l.isEmpty());
	}

	private static boolean hasType(FieldType type, Object value) {
		return switch (type) {
			case TEXT, TEXTAREA, SELECT, RADIO -> value instanceof String;
			case NUMBER, CURRENCY -> value instanceof Double d && Double.isFinite(d);
			case DATE -> value instanceof String s && isIsoDate(s);
			case BOOLEAN -> value instanceof Boolean;
			case MULTISELECT -> value instanceof List<?> list && list.stream().allMatch(String.class::isInstance);
			default -> true;
		};
	}

	private static boolean isIsoDate(String value) {
		if (!value.matches("\\d{4}-\\d{2}-\\d{2}")) {
			return false;
		}
		try {
			LocalDate.parse(value);
			return true;
		}
		catch (java.time.DateTimeException ex) {
			return false;
		}
	}

	/** Same text as the frontend's {@code `${limit}`}: no trailing {@code .0}. */
	private static String number(JsonNode limit) {
		return limit.decimalValue().stripTrailingZeros().toPlainString();
	}

	/** Whole numbers as integers, so stored JSON reads {@code 2019} rather than {@code 2019.0}. */
	@SuppressWarnings("unchecked")
	static Object canonical(Object value) {
		if (value instanceof Double d && Double.isFinite(d) && d == Math.rint(d) && Math.abs(d) < 1e15) {
			return d.longValue();
		}
		if (value instanceof List<?> list) {
			return list.stream().map(SubmissionValidator::canonical).toList();
		}
		if (value instanceof Map<?, ?> map) {
			Map<String, Object> copy = new LinkedHashMap<>();
			((Map<String, Object>) map).forEach((k, v) -> copy.put(k, canonical(v)));
			return copy;
		}
		return value;
	}
}

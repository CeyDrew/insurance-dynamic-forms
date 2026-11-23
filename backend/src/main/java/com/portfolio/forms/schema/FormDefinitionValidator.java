package com.portfolio.forms.schema;

import static com.portfolio.forms.schema.DefinitionErrorCode.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

import org.springframework.stereotype.Component;

import com.portfolio.forms.expression.Expression;
import com.portfolio.forms.expression.ExpressionException;

import tools.jackson.databind.JsonNode;

/**
 * Semantic checks on a bound {@link FormDefinition}: ids, type-specific keys, validators,
 * default values, expression references and computed-field cycles. Collects every problem
 * instead of stopping at the first one. Rules are listed in {@code docs/form-definition-spec.md}.
 */
@Component
public class FormDefinitionValidator {

	static final Pattern FORM_ID = Pattern.compile("^[a-z][a-z0-9-]*$");
	static final Pattern IDENTIFIER = Pattern.compile("^[a-zA-Z][a-zA-Z0-9_]*$");
	static final Pattern CURRENCY_CODE = Pattern.compile("^[A-Z]{3}$");
	static final String TODAY = "today";


	/** Type-specific keys each field type accepts. */
	private static final Map<FieldType, Set<String>> TYPE_PROPERTIES = new EnumMap<>(Map.ofEntries(
			Map.entry(FieldType.TEXT, Set.of()),
			Map.entry(FieldType.TEXTAREA, Set.of("rows")),
			Map.entry(FieldType.NUMBER, Set.of("decimals")),
			Map.entry(FieldType.CURRENCY, Set.of("currency")),
			Map.entry(FieldType.DATE, Set.of()),
			Map.entry(FieldType.BOOLEAN, Set.of()),
			Map.entry(FieldType.SELECT, Set.of("options", "optionsSource")),
			Map.entry(FieldType.MULTISELECT, Set.of("options", "optionsSource")),
			Map.entry(FieldType.RADIO, Set.of("options")),
			Map.entry(FieldType.REPEATER, Set.of("fields", "itemLabel", "addLabel")),
			Map.entry(FieldType.COMPUTED, Set.of("expression", "format")),
			Map.entry(FieldType.INFO, Set.of("content"))));

	private static final Map<FieldType, Set<ValidatorType>> TYPE_VALIDATORS = new EnumMap<>(Map.ofEntries(
			Map.entry(FieldType.TEXT, EnumSet.of(ValidatorType.MIN_LENGTH, ValidatorType.MAX_LENGTH, ValidatorType.PATTERN)),
			Map.entry(FieldType.TEXTAREA,
					EnumSet.of(ValidatorType.MIN_LENGTH, ValidatorType.MAX_LENGTH, ValidatorType.PATTERN)),
			Map.entry(FieldType.NUMBER, EnumSet.of(ValidatorType.MIN, ValidatorType.MAX)),
			Map.entry(FieldType.CURRENCY, EnumSet.of(ValidatorType.MIN, ValidatorType.MAX)),
			Map.entry(FieldType.DATE, EnumSet.of(ValidatorType.MIN_DATE, ValidatorType.MAX_DATE)),
			Map.entry(FieldType.MULTISELECT, EnumSet.of(ValidatorType.MIN_ITEMS, ValidatorType.MAX_ITEMS)),
			Map.entry(FieldType.REPEATER, EnumSet.of(ValidatorType.MIN_ITEMS, ValidatorType.MAX_ITEMS))));

	public List<DefinitionError> validate(FormDefinition form) {
		return new Run(form).execute();
	}

	/** Where an id was declared. {@code field} is null for steps. */
	private record Symbol(String id, String path, String stepId, FieldDefinition field, String repeaterId) {

		boolean isStep() {
			return field == null;
		}
	}

	/** Fields an expression reads, and where that expression sits. */
	private record RuleDependencies(String path, Set<String> fieldIds) {
	}

	private enum RuleKind {
		STEP_VISIBLE_WHEN, VISIBLE_WHEN, REQUIRED_WHEN, DISABLED_WHEN, EXPRESSION
	}

	/** An expression together with the field or step that owns it. */
	private record ExpressionSite(String path, String expression, RuleKind kind, String ownerId, String stepId,
			String repeaterId) {
	}

	private static final class Run {

		private final FormDefinition form;
		private final List<DefinitionError> errors = new ArrayList<>();
		private final Map<String, Symbol> symbols = new LinkedHashMap<>();
		private final List<ExpressionSite> sites = new ArrayList<>();
		/** "fieldId.KIND" -> fields read by that expression or visibleWhen rule. */
		private final Map<String, RuleDependencies> ruleDependencies = new HashMap<>();
		/** step id -> fields read by its visibleWhen. */
		private final Map<String, RuleDependencies> stepDependencies = new HashMap<>();

		Run(FormDefinition form) {
			this.form = form;
		}

		List<DefinitionError> execute() {
			if (isBlank(form.id())) {
				error("id", REQUIRED, "Form id'si zorunlu");
			}
			else if (!FORM_ID.matcher(form.id()).matches()) {
				error("id", INVALID_ID, "Form id'si küçük harfle başlamalı; küçük harf, rakam ve tire içerebilir (ör. casco-risk)");
			}
			if (form.version() == null) {
				error("version", REQUIRED, "Versiyon zorunlu");
			}
			else if (form.version() < 1) {
				error("version", INVALID_VALUE, "Versiyon 1 veya daha büyük olmalı");
			}
			if (isBlank(form.title())) {
				error("title", REQUIRED, "Form başlığı zorunlu");
			}
			if (form.steps() == null || form.steps().isEmpty()) {
				error("steps", REQUIRED, "Form en az bir adım içermeli");
			}
			else {
				for (int i = 0; i < form.steps().size(); i++) {
					step(form.steps().get(i), "steps[" + i + "]");
				}
			}
			for (ExpressionSite site : sites) {
				expression(site);
			}
			cycles();
			return errors;
		}

		// ---- structure -----------------------------------------------------------------

		private void step(StepDefinition step, String path) {
			if (step == null) {
				error(path, REQUIRED, "Adım boş olamaz");
				return;
			}
			declare(step.id(), path, id -> new Symbol(id, path, id, null, null));
			if (isBlank(step.title())) {
				error(path + ".title", REQUIRED, "Adım başlığı zorunlu");
			}
			if (step.visibleWhen() != null) {
				sites.add(new ExpressionSite(path + ".visibleWhen", step.visibleWhen(), RuleKind.STEP_VISIBLE_WHEN,
						step.id(), step.id(), null));
			}
			if (step.fields() == null || step.fields().isEmpty()) {
				error(path + ".fields", REQUIRED, "Adım en az bir alan içermeli");
				return;
			}
			for (int i = 0; i < step.fields().size(); i++) {
				field(step.fields().get(i), path + ".fields[" + i + "]", step.id(), null);
			}
		}

		private void field(FieldDefinition field, String path, String stepId, String repeaterId) {
			if (field == null) {
				error(path, REQUIRED, "Alan boş olamaz");
				return;
			}
			declare(field.id(), path, id -> new Symbol(id, path, stepId, field, repeaterId));
			if (isBlank(field.label())) {
				error(path + ".label", REQUIRED, "Alan etiketi (label) zorunlu");
			}
			FieldType type = field.type();
			if (type == null) {
				error(path + ".type", REQUIRED, "Alan tipi zorunlu");
				return;
			}
			allowedProperties(field, path);
			if (Boolean.TRUE.equals(field.required()) && field.requiredWhen() != null) {
				error(path + ".requiredWhen", CONFLICTING_PROPERTIES,
						"'required: true' ile 'requiredWhen' birlikte kullanılamaz");
			}

			switch (type) {
				case TEXTAREA -> range(field.rows(), 1, 30, path + ".rows");
				case NUMBER -> range(field.decimals(), 0, 10, path + ".decimals");
				case CURRENCY -> {
					if (field.currency() != null && !CURRENCY_CODE.matcher(field.currency()).matches()) {
						error(path + ".currency", INVALID_VALUE, "Para birimi 3 büyük harfli ISO kodu olmalı (ör. TRY)");
					}
				}
				case SELECT, MULTISELECT -> {
					if (field.options() != null && field.optionsSource() != null) {
						error(path + ".optionsSource", CONFLICTING_PROPERTIES,
								"'options' ve 'optionsSource' birlikte verilemez");
					}
					else if (field.optionsSource() != null) {
						optionsSource(field.optionsSource(), path + ".optionsSource");
					}
					else {
						options(field.options(), 1, path + ".options");
					}
				}
				case RADIO -> options(field.options(), 2, path + ".options");
				case REPEATER -> repeater(field, path, stepId, repeaterId);
				case COMPUTED -> {
					if (isBlank(field.expression())) {
						error(path + ".expression", REQUIRED, "Hesaplanan alan için 'expression' zorunlu");
					}
				}
				case INFO -> {
					if (isBlank(field.content())) {
						error(path + ".content", REQUIRED, "Bilgi alanı için 'content' zorunlu");
					}
				}
				default -> {
				}
			}

			validators(field, path);
			defaultValue(field, path);

			String owner = field.id();
			addSite(path + ".visibleWhen", field.visibleWhen(), RuleKind.VISIBLE_WHEN, owner, stepId, repeaterId);
			addSite(path + ".requiredWhen", field.requiredWhen(), RuleKind.REQUIRED_WHEN, owner, stepId, repeaterId);
			addSite(path + ".disabledWhen", field.disabledWhen(), RuleKind.DISABLED_WHEN, owner, stepId, repeaterId);
			if (type == FieldType.COMPUTED) {
				addSite(path + ".expression", field.expression(), RuleKind.EXPRESSION, owner, stepId, repeaterId);
			}
		}

		private void allowedProperties(FieldDefinition field, String path) {
			Map<String, Object> specific = new LinkedHashMap<>();
			specific.put("rows", field.rows());
			specific.put("decimals", field.decimals());
			specific.put("currency", field.currency());
			specific.put("options", field.options());
			specific.put("optionsSource", field.optionsSource());
			specific.put("fields", field.fields());
			specific.put("itemLabel", field.itemLabel());
			specific.put("addLabel", field.addLabel());
			specific.put("expression", field.expression());
			specific.put("format", field.format());
			specific.put("content", field.content());
			if (field.type().isReadOnly()) {
				specific.put("required", field.required());
				specific.put("requiredWhen", field.requiredWhen());
				specific.put("disabledWhen", field.disabledWhen());
				specific.put("validators", field.validators());
				specific.put("defaultValue", isNull(field.defaultValue()) ? null : field.defaultValue());
			}
			Set<String> allowed = TYPE_PROPERTIES.get(field.type());
			specific.forEach((key, value) -> {
				if (value != null && !allowed.contains(key)) {
					error(path + "." + key, PROPERTY_NOT_ALLOWED,
							"'" + key + "' anahtarı '" + typeName(field.type()) + "' tipindeki alanda kullanılamaz");
				}
			});
		}

		private void repeater(FieldDefinition field, String path, String stepId, String enclosingRepeater) {
			if (enclosingRepeater != null) {
				error(path + ".type", INVALID_VALUE, "İç içe repeater desteklenmez");
				return;
			}
			if (field.fields() == null || field.fields().isEmpty()) {
				error(path + ".fields", REQUIRED, "Repeater en az bir alan içermeli");
				return;
			}
			for (int i = 0; i < field.fields().size(); i++) {
				field(field.fields().get(i), path + ".fields[" + i + "]", stepId, field.id());
			}
		}

		private void options(List<OptionDefinition> options, int minCount, String path) {
			if (options == null || options.isEmpty()) {
				error(path, REQUIRED, minCount > 1 ? "En az " + minCount + " seçenek verilmeli"
						: "'options' veya 'optionsSource' verilmeli");
				return;
			}
			if (options.size() < minCount) {
				error(path, INVALID_VALUE, "En az " + minCount + " seçenek verilmeli");
			}
			Set<String> seen = new HashSet<>();
			for (int i = 0; i < options.size(); i++) {
				OptionDefinition option = options.get(i);
				String optionPath = path + "[" + i + "]";
				if (option == null) {
					error(optionPath, REQUIRED, "Seçenek boş olamaz");
					continue;
				}
				if (isBlank(option.value())) {
					error(optionPath + ".value", REQUIRED, "Seçenek değeri (value) zorunlu");
				}
				else if (!seen.add(option.value())) {
					error(optionPath + ".value", DUPLICATE_OPTION, "'" + option.value() + "' değeri birden fazla seçenekte var");
				}
				if (isBlank(option.label())) {
					error(optionPath + ".label", REQUIRED, "Seçenek etiketi (label) zorunlu");
				}
			}
		}

		private void optionsSource(OptionsSource source, String path) {
			if (source.type() == null) {
				error(path + ".type", REQUIRED, "Kaynak tipi zorunlu");
			}
			if (isBlank(source.url())) {
				error(path + ".url", REQUIRED, "Kaynak adresi (url) zorunlu");
			}
			else if (!source.url().startsWith("/") || source.url().startsWith("//")) {
				error(path + ".url", INVALID_VALUE, "Kaynak adresi '/' ile başlayan uygulama içi bir yol olmalı");
			}
		}

		// ---- validators and default values ---------------------------------------------

		private void validators(FieldDefinition field, String path) {
			List<ValidatorDefinition> validators = field.validators();
			if (validators == null || field.type().isReadOnly()) {
				return;
			}
			Set<ValidatorType> allowed = TYPE_VALIDATORS.getOrDefault(field.type(), Set.of());
			Map<ValidatorType, BigDecimal> numbers = new EnumMap<>(ValidatorType.class);
			Map<ValidatorType, String> dates = new EnumMap<>(ValidatorType.class);
			Set<ValidatorType> seen = EnumSet.noneOf(ValidatorType.class);
			for (int i = 0; i < validators.size(); i++) {
				ValidatorDefinition validator = validators.get(i);
				String vPath = path + ".validators[" + i + "]";
				if (validator == null) {
					error(vPath, REQUIRED, "Doğrulayıcı boş olamaz");
					continue;
				}
				ValidatorType type = validator.type();
				if (type == null) {
					error(vPath + ".type", REQUIRED, "Doğrulayıcı tipi zorunlu");
					continue;
				}
				if (!allowed.contains(type)) {
					error(vPath + ".type", INVALID_VALIDATOR, "'" + validatorName(type) + "' doğrulayıcısı '"
							+ typeName(field.type()) + "' tipindeki alanda kullanılamaz");
					continue;
				}
				if (!seen.add(type)) {
					error(vPath + ".type", INVALID_VALIDATOR,
							"'" + validatorName(type) + "' doğrulayıcısı birden fazla kez verilmiş");
					continue;
				}
				JsonNode value = validator.value();
				if (isNull(value)) {
					error(vPath + ".value", REQUIRED, "Doğrulayıcı değeri (value) zorunlu");
					continue;
				}
				String vp = vPath + ".value";
				switch (type) {
					case MIN_LENGTH, MIN_ITEMS -> integerAtLeast(value, 0, vp).ifPresent(n -> numbers.put(type, n));
					case MAX_LENGTH, MAX_ITEMS -> integerAtLeast(value, 1, vp).ifPresent(n -> numbers.put(type, n));
					case MIN, MAX -> {
						if (value.isNumber()) {
							numbers.put(type, value.decimalValue());
						}
						else {
							error(vp, INVALID_VALIDATOR, "Değer sayı olmalı");
						}
					}
					case MIN_DATE, MAX_DATE -> {
						if (value.isString() && (TODAY.equals(value.stringValue()) || isIsoDate(value.stringValue()))) {
							dates.put(type, value.stringValue());
						}
						else {
							error(vp, INVALID_VALIDATOR, "Değer YYYY-AA-GG biçiminde tarih veya 'today' olmalı");
						}
					}
					case PATTERN -> {
						if (!value.isString()) {
							error(vp, INVALID_VALIDATOR, "Desen metin olmalı");
						}
						else {
							try {
								Pattern.compile(value.stringValue());
							}
							catch (PatternSyntaxException ex) {
								error(vp, INVALID_VALIDATOR, "Geçersiz düzenli ifade: " + ex.getDescription());
							}
						}
					}
				}
			}
			bounds(numbers, ValidatorType.MIN_LENGTH, ValidatorType.MAX_LENGTH, path);
			bounds(numbers, ValidatorType.MIN, ValidatorType.MAX, path);
			bounds(numbers, ValidatorType.MIN_ITEMS, ValidatorType.MAX_ITEMS, path);
			String minDate = dates.get(ValidatorType.MIN_DATE);
			String maxDate = dates.get(ValidatorType.MAX_DATE);
			if (minDate != null && maxDate != null && !minDate.equals(TODAY) && !maxDate.equals(TODAY)
					&& LocalDate.parse(minDate).isAfter(LocalDate.parse(maxDate))) {
				error(path + ".validators", INVALID_VALIDATOR, "'minDate' değeri 'maxDate' değerinden sonra olamaz");
			}
		}

		private java.util.Optional<BigDecimal> integerAtLeast(JsonNode value, int min, String path) {
			if (!value.isIntegralNumber() || value.decimalValue().compareTo(BigDecimal.valueOf(min)) < 0) {
				error(path, INVALID_VALIDATOR, "Değer " + min + " veya daha büyük bir tam sayı olmalı");
				return java.util.Optional.empty();
			}
			return java.util.Optional.of(value.decimalValue());
		}

		private void bounds(Map<ValidatorType, BigDecimal> numbers, ValidatorType lower, ValidatorType upper,
				String path) {
			BigDecimal low = numbers.get(lower);
			BigDecimal high = numbers.get(upper);
			if (low != null && high != null && low.compareTo(high) > 0) {
				error(path + ".validators", INVALID_VALIDATOR, "'" + validatorName(lower) + "' değeri '"
						+ validatorName(upper) + "' değerinden büyük olamaz");
			}
		}

		private void defaultValue(FieldDefinition field, String path) {
			JsonNode value = field.defaultValue();
			if (isNull(value) || field.type().isReadOnly()) {
				return;
			}
			String vp = path + ".defaultValue";
			boolean ok = switch (field.type()) {
				case TEXT, TEXTAREA -> value.isString();
				case NUMBER, CURRENCY -> value.isNumber();
				case DATE -> value.isString() && isIsoDate(value.stringValue());
				case BOOLEAN -> value.isBoolean();
				case SELECT, RADIO -> value.isString();
				case MULTISELECT -> value.isArray() && value.valueStream().allMatch(JsonNode::isString);
				case REPEATER -> value.isArray() && value.valueStream().allMatch(JsonNode::isObject);
				default -> true;
			};
			if (!ok) {
				error(vp, INVALID_VALUE, "Varsayılan değer '" + typeName(field.type()) + "' tipine uymuyor");
				return;
			}
			if (field.options() != null) {
				Set<String> values = new HashSet<>();
				field.options().stream().filter(o -> o != null && o.value() != null).forEach(o -> values.add(o.value()));
				List<String> chosen = value.isArray() ? value.valueStream().map(JsonNode::stringValue).toList()
						: List.of(value.stringValue());
				for (String v : chosen) {
					if (!values.contains(v)) {
						error(vp, INVALID_VALUE, "Varsayılan değer '" + v + "' seçenekler arasında yok");
					}
				}
			}
		}

		// ---- expressions ---------------------------------------------------------------

		private void addSite(String path, String expression, RuleKind kind, String ownerId, String stepId,
				String repeaterId) {
			if (expression != null) {
				sites.add(new ExpressionSite(path, expression, kind, ownerId, stepId, repeaterId));
			}
		}

		private void expression(ExpressionSite site) {
			Expression expression;
			try {
				expression = Expression.compile(site.expression());
			}
			catch (ExpressionException ex) {
				DefinitionErrorCode code = ex.kind() == ExpressionException.Kind.UNKNOWN_FUNCTION ? UNKNOWN_FUNCTION
						: EXPRESSION_SYNTAX;
				error(site.path(), code, ex.getMessage() + " (satır " + ex.line() + ", sütun " + ex.column() + ")");
				return;
			}
			Set<String> dependencies = new LinkedHashSet<>();
			for (String name : expression.variables()) {
				Symbol target = symbols.get(name);
				if (target == null) {
					error(site.path(), UNKNOWN_REFERENCE, "'" + name + "' adında bir alan yok");
					continue;
				}
				String problem = referenceProblem(site, target);
				if (problem != null) {
					error(site.path(), INVALID_REFERENCE, problem);
					continue;
				}
				dependencies.add(name);
			}
			switch (site.kind()) {
				case EXPRESSION, VISIBLE_WHEN -> ruleDependencies.put(site.ownerId() + "." + site.kind(),
						new RuleDependencies(site.path(), dependencies));
				case STEP_VISIBLE_WHEN -> stepDependencies.put(site.stepId(), new RuleDependencies(site.path(), dependencies));
				default -> {
					// requiredWhen and disabledWhen do not change any value, so they cannot form a cycle.
				}
			}
		}

		private String referenceProblem(ExpressionSite site, Symbol target) {
			String name = target.id();
			if (target.isStep()) {
				return "'" + name + "' bir adım id'si; ifadelerde sadece alanlar kullanılabilir";
			}
			if (target.field().type() == FieldType.INFO) {
				return "'" + name + "' bir bilgi alanı ve değer tutmaz";
			}
			if (target.repeaterId() != null && !target.repeaterId().equals(site.repeaterId())) {
				return "'" + name + "', '" + target.repeaterId() + "' repeater'ının içinde; dışarıdan yalnızca '"
						+ target.repeaterId() + "' (liste olarak) kullanılabilir";
			}
			if (site.kind() == RuleKind.STEP_VISIBLE_WHEN && Objects.equals(site.stepId(), target.stepId())) {
				return "Adımın görünürlüğü kendi içindeki '" + name + "' alanına bağlı olamaz";
			}
			if (site.kind() != RuleKind.EXPRESSION && site.kind() != RuleKind.STEP_VISIBLE_WHEN
					&& name.equals(site.ownerId())) {
				return "Alanın kuralı kendi değerine bağlı olamaz";
			}
			return null;
		}

		/**
		 * A field's value depends on its expression (computed fields) and, because hidden fields
		 * read as null, on every rule that decides its visibility: its own visibleWhen, its step's
		 * and its repeater's. Reports each cycle in that graph once, at the edge that starts it.
		 */
		private void cycles() {
			Map<String, Map<String, String>> edges = new LinkedHashMap<>(); // field -> (dependency -> rule path)
			for (Symbol symbol : symbols.values()) {
				if (symbol.isStep()) {
					continue;
				}
				Map<String, String> out = new LinkedHashMap<>();
				addEdges(out, ruleDependencies.get(symbol.id() + "." + RuleKind.EXPRESSION));
				addEdges(out, ruleDependencies.get(symbol.id() + "." + RuleKind.VISIBLE_WHEN));
				addEdges(out, stepDependencies.get(symbol.stepId()));
				if (symbol.repeaterId() != null) {
					addEdges(out, ruleDependencies.get(symbol.repeaterId() + "." + RuleKind.VISIBLE_WHEN));
				}
				edges.put(symbol.id(), out);
			}
			Map<String, Integer> state = new HashMap<>(); // absent = new, 1 = on stack, 2 = done
			Set<Set<String>> reported = new HashSet<>();
			for (String id : edges.keySet()) {
				visit(id, edges, new ArrayList<>(), state, reported);
			}
		}

		private static void addEdges(Map<String, String> out, RuleDependencies rule) {
			if (rule != null) {
				rule.fieldIds().forEach(id -> out.putIfAbsent(id, rule.path()));
			}
		}

		private void visit(String id, Map<String, Map<String, String>> edges, List<String> stack,
				Map<String, Integer> state, Set<Set<String>> reported) {
			Integer s = state.get(id);
			if (s != null && s == 2) {
				return;
			}
			if (s != null && s == 1) {
				List<String> cycle = new ArrayList<>(stack.subList(stack.indexOf(id), stack.size()));
				if (reported.add(Set.copyOf(cycle))) {
					cycle.add(id);
					String path = edges.get(cycle.get(0)).get(cycle.get(1));
					error(path, CIRCULAR_DEPENDENCY,
							"Alanlar döngüsel olarak birbirine bağlı: " + String.join(" → ", cycle));
				}
				return;
			}
			state.put(id, 1);
			stack.add(id);
			for (String dependency : edges.getOrDefault(id, Map.of()).keySet()) {
				visit(dependency, edges, stack, state, reported);
			}
			stack.remove(stack.size() - 1);
			state.put(id, 2);
		}

		// ---- helpers -------------------------------------------------------------------

		private void declare(String id, String path, java.util.function.Function<String, Symbol> symbol) {
			if (isBlank(id)) {
				error(path + ".id", REQUIRED, "Id zorunlu");
			}
			else if (!IDENTIFIER.matcher(id).matches()) {
				error(path + ".id", INVALID_ID,
						"'" + id + "' geçersiz; harfle başlamalı, yalnızca harf, rakam ve '_' içerebilir");
			}
			else if (symbols.containsKey(id)) {
				error(path + ".id", DUPLICATE_ID, "'" + id + "' id'si zaten kullanılıyor (" + symbols.get(id).path() + ")");
			}
			else {
				symbols.put(id, symbol.apply(id));
			}
		}

		private void range(Integer value, int min, int max, String path) {
			if (value != null && (value < min || value > max)) {
				error(path, INVALID_VALUE, "Değer " + min + " ile " + max + " arasında olmalı");
			}
		}

		private void error(String path, DefinitionErrorCode code, String message) {
			errors.add(new DefinitionError(path, code, message));
		}
	}

	private static boolean isBlank(String value) {
		return value == null || value.isBlank();
	}

	private static boolean isNull(JsonNode node) {
		return node == null || node.isNull() || node.isMissingNode();
	}

	private static boolean isIsoDate(String value) {
		try {
			LocalDate.parse(value);
			return true;
		}
		catch (DateTimeParseException ex) {
			return false;
		}
	}

	private static String typeName(FieldType type) {
		return type.name().toLowerCase(Locale.ROOT);
	}

	private static String validatorName(ValidatorType type) {
		String[] parts = type.name().toLowerCase(Locale.ROOT).split("_");
		return parts.length == 1 ? parts[0]
				: parts[0] + Character.toUpperCase(parts[1].charAt(0)) + parts[1].substring(1);
	}
}

package com.portfolio.forms.schema;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import com.portfolio.forms.schema.DefinitionValidationService.ValidationReport;

/**
 * Broken definitions must be rejected with an error that names the right place and reason.
 * Most cases are a single step whose fields are given as a JSON fragment.
 */
class InvalidDefinitionTest {

	private final DefinitionValidationService service =
			new DefinitionValidationService(new FormDefinitionReader(), new FormDefinitionValidator());

	/** A one-step form with the given field JSON objects. */
	private static String form(String fields) {
		return """
				{ "id": "test-form", "version": 1, "title": "Test",
				  "steps": [ { "id": "main", "title": "Adım", "fields": [ %s ] } ] }
				""".formatted(fields);
	}

	private static final String AGE = """
			{ "id": "age", "type": "number", "label": "Yaş" }""";

	static Stream<Arguments> cases() {
		return Stream.of(
				// ---- reading ----
				Arguments.of("not JSON", "{ \"id\": ", "", DefinitionErrorCode.INVALID_JSON),
				Arguments.of("empty body", "  ", "", DefinitionErrorCode.INVALID_JSON),
				Arguments.of("typo in key", form("""
						{ "id": "a", "type": "text", "label": "A", "visibleWehn": "true" }"""),
						"steps[0].fields[0].visibleWehn", DefinitionErrorCode.UNKNOWN_PROPERTY),
				Arguments.of("unknown field type", form("""
						{ "id": "a", "type": "slider", "label": "A" }"""),
						"steps[0].fields[0].type", DefinitionErrorCode.INVALID_VALUE),
				Arguments.of("version as text", """
						{ "id": "f", "version": "1", "title": "T", "steps": [] }""",
						"version", DefinitionErrorCode.INVALID_VALUE),

				// ---- root and ids ----
				Arguments.of("bad form id", """
						{ "id": "Casco Risk", "version": 1, "title": "T",
						  "steps": [ { "id": "s", "title": "S", "fields": [ %s ] } ] }""".formatted(AGE),
						"id", DefinitionErrorCode.INVALID_ID),
				Arguments.of("version zero", """
						{ "id": "f", "version": 0, "title": "T",
						  "steps": [ { "id": "s", "title": "S", "fields": [ %s ] } ] }""".formatted(AGE),
						"version", DefinitionErrorCode.INVALID_VALUE),
				Arguments.of("no steps", """
						{ "id": "f", "version": 1, "title": "T", "steps": [] }""",
						"steps", DefinitionErrorCode.REQUIRED),
				Arguments.of("missing label", form("""
						{ "id": "a", "type": "text" }"""),
						"steps[0].fields[0].label", DefinitionErrorCode.REQUIRED),
				Arguments.of("field id with dash", form("""
						{ "id": "model-year", "type": "number", "label": "Model" }"""),
						"steps[0].fields[0].id", DefinitionErrorCode.INVALID_ID),
				Arguments.of("duplicate field id", form(AGE + "," + AGE),
						"steps[0].fields[1].id", DefinitionErrorCode.DUPLICATE_ID),
				Arguments.of("field id reuses step id", form("""
						{ "id": "main", "type": "text", "label": "A" }"""),
						"steps[0].fields[0].id", DefinitionErrorCode.DUPLICATE_ID),
				Arguments.of("duplicate id inside repeater", form(AGE + """
						, { "id": "drivers", "type": "repeater", "label": "Sürücüler",
						    "fields": [ { "id": "age", "type": "number", "label": "Yaş" } ] }"""),
						"steps[0].fields[1].fields[0].id", DefinitionErrorCode.DUPLICATE_ID),

				// ---- type-specific keys ----
				Arguments.of("options on text", form("""
						{ "id": "a", "type": "text", "label": "A", "options": [ { "value": "x", "label": "X" } ] }"""),
						"steps[0].fields[0].options", DefinitionErrorCode.PROPERTY_NOT_ALLOWED),
				Arguments.of("required on computed", form(AGE + """
						, { "id": "b", "type": "computed", "label": "B", "expression": "age + 1", "required": true }"""),
						"steps[0].fields[1].required", DefinitionErrorCode.PROPERTY_NOT_ALLOWED),
				Arguments.of("required and requiredWhen", form(AGE + """
						, { "id": "b", "type": "text", "label": "B", "required": true, "requiredWhen": "age > 18" }"""),
						"steps[0].fields[1].requiredWhen", DefinitionErrorCode.CONFLICTING_PROPERTIES),
				Arguments.of("options and optionsSource", form("""
						{ "id": "a", "type": "select", "label": "A",
						  "options": [ { "value": "x", "label": "X" } ],
						  "optionsSource": { "type": "remote", "url": "/api/x" } }"""),
						"steps[0].fields[0].optionsSource", DefinitionErrorCode.CONFLICTING_PROPERTIES),
				Arguments.of("select without options", form("""
						{ "id": "a", "type": "select", "label": "A" }"""),
						"steps[0].fields[0].options", DefinitionErrorCode.REQUIRED),
				Arguments.of("radio with one option", form("""
						{ "id": "a", "type": "radio", "label": "A", "options": [ { "value": "x", "label": "X" } ] }"""),
						"steps[0].fields[0].options", DefinitionErrorCode.INVALID_VALUE),
				Arguments.of("duplicate option value", form("""
						{ "id": "a", "type": "select", "label": "A",
						  "options": [ { "value": "x", "label": "X" }, { "value": "x", "label": "Y" } ] }"""),
						"steps[0].fields[0].options[1].value", DefinitionErrorCode.DUPLICATE_OPTION),
				Arguments.of("external options url", form("""
						{ "id": "a", "type": "select", "label": "A",
						  "optionsSource": { "type": "remote", "url": "https://evil.example/x" } }"""),
						"steps[0].fields[0].optionsSource.url", DefinitionErrorCode.INVALID_VALUE),
				Arguments.of("nested repeater", form("""
						{ "id": "r", "type": "repeater", "label": "R", "fields": [
						  { "id": "inner", "type": "repeater", "label": "I", "fields": [ { "id": "x", "type": "text", "label": "X" } ] } ] }"""),
						"steps[0].fields[0].fields[0].type", DefinitionErrorCode.INVALID_VALUE),
				Arguments.of("computed without expression", form("""
						{ "id": "a", "type": "computed", "label": "A" }"""),
						"steps[0].fields[0].expression", DefinitionErrorCode.REQUIRED),
				Arguments.of("bad currency code", form("""
						{ "id": "a", "type": "currency", "label": "A", "currency": "tl" }"""),
						"steps[0].fields[0].currency", DefinitionErrorCode.INVALID_VALUE),
				Arguments.of("default value of wrong type", form("""
						{ "id": "a", "type": "boolean", "label": "A", "defaultValue": "yes" }"""),
						"steps[0].fields[0].defaultValue", DefinitionErrorCode.INVALID_VALUE),
				Arguments.of("default value not among options", form("""
						{ "id": "a", "type": "radio", "label": "A", "defaultValue": "z",
						  "options": [ { "value": "x", "label": "X" }, { "value": "y", "label": "Y" } ] }"""),
						"steps[0].fields[0].defaultValue", DefinitionErrorCode.INVALID_VALUE),

				// ---- validators ----
				Arguments.of("pattern on number", form("""
						{ "id": "a", "type": "number", "label": "A", "validators": [ { "type": "pattern", "value": "^1$" } ] }"""),
						"steps[0].fields[0].validators[0].type", DefinitionErrorCode.INVALID_VALIDATOR),
				Arguments.of("broken regex", form("""
						{ "id": "a", "type": "text", "label": "A", "validators": [ { "type": "pattern", "value": "([a-z" } ] }"""),
						"steps[0].fields[0].validators[0].value", DefinitionErrorCode.INVALID_VALIDATOR),
				Arguments.of("min greater than max", form("""
						{ "id": "a", "type": "number", "label": "A",
						  "validators": [ { "type": "min", "value": 10 }, { "type": "max", "value": 5 } ] }"""),
						"steps[0].fields[0].validators", DefinitionErrorCode.INVALID_VALIDATOR),
				Arguments.of("validator repeated", form("""
						{ "id": "a", "type": "text", "label": "A",
						  "validators": [ { "type": "maxLength", "value": 10 }, { "type": "maxLength", "value": 20 } ] }"""),
						"steps[0].fields[0].validators[1].type", DefinitionErrorCode.INVALID_VALIDATOR),
				Arguments.of("negative minLength", form("""
						{ "id": "a", "type": "text", "label": "A", "validators": [ { "type": "minLength", "value": -1 } ] }"""),
						"steps[0].fields[0].validators[0].value", DefinitionErrorCode.INVALID_VALIDATOR),
				Arguments.of("bad date bound", form("""
						{ "id": "a", "type": "date", "label": "A", "validators": [ { "type": "minDate", "value": "yesterday" } ] }"""),
						"steps[0].fields[0].validators[0].value", DefinitionErrorCode.INVALID_VALIDATOR),
				Arguments.of("validator without value", form("""
						{ "id": "a", "type": "text", "label": "A", "validators": [ { "type": "maxLength" } ] }"""),
						"steps[0].fields[0].validators[0].value", DefinitionErrorCode.REQUIRED),

				// ---- expressions ----
				Arguments.of("syntax error", form(AGE + """
						, { "id": "b", "type": "text", "label": "B", "visibleWhen": "age >" }"""),
						"steps[0].fields[1].visibleWhen", DefinitionErrorCode.EXPRESSION_SYNTAX),
				Arguments.of("unknown field in rule", form(AGE + """
						, { "id": "b", "type": "text", "label": "B", "visibleWhen": "agee > 18" }"""),
						"steps[0].fields[1].visibleWhen", DefinitionErrorCode.UNKNOWN_REFERENCE),
				Arguments.of("unknown function", form(AGE + """
						, { "id": "b", "type": "computed", "label": "B", "expression": "sqrt(age)" }"""),
						"steps[0].fields[1].expression", DefinitionErrorCode.UNKNOWN_FUNCTION),
				Arguments.of("reference to info field", form("""
						{ "id": "note", "type": "info", "label": "N", "content": "..." },
						{ "id": "b", "type": "text", "label": "B", "visibleWhen": "note == 'x'" }"""),
						"steps[0].fields[1].visibleWhen", DefinitionErrorCode.INVALID_REFERENCE),
				Arguments.of("rule on own value", form("""
						{ "id": "b", "type": "text", "label": "B", "requiredWhen": "len(b) > 0" }"""),
						"steps[0].fields[0].requiredWhen", DefinitionErrorCode.INVALID_REFERENCE),
				Arguments.of("repeater child from outside", form("""
						{ "id": "drivers", "type": "repeater", "label": "S",
						  "fields": [ { "id": "driverAge", "type": "number", "label": "Yaş" } ] },
						{ "id": "b", "type": "text", "label": "B", "visibleWhen": "driverAge < 25" }"""),
						"steps[0].fields[1].visibleWhen", DefinitionErrorCode.INVALID_REFERENCE),
				Arguments.of("step id in rule", form("""
						{ "id": "b", "type": "text", "label": "B", "visibleWhen": "main == 1" }"""),
						"steps[0].fields[0].visibleWhen", DefinitionErrorCode.INVALID_REFERENCE),
				Arguments.of("step visibility on own field", """
						{ "id": "f", "version": 1, "title": "T",
						  "steps": [ { "id": "s", "title": "S", "visibleWhen": "age > 18", "fields": [ %s ] } ] }"""
					.formatted(AGE),
						"steps[0].visibleWhen", DefinitionErrorCode.INVALID_REFERENCE),
				Arguments.of("computed on itself", form("""
						{ "id": "a", "type": "computed", "label": "A", "expression": "a + 1" }"""),
						"steps[0].fields[0].expression", DefinitionErrorCode.CIRCULAR_DEPENDENCY),
				Arguments.of("computed cycle", form("""
						{ "id": "a", "type": "computed", "label": "A", "expression": "b + 1" },
						{ "id": "b", "type": "computed", "label": "B", "expression": "c * 2" },
						{ "id": "c", "type": "computed", "label": "C", "expression": "a - 1" }"""),
						"steps[0].fields[0].expression", DefinitionErrorCode.CIRCULAR_DEPENDENCY));
	}

	@ParameterizedTest(name = "{0}")
	@MethodSource("cases")
	void rejected(String name, String json, String path, DefinitionErrorCode code) {
		ValidationReport report = service.validate(json);

		assertThat(report.valid()).isFalse();
		assertThat(report.errors())
			.extracting(DefinitionError::path, DefinitionError::code)
			.contains(tuple(path, code));
		assertThat(report.errors()).allSatisfy(error -> assertThat(error.message()).isNotBlank());
	}

	@Test
	void reportsEveryProblemNotJustTheFirst() {
		ValidationReport report = service.validate(form("""
				{ "id": "a", "type": "text", "label": "A", "visibleWhen": "missing1 == 1" },
				{ "id": "a", "type": "number", "label": "" },
				{ "id": "c", "type": "computed", "label": "C", "expression": "nope(1)" }"""));

		assertThat(report.errors())
			.extracting(DefinitionError::code)
			.contains(DefinitionErrorCode.UNKNOWN_REFERENCE, DefinitionErrorCode.DUPLICATE_ID,
					DefinitionErrorCode.REQUIRED, DefinitionErrorCode.UNKNOWN_FUNCTION);
	}

	@Test
	void cycleMessageShowsThePath() {
		ValidationReport report = service.validate(form("""
				{ "id": "a", "type": "computed", "label": "A", "expression": "b + 1" },
				{ "id": "b", "type": "computed", "label": "B", "expression": "a * 2" }"""));

		assertThat(report.errors()).singleElement()
			.extracting(DefinitionError::message)
			.asString()
			.contains("a → b → a");
	}

	@Test
	void syntaxErrorMessageHasColumn() {
		ValidationReport report = service.validate(form(AGE + """
				, { "id": "b", "type": "text", "label": "B", "visibleWhen": "age = 18" }"""));

		assertThat(report.errors()).singleElement()
			.extracting(DefinitionError::message)
			.asString()
			.contains("'==' kullanın", "sütun 5");
	}

	@Test
	void unknownEnumListsAllowedValues() {
		ValidationReport report = service.validate(form("""
				{ "id": "a", "type": "slider", "label": "A" }"""));

		assertThat(report.errors()).singleElement()
			.extracting(DefinitionError::message)
			.asString()
			.contains("'slider'", "text", "repeater");
	}

	@Test
	void repeaterChildMayUseSiblingsAndTopLevelFields() {
		ValidationReport report = service.validate(form(AGE + """
				, { "id": "drivers", "type": "repeater", "label": "S", "fields": [
				    { "id": "birth", "type": "date", "label": "D" },
				    { "id": "driverAge", "type": "computed", "label": "Yaş", "expression": "age(birth)" },
				    { "id": "note", "type": "info", "label": "N", "content": "x", "visibleWhen": "driverAge < age" } ] },
				  { "id": "total", "type": "computed", "label": "T", "expression": "count(drivers)" }"""));

		assertThat(report.errors()).isEmpty();
	}
}

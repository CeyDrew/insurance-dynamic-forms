package com.portfolio.forms.expression;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Runs {@code fixtures/expression-cases.json}, the cases shared with the TypeScript engine,
 * so both sides are held to exactly the same results and error messages.
 */
class ExpressionFixtureTest {

	private static final JsonMapper MAPPER = JsonMapper.builder().build();
	private static final JsonNode FIXTURE = MAPPER.readTree(Path.of("..", "fixtures", "expression-cases.json").toFile());
	private static final LocalDate TODAY = LocalDate.parse(FIXTURE.get("today").stringValue());

	static Stream<Arguments> evaluateCases() {
		return FIXTURE.get("evaluate").valueStream().map(c -> Arguments.of(
				c.get("expression").stringValue(),
				c.has("vars") ? toValue(c.get("vars")) : Map.of(),
				toValue(c.get("result"))));
	}

	static Stream<Arguments> errorCases() {
		return FIXTURE.get("errors").valueStream().map(c -> Arguments.of(
				c.get("expression").stringValue(),
				c.get("kind").stringValue(),
				c.get("message").stringValue(),
				c.get("line").intValue(),
				c.get("column").intValue()));
	}

	static Stream<Arguments> dependencyCases() {
		return FIXTURE.get("dependencies").valueStream().map(c -> Arguments.of(
				c.get("expression").stringValue(),
				c.get("variables").valueStream().map(JsonNode::stringValue).toList()));
	}

	@ParameterizedTest(name = "{0} with {1} = {2}")
	@MethodSource("evaluateCases")
	void evaluates(String expression, Object vars, Object expected) {
		Object actual = Expression.compile(expression).evaluate((Map<String, ?>) vars, TODAY);

		assertThat(Values.equal(actual, expected))
			.as("%s evaluated to %s (%s), expected %s", expression, actual,
					actual == null ? "null" : actual.getClass().getSimpleName(), expected)
			.isTrue();
	}

	@ParameterizedTest(name = "rejects {0}")
	@MethodSource("errorCases")
	void rejects(String expression, String kind, String message, int line, int column) {
		assertThatThrownBy(() -> Expression.compile(expression))
			.isInstanceOfSatisfying(ExpressionException.class, ex -> {
				assertThat(ex.kind().fixtureName()).isEqualTo(kind);
				assertThat(ex.getMessage()).isEqualTo(message);
				assertThat(ex.line()).as("line").isEqualTo(line);
				assertThat(ex.column()).as("column").isEqualTo(column);
			});
	}

	@ParameterizedTest(name = "{0} reads {1}")
	@MethodSource("dependencyCases")
	void collectsVariables(String expression, List<String> variables) {
		assertThat(Expression.compile(expression).variables()).containsExactlyElementsOf(variables);
	}

	private static Object toValue(JsonNode node) {
		return Values.normalize(MAPPER.convertValue(node, Object.class));
	}
}

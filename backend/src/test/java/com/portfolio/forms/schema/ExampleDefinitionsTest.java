package com.portfolio.forms.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import com.portfolio.forms.schema.DefinitionValidationService.ValidationReport;

/** Every product form under the repo-root {@code examples/} folder must be valid. */
class ExampleDefinitionsTest {

	private static final Path EXAMPLES = Path.of("..", "examples");

	private final DefinitionValidationService service =
			new DefinitionValidationService(new FormDefinitionReader(), new FormDefinitionValidator());

	static Stream<Path> examples() throws IOException {
		return Files.list(EXAMPLES).filter(p -> p.toString().endsWith(".json")).sorted();
	}

	@ParameterizedTest(name = "{0}")
	@MethodSource("examples")
	void exampleIsValid(Path file) throws IOException {
		ValidationReport report = service.validate(Files.readString(file));

		assertThat(report.errors()).isEmpty();
		assertThat(report.valid()).isTrue();
	}

	@org.junit.jupiter.api.Test
	void allFourProductsArePresent() throws IOException {
		assertThat(examples().map(p -> p.getFileName().toString()))
			.containsExactly("casco.json", "health.json", "home.json", "travel.json");
	}
}

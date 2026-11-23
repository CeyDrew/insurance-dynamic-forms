package com.portfolio.forms.lookup;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(LookupController.class)
class LookupControllerTest {

	@Autowired
	MockMvc mvc;

	/** Every {@code optionsSource} url used by the example forms. */
	static Stream<String> urlsUsedByExamples() throws IOException {
		Pattern url = Pattern.compile("\"url\":\\s*\"(/api/lookups/[^\"]+)\"");
		try (Stream<Path> files = Files.list(Path.of("..", "examples"))) {
			return files.flatMap(file -> {
				try {
					Matcher m = url.matcher(Files.readString(file));
					return m.results().map(r -> r.group(1)).toList().stream();
				}
				catch (IOException ex) {
					throw new java.io.UncheckedIOException(ex);
				}
			}).distinct().sorted().toList().stream();
		}
	}

	@ParameterizedTest(name = "{0}")
	@MethodSource("urlsUsedByExamples")
	void everyExampleSourceExists(String url) throws Exception {
		mvc.perform(get(url))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].value").isString())
			.andExpect(jsonPath("$[0].label").isString());
	}

	@Test
	void citiesHaveAll81Provinces() throws Exception {
		mvc.perform(get("/api/lookups/cities")).andExpect(jsonPath("$.length()").value(81));
	}

	@Test
	void unknownOrUnsafeNameIs404() throws Exception {
		mvc.perform(get("/api/lookups/nope")).andExpect(status().isNotFound());
		mvc.perform(get("/api/lookups/..%2Fapplication")).andExpect(status().isNotFound());
	}
}

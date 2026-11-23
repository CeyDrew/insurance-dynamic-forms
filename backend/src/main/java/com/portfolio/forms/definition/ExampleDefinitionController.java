package com.portfolio.forms.definition;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.portfolio.forms.schema.FormDefinition;
import com.portfolio.forms.schema.FormDefinitionReader;

/**
 * Serves the product forms under the repo-root {@code examples/} folder (copied to the
 * classpath by the build) until definitions are stored in the database.
 */
@RestController
@RequestMapping("/api/examples")
class ExampleDefinitionController {

	record ExampleSummary(String id, int version, String title, String description) {
	}

	private record Example(ExampleSummary summary, String json) {
	}

	private final Map<String, Example> examples = new LinkedHashMap<>();

	ExampleDefinitionController(FormDefinitionReader reader) throws IOException {
		Resource[] resources = new PathMatchingResourcePatternResolver().getResources("classpath*:examples/*.json");
		List<Example> loaded = new ArrayList<>();
		for (Resource resource : resources) {
			String json = resource.getContentAsString(StandardCharsets.UTF_8);
			FormDefinition definition = reader.read(json);
			loaded.add(new Example(new ExampleSummary(definition.id(), definition.version(), definition.title(),
					definition.description()), json));
		}
		loaded.sort(Comparator.comparing(e -> e.summary().title()));
		loaded.forEach(e -> examples.put(e.summary().id(), e));
	}

	@GetMapping
	List<ExampleSummary> list() {
		return examples.values().stream().map(Example::summary).toList();
	}

	@GetMapping("/{id}")
	ResponseEntity<String> get(@PathVariable String id) {
		Example example = examples.get(id);
		if (example == null) {
			return ResponseEntity.notFound().build();
		}
		return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(example.json());
	}
}

package com.portfolio.forms.definition;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

/**
 * Publishes the repo-root {@code examples/} forms (copied to the classpath by the build) when
 * the database has no definitions yet, so a fresh install has something to fill in.
 */
@Component
class ExampleDefinitionSeeder implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(ExampleDefinitionSeeder.class);

	private final FormDefinitionRepository repository;
	private final DefinitionService service;

	ExampleDefinitionSeeder(FormDefinitionRepository repository, DefinitionService service) {
		this.repository = repository;
		this.service = service;
	}

	@Override
	public void run(ApplicationArguments args) throws IOException {
		if (repository.count() > 0) {
			return;
		}
		Resource[] examples = new PathMatchingResourcePatternResolver().getResources("classpath*:examples/*.json");
		for (Resource example : examples) {
			VersionInfo draft = service.createDraft(example.getContentAsString(StandardCharsets.UTF_8));
			service.publish(draft.formKey(), draft.version());
			log.info("Published example form {} v{}", draft.formKey(), draft.version());
		}
	}
}

package com.portfolio.forms.submission;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.portfolio.forms.common.ApiExceptions.ConflictException;
import com.portfolio.forms.common.ApiExceptions.ValidationException;
import com.portfolio.forms.definition.DefinitionService;
import com.portfolio.forms.definition.FormDefinitionEntity;
import com.portfolio.forms.schema.FormDefinition;
import com.portfolio.forms.schema.FormDefinitionReader;
import com.portfolio.forms.submission.SubmissionValidator.Result;

import tools.jackson.databind.json.JsonMapper;

@Service
public class SubmissionService {

	public record SubmitRequest(String formId, Integer version, Map<String, Object> values) {
	}

	public record Submitted(long id, String formId, int version, Instant submittedAt) {
	}

	private final DefinitionService definitions;
	private final FormDefinitionReader reader;
	private final SubmissionValidator validator;
	private final SubmissionRepository repository;
	private final JsonMapper json;
	private final Clock clock;

	SubmissionService(DefinitionService definitions, FormDefinitionReader reader, SubmissionValidator validator,
			SubmissionRepository repository, JsonMapper json, Clock clock) {
		this.definitions = definitions;
		this.reader = reader;
		this.validator = validator;
		this.repository = repository;
		this.json = json;
		this.clock = clock;
	}

	/** Validates the answers against the exact version they were filled in with, then stores them. */
	@Transactional
	public Submitted submit(SubmitRequest request) {
		if (request.formId() == null || request.version() == null) {
			throw new ValidationException("formId ve version zorunlu", java.util.List.of());
		}
		FormDefinitionEntity version = definitions.get(request.formId(), request.version());
		if (!version.isPublished()) {
			throw new ConflictException("Yayınlanmamış bir versiyona cevap gönderilemez (" + request.formId() + " v"
					+ request.version() + ")");
		}
		FormDefinition definition = reader.read(version.getDefinition());
		Result result = validator.validate(definition, request.values(), LocalDate.now(clock));
		if (!result.valid()) {
			throw new ValidationException("Cevaplar geçersiz", result.errors());
		}
		SubmissionEntity saved = repository.save(new SubmissionEntity(version.getId(), version.getFormKey(),
				version.getVersion(), json.writeValueAsString(result.answers()), clock.instant()));
		return new Submitted(saved.getId(), saved.getFormKey(), saved.getVersion(), saved.getSubmittedAt());
	}
}

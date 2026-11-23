package com.portfolio.forms.definition;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.portfolio.forms.common.ApiExceptions.ConflictException;
import com.portfolio.forms.common.ApiExceptions.NotFoundException;
import com.portfolio.forms.common.ApiExceptions.ValidationException;
import com.portfolio.forms.definition.FormDefinitionEntity.Status;
import com.portfolio.forms.schema.DefinitionError;
import com.portfolio.forms.schema.DefinitionErrorCode;
import com.portfolio.forms.schema.DefinitionValidationService;
import com.portfolio.forms.schema.DefinitionValidationService.ValidationReport;
import com.portfolio.forms.schema.FormDefinition;
import com.portfolio.forms.schema.FormDefinitionReader;

import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Form definitions and their versions.
 *
 * <ul>
 * <li>A form has at most one draft; only a draft can be edited or deleted.</li>
 * <li>Publishing freezes a version. To change a published form, open a new draft, which gets the next version
 * number.</li>
 * <li>The server owns version numbers: the {@code version} in a saved document is always the stored one.</li>
 * </ul>
 */
@Service
@Transactional
public class DefinitionService {

	/** A form id and its versions: what the form list shows. */
	public record FormSummary(String formKey, String title, Integer publishedVersion, Integer draftVersion,
			Instant updatedAt) {
	}

	private final FormDefinitionRepository repository;
	private final DefinitionValidationService validation;
	private final FormDefinitionReader reader;
	private final JsonMapper json;
	private final Clock clock;

	DefinitionService(FormDefinitionRepository repository, DefinitionValidationService validation,
			FormDefinitionReader reader, JsonMapper json, Clock clock) {
		this.repository = repository;
		this.validation = validation;
		this.reader = reader;
		this.json = json;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public List<FormSummary> list() {
		Map<String, List<VersionInfo>> byForm = new LinkedHashMap<>();
		for (VersionInfo info : repository.findVersionInfo(null)) {
			byForm.computeIfAbsent(info.formKey(), k -> new ArrayList<>()).add(info);
		}
		return byForm.values().stream().map(versions -> {
			VersionInfo latest = versions.get(0); // newest first
			Integer published = versions.stream().filter(v -> v.status() == Status.PUBLISHED).findFirst()
				.map(VersionInfo::version).orElse(null);
			Integer draft = versions.stream().filter(v -> v.status() == Status.DRAFT).findFirst()
				.map(VersionInfo::version).orElse(null);
			Instant updated = versions.stream().map(VersionInfo::updatedAt).max(Instant::compareTo).orElseThrow();
			return new FormSummary(latest.formKey(), latest.title(), published, draft, updated);
		}).toList();
	}

	@Transactional(readOnly = true)
	public List<VersionInfo> versions(String formKey) {
		List<VersionInfo> versions = repository.findVersionInfo(formKey);
		if (versions.isEmpty()) {
			throw new NotFoundException("'" + formKey + "' adında bir form yok");
		}
		return versions;
	}

	@Transactional(readOnly = true)
	public FormDefinitionEntity latestPublished(String formKey) {
		return repository.findFirstByFormKeyAndStatusOrderByVersionDesc(formKey, Status.PUBLISHED)
			.orElseThrow(() -> new NotFoundException("'" + formKey + "' formunun yayınlanmış bir versiyonu yok"));
	}

	@Transactional(readOnly = true)
	public FormDefinitionEntity get(String formKey, int version) {
		return repository.findByFormKeyAndVersion(formKey, version)
			.orElseThrow(() -> new NotFoundException("'" + formKey + "' v" + version + " bulunamadı"));
	}

	/** Saves a new form, or the next version of an existing one, as a draft. */
	public VersionInfo createDraft(String document) {
		FormDefinition definition = validated(document);
		String formKey = definition.id();
		repository.findFirstByFormKeyAndStatusOrderByVersionDesc(formKey, Status.DRAFT).ifPresent(draft -> {
			throw new ConflictException("'" + formKey + "' için zaten bir taslak var (v" + draft.getVersion()
					+ "); yenisini açmak yerine onu düzenleyin");
		});
		int version = repository.findMaxVersion(formKey).orElse(0) + 1;
		FormDefinitionEntity entity = new FormDefinitionEntity(formKey, version, definition.title(),
				withVersion(document, version), clock.instant());
		return VersionInfo.of(repository.saveAndFlush(entity));
	}

	/** Opens a new draft as a copy of the latest published version. */
	public VersionInfo createDraftFromPublished(String formKey) {
		return createDraft(latestPublished(formKey).getDefinition());
	}

	public VersionInfo updateDraft(String formKey, int version, String document) {
		FormDefinitionEntity entity = editableDraft(formKey, version);
		FormDefinition definition = validated(document);
		if (!formKey.equals(definition.id())) {
			throw new ValidationException("Form id'si değiştirilemez", List.of(new DefinitionError("id",
					DefinitionErrorCode.INVALID_VALUE, "Form id'si değiştirilemez; '" + formKey + "' olmalı")));
		}
		entity.replaceDraft(definition.title(), withVersion(document, version), clock.instant());
		return VersionInfo.of(entity);
	}

	public VersionInfo publish(String formKey, int version) {
		FormDefinitionEntity entity = editableDraft(formKey, version);
		validated(entity.getDefinition()); // rules may have tightened since it was saved
		entity.publish(clock.instant());
		return VersionInfo.of(entity);
	}

	public void deleteDraft(String formKey, int version) {
		repository.delete(editableDraft(formKey, version));
	}

	private FormDefinitionEntity editableDraft(String formKey, int version) {
		FormDefinitionEntity entity = get(formKey, version);
		if (entity.isPublished()) {
			throw new ConflictException("Yayınlanmış versiyon değiştirilemez (" + formKey + " v" + version
					+ "). Değişiklik için yeni bir taslak açın.");
		}
		return entity;
	}

	private FormDefinition validated(String document) {
		ValidationReport report = validation.validate(document);
		if (!report.valid()) {
			throw new ValidationException("Form tanımı geçersiz", report.errors());
		}
		return reader.read(document);
	}

	/** The document with its {@code version} set to the stored version number. */
	private String withVersion(String document, int version) {
		ObjectNode node = (ObjectNode) json.readTree(document);
		node.put("version", version);
		return json.writeValueAsString(node);
	}
}

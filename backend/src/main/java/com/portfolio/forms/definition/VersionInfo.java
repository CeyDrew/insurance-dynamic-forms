package com.portfolio.forms.definition;

import java.time.Instant;

import com.portfolio.forms.definition.FormDefinitionEntity.Status;

/** A form version without its definition body. */
public record VersionInfo(String formKey, int version, String title, Status status, Instant createdAt,
		Instant updatedAt, Instant publishedAt) {

	static VersionInfo of(FormDefinitionEntity e) {
		return new VersionInfo(e.getFormKey(), e.getVersion(), e.getTitle(), e.getStatus(), e.getCreatedAt(),
				e.getUpdatedAt(), e.getPublishedAt());
	}
}

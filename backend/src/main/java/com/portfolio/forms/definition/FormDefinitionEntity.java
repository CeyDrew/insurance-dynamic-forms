package com.portfolio.forms.definition;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;

/** One version of a form. A published version is never modified; see {@link DefinitionService}. */
@Entity
@Table(name = "form_definition")
public class FormDefinitionEntity {

	public enum Status {
		DRAFT, PUBLISHED
	}

	@Id
	@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "form_definition_seq")
	@SequenceGenerator(name = "form_definition_seq", sequenceName = "form_definition_seq", allocationSize = 50)
	private Long id;

	@Column(name = "form_key", nullable = false, updatable = false)
	private String formKey;

	@Column(nullable = false, updatable = false)
	private int version;

	@Column(nullable = false)
	private String title;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Status status;

	@Lob
	@Column(nullable = false)
	private String definition;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Column(name = "published_at")
	private Instant publishedAt;

	protected FormDefinitionEntity() {
	}

	FormDefinitionEntity(String formKey, int version, String title, String definition, Instant now) {
		this.formKey = formKey;
		this.version = version;
		this.title = title;
		this.definition = definition;
		this.status = Status.DRAFT;
		this.createdAt = now;
		this.updatedAt = now;
	}

	void replaceDraft(String title, String definition, Instant now) {
		requireDraft();
		this.title = title;
		this.definition = definition;
		this.updatedAt = now;
	}

	void publish(Instant now) {
		requireDraft();
		this.status = Status.PUBLISHED;
		this.publishedAt = now;
		this.updatedAt = now;
	}

	private void requireDraft() {
		if (status != Status.DRAFT) {
			throw new IllegalStateException("Published version " + formKey + " v" + version + " is immutable");
		}
	}

	public Long getId() {
		return id;
	}

	public String getFormKey() {
		return formKey;
	}

	public int getVersion() {
		return version;
	}

	public String getTitle() {
		return title;
	}

	public Status getStatus() {
		return status;
	}

	public boolean isPublished() {
		return status == Status.PUBLISHED;
	}

	public String getDefinition() {
		return definition;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public Instant getPublishedAt() {
		return publishedAt;
	}
}

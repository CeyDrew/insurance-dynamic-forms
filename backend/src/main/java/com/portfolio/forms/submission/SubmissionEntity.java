package com.portfolio.forms.submission;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;

/** Answers to one published form version, stored as validated, canonical JSON. */
@Entity
@Table(name = "form_submission")
class SubmissionEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "form_submission_seq")
	@SequenceGenerator(name = "form_submission_seq", sequenceName = "form_submission_seq", allocationSize = 50)
	private Long id;

	@Column(name = "definition_id", nullable = false, updatable = false)
	private Long definitionId;

	@Column(name = "form_key", nullable = false, updatable = false)
	private String formKey;

	@Column(nullable = false, updatable = false)
	private int version;

	@Lob
	@Column(nullable = false, updatable = false)
	private String answers;

	@Column(name = "submitted_at", nullable = false, updatable = false)
	private Instant submittedAt;

	protected SubmissionEntity() {
	}

	SubmissionEntity(Long definitionId, String formKey, int version, String answers, Instant submittedAt) {
		this.definitionId = definitionId;
		this.formKey = formKey;
		this.version = version;
		this.answers = answers;
		this.submittedAt = submittedAt;
	}

	Long getId() {
		return id;
	}

	String getFormKey() {
		return formKey;
	}

	int getVersion() {
		return version;
	}

	Instant getSubmittedAt() {
		return submittedAt;
	}
}

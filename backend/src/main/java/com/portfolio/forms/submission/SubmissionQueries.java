package com.portfolio.forms.submission;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.core.simple.JdbcClient.StatementSpec;
import org.springframework.stereotype.Repository;

import com.portfolio.forms.common.ApiExceptions.ValidationException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads submissions with Oracle's SQL/JSON functions, straight on the stored answers:
 * {@code JSON_EXISTS} filters by an answer, {@code JSON_TABLE} turns repeater rows into SQL rows.
 */
@Repository
class SubmissionQueries {

	/** Field ids end up inside a JSON path literal (paths cannot be bound), so only plain identifiers pass. */
	private static final Pattern IDENTIFIER = Pattern.compile("^[a-zA-Z][a-zA-Z0-9_]*$");
	private static final Pattern NUMBER = Pattern.compile("^-?\\d+(\\.\\d+)?$");

	record SubmissionView(long id, String formId, int version, Instant submittedAt, JsonNode answers) {
	}

	record Page(List<SubmissionView> items, long total, int page, int size) {
	}

	/** One repeater row of one submission. {@code index} is 1-based, as JSON_TABLE's ordinality. */
	record RepeaterRow(long submissionId, int version, Instant submittedAt, int index, JsonNode row) {
	}

	/** {@code field = value}; an array answer matches when any element equals the value. */
	record AnswerFilter(String field, String value) {
	}

	private final JdbcClient jdbc;
	private final JsonMapper json;

	SubmissionQueries(JdbcClient jdbc, JsonMapper json) {
		this.jdbc = jdbc;
		this.json = json;
	}

	Page find(String formKey, Integer version, AnswerFilter filter, int page, int size) {
		StringBuilder where = new StringBuilder(" WHERE 1 = 1");
		if (formKey != null) {
			where.append(" AND form_key = :formKey");
		}
		if (version != null) {
			where.append(" AND version = :version");
		}
		Object filterValue = null;
		if (filter != null) {
			String field = identifier(filter.field());
			// Booleans go in as JSON literals; numbers and text are bound, compared with their JSON type.
			switch (filter.value()) {
				case "true", "false" -> where.append(" AND JSON_EXISTS(answers, '$.")
					.append(field).append("?(@ == ").append(filter.value()).append(")')");
				default -> {
					filterValue = NUMBER.matcher(filter.value()).matches() ? new BigDecimal(filter.value())
							: filter.value();
					where.append(" AND JSON_EXISTS(answers, '$.").append(field).append("?(@ == $v)' PASSING :v AS \"v\")");
				}
			}
		}

		StatementSpec count = bind(jdbc.sql("SELECT COUNT(*) FROM form_submission" + where), formKey, version,
				filterValue);
		long total = count.query(Long.class).single();

		StatementSpec select = bind(jdbc.sql("SELECT id, form_key, version, submitted_at, answers FROM form_submission"
				+ where + " ORDER BY submitted_at DESC, id DESC OFFSET :offset ROWS FETCH NEXT :size ROWS ONLY"),
				formKey, version, filterValue)
			.param("offset", page * size)
			.param("size", size);
		List<SubmissionView> items = select.query((rs, i) -> new SubmissionView(rs.getLong("id"),
				rs.getString("form_key"), rs.getInt("version"), instant(rs.getTimestamp("submitted_at")),
				json.readTree(rs.getString("answers"))))
			.list();
		return new Page(items, total, page, size);
	}

	Optional<SubmissionView> findById(long id) {
		return jdbc.sql("SELECT id, form_key, version, submitted_at, answers FROM form_submission WHERE id = :id")
			.param("id", id)
			.query((rs, i) -> new SubmissionView(rs.getLong("id"), rs.getString("form_key"), rs.getInt("version"),
					instant(rs.getTimestamp("submitted_at")), json.readTree(rs.getString("answers"))))
			.optional();
	}

	/** Every row of a repeater across a form's submissions, newest submission first. */
	List<RepeaterRow> repeaterRows(String formKey, String repeaterId) {
		String repeater = identifier(repeaterId);
		return jdbc.sql("""
				SELECT s.id, s.version, s.submitted_at, jt.idx, jt.row_json
				FROM form_submission s,
				     JSON_TABLE(s.answers, '$.%s[*]'
				         COLUMNS (idx FOR ORDINALITY, row_json VARCHAR2(4000) FORMAT JSON PATH '$')) jt
				WHERE s.form_key = :formKey
				ORDER BY s.submitted_at DESC, s.id DESC, jt.idx""".formatted(repeater))
			.param("formKey", formKey)
			.query((rs, i) -> new RepeaterRow(rs.getLong("id"), rs.getInt("version"),
					instant(rs.getTimestamp("submitted_at")), rs.getInt("idx"), json.readTree(rs.getString("row_json"))))
			.list();
	}

	private static StatementSpec bind(StatementSpec spec, String formKey, Integer version, Object filterValue) {
		if (formKey != null) {
			spec = spec.param("formKey", formKey);
		}
		if (version != null) {
			spec = spec.param("version", version);
		}
		if (filterValue != null) {
			spec = spec.param("v", filterValue);
		}
		return spec;
	}

	private static String identifier(String name) {
		if (name == null || !IDENTIFIER.matcher(name).matches()) {
			throw new ValidationException("Geçersiz alan adı", List.of(new SubmissionValidator.SubmissionError(
					"field", "INVALID_VALUE", "Alan adı harfle başlamalı; harf, rakam ve '_' içerebilir")));
		}
		return name;
	}

	private static Instant instant(Timestamp timestamp) {
		return timestamp.toInstant();
	}
}

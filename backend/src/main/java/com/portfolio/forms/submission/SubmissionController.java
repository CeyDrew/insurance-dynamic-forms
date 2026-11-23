package com.portfolio.forms.submission;

import java.net.URI;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.portfolio.forms.common.ApiExceptions.NotFoundException;
import com.portfolio.forms.submission.SubmissionQueries.AnswerFilter;
import com.portfolio.forms.submission.SubmissionQueries.Page;
import com.portfolio.forms.submission.SubmissionQueries.RepeaterRow;
import com.portfolio.forms.submission.SubmissionQueries.SubmissionView;
import com.portfolio.forms.submission.SubmissionService.SubmitRequest;
import com.portfolio.forms.submission.SubmissionService.Submitted;

@RestController
@RequestMapping("/api/submissions")
class SubmissionController {

	private static final int MAX_PAGE_SIZE = 100;

	private final SubmissionService service;
	private final SubmissionQueries queries;

	SubmissionController(SubmissionService service, SubmissionQueries queries) {
		this.service = service;
		this.queries = queries;
	}

	/** 201 when stored; 400 with {@code errors: [{ field, code, message }]} when a rule is broken. */
	@PostMapping
	ResponseEntity<Submitted> submit(@RequestBody SubmitRequest request) {
		Submitted submitted = service.submit(request);
		return ResponseEntity.created(URI.create("/api/submissions/" + submitted.id())).body(submitted);
	}

	/**
	 * Newest first. {@code field} + {@code value} filter on an answer, e.g. {@code field=hasLpg&value=true}
	 * for vehicles with LPG or {@code field=extras&value=glass} for a multiselect choice.
	 */
	@GetMapping
	Page list(@RequestParam(required = false) String formId, @RequestParam(required = false) Integer version,
			@RequestParam(required = false) String field, @RequestParam(required = false) String value,
			@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
		AnswerFilter filter = field == null || field.isBlank() ? null : new AnswerFilter(field, value == null ? "" : value);
		return queries.find(blankToNull(formId), version, filter, Math.max(page, 0),
				Math.clamp(size, 1, MAX_PAGE_SIZE));
	}

	@GetMapping("/{id}")
	SubmissionView get(@PathVariable long id) {
		return queries.findById(id).orElseThrow(() -> new NotFoundException("Cevap #" + id + " bulunamadı"));
	}

	/** Repeater rows of all submissions of a form, e.g. every driver on every casco submission. */
	@GetMapping("/rows")
	List<RepeaterRow> rows(@RequestParam String formId, @RequestParam String repeater) {
		return queries.repeaterRows(formId, repeater);
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value;
	}
}

package com.portfolio.forms.schema;

import java.util.List;

/**
 * Root of a form definition document. See {@code docs/form-definition-spec.md}.
 * Wrapper types are used so that a missing key can be told apart from a default value.
 */
public record FormDefinition(
		String id,
		Integer version,
		String title,
		String description,
		List<StepDefinition> steps) {
}

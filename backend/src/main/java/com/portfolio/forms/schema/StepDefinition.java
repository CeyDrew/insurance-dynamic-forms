package com.portfolio.forms.schema;

import java.util.List;

public record StepDefinition(
		String id,
		String title,
		String description,
		String visibleWhen,
		List<FieldDefinition> fields) {
}

package com.portfolio.forms.schema;

import java.util.List;

import tools.jackson.databind.JsonNode;

/**
 * A single question. All field types share one shape; which type-specific keys are
 * allowed is enforced by {@link FormDefinitionValidator}, not by the JSON binding,
 * so that a misplaced key yields a readable error instead of a mapping failure.
 */
public record FieldDefinition(
		String id,
		FieldType type,
		String label,
		String hint,
		String placeholder,
		Boolean required,
		JsonNode defaultValue,
		String visibleWhen,
		String requiredWhen,
		String disabledWhen,
		List<ValidatorDefinition> validators,
		// textarea
		Integer rows,
		// number
		Integer decimals,
		// currency
		String currency,
		// select, radio, multiselect
		List<OptionDefinition> options,
		OptionsSource optionsSource,
		// repeater
		List<FieldDefinition> fields,
		String itemLabel,
		String addLabel,
		// computed
		String expression,
		ComputedFormat format,
		// info
		String content) {
}

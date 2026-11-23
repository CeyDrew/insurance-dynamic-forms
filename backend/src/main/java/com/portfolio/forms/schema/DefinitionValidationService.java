package com.portfolio.forms.schema;

import java.util.List;

import org.springframework.stereotype.Service;

/** Reads definition JSON and runs every check on it. */
@Service
public class DefinitionValidationService {

	private final FormDefinitionReader reader;
	private final FormDefinitionValidator validator;

	public DefinitionValidationService(FormDefinitionReader reader, FormDefinitionValidator validator) {
		this.reader = reader;
		this.validator = validator;
	}

	public ValidationReport validate(String json) {
		FormDefinition definition;
		try {
			definition = reader.read(json);
		}
		catch (DefinitionParseException ex) {
			return ValidationReport.of(List.of(ex.error()));
		}
		return ValidationReport.of(validator.validate(definition));
	}

	public record ValidationReport(boolean valid, List<DefinitionError> errors) {

		static ValidationReport of(List<DefinitionError> errors) {
			return new ValidationReport(errors.isEmpty(), List.copyOf(errors));
		}
	}
}

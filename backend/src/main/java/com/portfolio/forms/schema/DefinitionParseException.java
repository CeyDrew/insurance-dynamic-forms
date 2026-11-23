package com.portfolio.forms.schema;

/** The definition JSON could not be bound to the model; carries the single error that stopped it. */
public class DefinitionParseException extends RuntimeException {

	private final DefinitionError error;

	public DefinitionParseException(DefinitionError error) {
		super(error.path() + ": " + error.message());
		this.error = error;
	}

	public DefinitionError error() {
		return error;
	}
}

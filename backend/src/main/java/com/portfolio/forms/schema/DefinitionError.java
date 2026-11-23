package com.portfolio.forms.schema;

/**
 * One problem found in a form definition.
 *
 * @param path location in the document, e.g. {@code steps[0].fields[2].visibleWhen}; empty for the root
 */
public record DefinitionError(String path, DefinitionErrorCode code, String message) {
}

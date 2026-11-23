package com.portfolio.forms.schema;

import tools.jackson.databind.JsonNode;

public record ValidatorDefinition(ValidatorType type, JsonNode value, String message) {
}

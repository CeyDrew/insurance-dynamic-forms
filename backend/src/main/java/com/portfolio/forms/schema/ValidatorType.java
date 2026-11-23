package com.portfolio.forms.schema;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum ValidatorType {
	@JsonProperty("minLength") MIN_LENGTH,
	@JsonProperty("maxLength") MAX_LENGTH,
	@JsonProperty("pattern") PATTERN,
	@JsonProperty("min") MIN,
	@JsonProperty("max") MAX,
	@JsonProperty("minDate") MIN_DATE,
	@JsonProperty("maxDate") MAX_DATE,
	@JsonProperty("minItems") MIN_ITEMS,
	@JsonProperty("maxItems") MAX_ITEMS
}

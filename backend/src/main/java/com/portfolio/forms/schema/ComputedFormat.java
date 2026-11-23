package com.portfolio.forms.schema;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum ComputedFormat {
	@JsonProperty("number") NUMBER,
	@JsonProperty("currency") CURRENCY,
	@JsonProperty("text") TEXT
}

package com.portfolio.forms.schema;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum FieldType {
	@JsonProperty("text") TEXT,
	@JsonProperty("textarea") TEXTAREA,
	@JsonProperty("number") NUMBER,
	@JsonProperty("currency") CURRENCY,
	@JsonProperty("date") DATE,
	@JsonProperty("boolean") BOOLEAN,
	@JsonProperty("select") SELECT,
	@JsonProperty("multiselect") MULTISELECT,
	@JsonProperty("radio") RADIO,
	@JsonProperty("repeater") REPEATER,
	@JsonProperty("computed") COMPUTED,
	@JsonProperty("info") INFO;

	/** Types whose value the user never enters. */
	public boolean isReadOnly() {
		return this == COMPUTED || this == INFO;
	}
}

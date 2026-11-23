package com.portfolio.forms.schema;

import com.fasterxml.jackson.annotation.JsonProperty;

public record OptionsSource(Type type, String url) {

	public enum Type {
		@JsonProperty("remote") REMOTE
	}
}

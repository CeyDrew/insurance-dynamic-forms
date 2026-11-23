package com.portfolio.forms.lookup;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import com.portfolio.forms.schema.OptionDefinition;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Static option lists from {@code classpath:lookups/<name>.json}, cached after the first read. */
@Service
public class LookupService {

	public static final String URL_PREFIX = "/api/lookups/";
	private static final Pattern NAME = Pattern.compile("^[a-z][a-z0-9-]*$");

	private final JsonMapper json;
	private final Map<String, Optional<String>> raw = new ConcurrentHashMap<>();
	private final Map<String, Optional<List<OptionDefinition>>> parsed = new ConcurrentHashMap<>();

	public LookupService(JsonMapper json) {
		this.json = json;
	}

	/** The list as stored, for serving it unchanged. */
	public Optional<String> json(String name) {
		if (!NAME.matcher(name).matches()) {
			return Optional.empty();
		}
		return raw.computeIfAbsent(name, n -> {
			ClassPathResource resource = new ClassPathResource("lookups/" + n + ".json");
			if (!resource.exists()) {
				return Optional.empty();
			}
			try {
				return Optional.of(resource.getContentAsString(StandardCharsets.UTF_8));
			}
			catch (IOException ex) {
				throw new UncheckedIOException(ex);
			}
		});
	}

	public Optional<List<OptionDefinition>> options(String name) {
		return parsed.computeIfAbsent(name,
				n -> json(n).map(text -> json.readValue(text, new TypeReference<List<OptionDefinition>>() {
				})));
	}

	/** Options behind an {@code optionsSource} url, when it is one of ours. */
	public Optional<List<OptionDefinition>> optionsForUrl(String url) {
		if (url == null || !url.startsWith(URL_PREFIX)) {
			return Optional.empty();
		}
		return options(url.substring(URL_PREFIX.length()));
	}
}

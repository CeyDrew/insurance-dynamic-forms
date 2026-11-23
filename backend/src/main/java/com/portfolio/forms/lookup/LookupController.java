package com.portfolio.forms.lookup;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Option lists for fields with {@code optionsSource: remote}. Static demo data from
 * {@code classpath:lookups/<name>.json}, each an array of {@code { value, label }}.
 */
@RestController
@RequestMapping("/api/lookups")
class LookupController {

	private static final Pattern NAME = Pattern.compile("^[a-z][a-z0-9-]*$");

	@GetMapping("/{name}")
	ResponseEntity<String> lookup(@PathVariable String name) {
		ClassPathResource resource = new ClassPathResource("lookups/" + name + ".json");
		if (!NAME.matcher(name).matches() || !resource.exists()) {
			return ResponseEntity.notFound().build();
		}
		try {
			return ResponseEntity.ok()
				.contentType(MediaType.APPLICATION_JSON)
				.cacheControl(CacheControl.noCache())
				.body(resource.getContentAsString(StandardCharsets.UTF_8));
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}
}

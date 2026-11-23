package com.portfolio.forms.lookup;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Option lists for fields with {@code optionsSource: remote}; each an array of {@code { value, label }}. */
@RestController
@RequestMapping("/api/lookups")
class LookupController {

	private final LookupService lookups;

	LookupController(LookupService lookups) {
		this.lookups = lookups;
	}

	@GetMapping("/{name}")
	ResponseEntity<String> lookup(@PathVariable String name) {
		return lookups.json(name)
			.map(body -> ResponseEntity.ok()
				.contentType(MediaType.APPLICATION_JSON)
				.cacheControl(CacheControl.noCache())
				.body(body))
			.orElseGet(() -> ResponseEntity.notFound().build());
	}
}

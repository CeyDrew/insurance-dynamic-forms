package com.portfolio.forms.definition;

import java.net.URI;
import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.portfolio.forms.definition.DefinitionService.FormSummary;

/**
 * Definition CRUD and versioning. Definition bodies are passed through as raw JSON so the
 * stored document is exactly what the designer sent (apart from the server-owned version).
 */
@RestController
@RequestMapping("/api/definitions")
class DefinitionController {

	private final DefinitionService service;

	DefinitionController(DefinitionService service) {
		this.service = service;
	}

	@GetMapping
	List<FormSummary> list() {
		return service.list();
	}

	/** The latest published version: what customers fill in. */
	@GetMapping(path = "/{formKey}", produces = MediaType.APPLICATION_JSON_VALUE)
	String latestPublished(@PathVariable String formKey) {
		return service.latestPublished(formKey).getDefinition();
	}

	@GetMapping("/{formKey}/versions")
	List<VersionInfo> versions(@PathVariable String formKey) {
		return service.versions(formKey);
	}

	@GetMapping(path = "/{formKey}/versions/{version}", produces = MediaType.APPLICATION_JSON_VALUE)
	String version(@PathVariable String formKey, @PathVariable int version) {
		return service.get(formKey, version).getDefinition();
	}

	/** New form, or next version of an existing form, as a draft. */
	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<VersionInfo> create(@RequestBody String document) {
		return created(service.createDraft(document));
	}

	/** New draft copied from the latest published version. */
	@PostMapping("/{formKey}/drafts")
	ResponseEntity<VersionInfo> createDraftFromPublished(@PathVariable String formKey) {
		return created(service.createDraftFromPublished(formKey));
	}

	@PutMapping(path = "/{formKey}/versions/{version}", consumes = MediaType.APPLICATION_JSON_VALUE)
	VersionInfo update(@PathVariable String formKey, @PathVariable int version, @RequestBody String document) {
		return service.updateDraft(formKey, version, document);
	}

	@PostMapping("/{formKey}/versions/{version}/publish")
	VersionInfo publish(@PathVariable String formKey, @PathVariable int version) {
		return service.publish(formKey, version);
	}

	@DeleteMapping("/{formKey}/versions/{version}")
	ResponseEntity<Void> delete(@PathVariable String formKey, @PathVariable int version) {
		service.deleteDraft(formKey, version);
		return ResponseEntity.noContent().build();
	}

	private static ResponseEntity<VersionInfo> created(VersionInfo info) {
		URI location = URI.create("/api/definitions/" + info.formKey() + "/versions/" + info.version());
		return ResponseEntity.created(location).body(info);
	}
}

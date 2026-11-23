package com.portfolio.forms.definition;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.portfolio.forms.schema.DefinitionValidationService;
import com.portfolio.forms.schema.DefinitionValidationService.ValidationReport;

@RestController
@RequestMapping("/api/definitions")
class DefinitionValidationController {

	private final DefinitionValidationService validationService;

	DefinitionValidationController(DefinitionValidationService validationService) {
		this.validationService = validationService;
	}

	/**
	 * Checks a definition without saving it. Always 200: an invalid definition is a valid
	 * answer to "is this valid?". The body is taken raw so JSON errors are reported too.
	 */
	@PostMapping(path = "/validate", consumes = MediaType.APPLICATION_JSON_VALUE)
	ValidationReport validate(@RequestBody String json) {
		return validationService.validate(json);
	}
}

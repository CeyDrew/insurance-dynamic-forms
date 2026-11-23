package com.portfolio.forms.definition;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.portfolio.forms.schema.DefinitionValidationService;
import com.portfolio.forms.schema.FormDefinitionReader;
import com.portfolio.forms.schema.FormDefinitionValidator;

@WebMvcTest(DefinitionValidationController.class)
@Import({ DefinitionValidationService.class, FormDefinitionReader.class, FormDefinitionValidator.class })
class DefinitionValidationControllerTest {

	@Autowired
	MockMvc mvc;

	@Test
	void validDefinition() throws Exception {
		String casco = Files.readString(Path.of("..", "examples", "casco.json"));

		mvc.perform(post("/api/definitions/validate").contentType(MediaType.APPLICATION_JSON).content(casco))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.valid").value(true))
			.andExpect(jsonPath("$.errors").isEmpty());
	}

	@Test
	void invalidDefinitionReturnsPathCodeAndMessage() throws Exception {
		String json = """
				{ "id": "f", "version": 1, "title": "T", "steps": [ { "id": "s", "title": "S", "fields": [
				  { "id": "b", "type": "text", "label": "B", "visibleWhen": "hasLpg == true" } ] } ] }""";

		mvc.perform(post("/api/definitions/validate").contentType(MediaType.APPLICATION_JSON).content(json))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.valid").value(false))
			.andExpect(jsonPath("$.errors[0].path").value("steps[0].fields[0].visibleWhen"))
			.andExpect(jsonPath("$.errors[0].code").value("UNKNOWN_REFERENCE"))
			.andExpect(jsonPath("$.errors[0].message").value("'hasLpg' adında bir alan yok"));
	}

	@Test
	void malformedJsonIsReportedNotRejected() throws Exception {
		mvc.perform(post("/api/definitions/validate").contentType(MediaType.APPLICATION_JSON).content("{ \"id\": "))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.valid").value(false))
			.andExpect(jsonPath("$.errors[0].code").value("INVALID_JSON"));
	}
}

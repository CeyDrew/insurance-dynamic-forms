package com.portfolio.forms.definition;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import com.portfolio.forms.schema.FormDefinitionReader;

@WebMvcTest(ExampleDefinitionController.class)
@Import(FormDefinitionReader.class)
class ExampleDefinitionControllerTest {

	@Autowired
	MockMvc mvc;

	@Test
	void listsTheFourProductsByTitle() throws Exception {
		mvc.perform(get("/api/examples"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(4))
			.andExpect(jsonPath("$[0].id").value("casco-risk"))
			.andExpect(jsonPath("$[0].title").value("Kasko Risk Formu"))
			.andExpect(jsonPath("$[0].version").value(1));
	}

	@Test
	void returnsTheDefinition() throws Exception {
		mvc.perform(get("/api/examples/travel-risk"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.steps[1].fields[0].type").value("repeater"));
	}

	@Test
	void unknownExampleIs404() throws Exception {
		mvc.perform(get("/api/examples/nope")).andExpect(status().isNotFound());
	}
}

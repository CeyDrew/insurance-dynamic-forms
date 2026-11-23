package com.portfolio.forms;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * The whole API against a real Oracle (Testcontainers): Flyway schema, example seeding,
 * versioning rules, server-side re-validation and the SQL/JSON queries.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {

	private static final JsonMapper JSON = JsonMapper.builder().build();
	private static String casco;

	@Autowired
	MockMvc mvc;

	@BeforeAll
	static void readExamples() throws Exception {
		casco = Files.readString(Path.of("..", "examples", "casco.json"));
	}

	// ---- definitions ------------------------------------------------------------------

	@Test
	void seedsThePublishedExamples() throws Exception {
		mvc.perform(get("/api/definitions"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[?(@.formKey == 'casco-risk')].publishedVersion").value(hasItem(1)))
			.andExpect(jsonPath("$[?(@.formKey == 'travel-risk')].title").value(hasItem("Seyahat Sağlık Sigortası Formu")));
		mvc.perform(get("/api/definitions/health-risk"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value("health-risk"))
			.andExpect(jsonPath("$.version").value(1));
	}

	@Test
	void versioningLifecycle() throws Exception {
		String pet = withId(casco, "pet-lifecycle", "Evcil Hayvan");

		create(pet).andExpect(status().isCreated())
			.andExpect(header().string("Location", "/api/definitions/pet-lifecycle/versions/1"))
			.andExpect(jsonPath("$.version").value(1))
			.andExpect(jsonPath("$.status").value("DRAFT"));
		create(pet).andExpect(status().isConflict()).andExpect(jsonPath("$.detail", containsString("zaten bir taslak")));
		mvc.perform(get("/api/definitions/pet-lifecycle")).andExpect(status().isNotFound());

		mvc.perform(put("/api/definitions/pet-lifecycle/versions/1").contentType(MediaType.APPLICATION_JSON)
			.content(withId(casco, "pet-lifecycle", "Evcil Hayvan v1")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.title").value("Evcil Hayvan v1"));
		mvc.perform(post("/api/definitions/pet-lifecycle/versions/1/publish"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("PUBLISHED"));

		// A published version is frozen.
		mvc.perform(put("/api/definitions/pet-lifecycle/versions/1").contentType(MediaType.APPLICATION_JSON)
			.content(withId(casco, "pet-lifecycle", "Değişmemeli")))
			.andExpect(status().isConflict());
		mvc.perform(post("/api/definitions/pet-lifecycle/versions/1/publish")).andExpect(status().isConflict());
		mvc.perform(delete("/api/definitions/pet-lifecycle/versions/1")).andExpect(status().isConflict());

		// Changes go into a new version.
		mvc.perform(post("/api/definitions/pet-lifecycle/drafts"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.version").value(2));
		mvc.perform(get("/api/definitions/pet-lifecycle/versions/2"))
			.andExpect(jsonPath("$.version").value(2))
			.andExpect(jsonPath("$.title").value("Evcil Hayvan v1"));
		mvc.perform(get("/api/definitions/pet-lifecycle")).andExpect(jsonPath("$.version").value(1));
		mvc.perform(get("/api/definitions/pet-lifecycle/versions"))
			.andExpect(jsonPath("$[*].version").value(contains(2, 1)))
			.andExpect(jsonPath("$[*].status").value(contains("DRAFT", "PUBLISHED")));

		mvc.perform(delete("/api/definitions/pet-lifecycle/versions/2")).andExpect(status().isNoContent());
		mvc.perform(get("/api/definitions/pet-lifecycle/versions/2")).andExpect(status().isNotFound());
	}

	@Test
	void serverOwnsTheVersionNumber() throws Exception {
		String claimsVersion9 = withId(casco, "pet-version", "Versiyon").replace("\"version\": 1", "\"version\": 9");

		create(claimsVersion9).andExpect(jsonPath("$.version").value(1));
		mvc.perform(get("/api/definitions/pet-version/versions/1")).andExpect(jsonPath("$.version").value(1));
	}

	@Test
	void rejectsInvalidDefinitionsWithPathedErrors() throws Exception {
		String broken = withId(casco, "pet-broken", "Bozuk").replace("\"hasLpg == true\"", "\"hasLgp == true\"");

		create(broken).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].path").value("steps[0].fields[7].visibleWhen"))
			.andExpect(jsonPath("$.errors[0].code").value("UNKNOWN_REFERENCE"));
	}

	@Test
	void formIdCannotChangeInADraft() throws Exception {
		create(withId(casco, "pet-rename", "Ad")).andExpect(status().isCreated());

		mvc.perform(put("/api/definitions/pet-rename/versions/1").contentType(MediaType.APPLICATION_JSON)
			.content(withId(casco, "pet-renamed", "Ad")))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].path").value("id"));
	}

	// ---- submissions ------------------------------------------------------------------

	@Test
	void storesAValidSubmissionWithServerComputedValues() throws Exception {
		Map<String, Object> values = cascoAnswers();
		values.put("vehicleAge", 99);

		String body = submit("casco-risk", 1, values).andExpect(status().isCreated())
			.andExpect(jsonPath("$.formId").value("casco-risk"))
			.andReturn().getResponse().getContentAsString();
		long id = JSON.readTree(body).get("id").longValue();

		mvc.perform(get("/api/submissions/" + id))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.answers.plate").value("34ABC123"))
			.andExpect(jsonPath("$.answers.vehicleAge").value(java.time.Year.now().getValue() - 2019))
			.andExpect(jsonPath("$.answers.drivers[0].driverName").value("Ayşe Yılmaz"));
	}

	@Test
	void rejectsBrokenRulesWithFieldErrors() throws Exception {
		Map<String, Object> values = cascoAnswers();
		values.put("plate", "99ABC123");
		values.put("lpgBrand", null);
		values.put("drivers", List.of(Map.of("driverBirthDate", "1990-01-01", "licenseYear", 2010)));

		submit("casco-risk", 1, values).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.title").value("Doğrulama hatası"))
			.andExpect(jsonPath("$.errors[?(@.field == 'plate')].message").value(hasItem("Geçersiz plaka")))
			.andExpect(jsonPath("$.errors[?(@.field == 'lpgBrand')].code").value(hasItem("REQUIRED")))
			.andExpect(jsonPath("$.errors[?(@.field == 'drivers[0].driverName')].code").value(hasItem("REQUIRED")));
	}

	@Test
	void onlyPublishedVersionsAcceptSubmissions() throws Exception {
		create(withId(casco, "pet-unpublished", "Taslak")).andExpect(status().isCreated());

		submit("pet-unpublished", 1, cascoAnswers()).andExpect(status().isConflict());
		submit("no-such-form", 1, cascoAnswers()).andExpect(status().isNotFound());
	}

	@Test
	void filtersOnAnswersWithJsonExistsAndFlattensRowsWithJsonTable() throws Exception {
		String form = "casco-query";
		create(withId(casco, form, "Sorgu")).andExpect(status().isCreated());
		mvc.perform(post("/api/definitions/" + form + "/versions/1/publish")).andExpect(status().isOk());

		Map<String, Object> lpg = cascoAnswers();
		Map<String, Object> diesel = cascoAnswers();
		diesel.put("fuelType", "diesel");
		diesel.put("modelYear", 2015);
		diesel.put("extras", List.of("miniRepair"));
		diesel.put("drivers", List.of(driver("Ali Kaya"), driver("Can Kaya")));
		submit(form, 1, lpg).andExpect(status().isCreated());
		submit(form, 1, diesel).andExpect(status().isCreated());

		list(form, "hasLpg", "true").andExpect(jsonPath("$.total").value(1))
			.andExpect(jsonPath("$.items[0].answers.lpgBrand").value("brc"));
		list(form, "fuelType", "diesel").andExpect(jsonPath("$.total").value(1));
		list(form, "modelYear", "2015").andExpect(jsonPath("$.total").value(1));
		list(form, "extras", "glass").andExpect(jsonPath("$.total").value(1)); // inside a multiselect array
		list(form, "brand", "toyota").andExpect(jsonPath("$.total").value(2));
		mvc.perform(get("/api/submissions").param("formId", form)).andExpect(jsonPath("$.total").value(2));

		mvc.perform(get("/api/submissions/rows").param("formId", form).param("repeater", "drivers"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(3))
			.andExpect(jsonPath("$[0].index").value(1))
			.andExpect(jsonPath("$[*].row.driverName").value(contains("Ali Kaya", "Can Kaya", "Ayşe Yılmaz")));
	}

	@Test
	void rejectsFieldNamesThatCouldEscapeTheJsonPath() throws Exception {
		mvc.perform(get("/api/submissions").param("field", "plate')||1==1||('").param("value", "x"))
			.andExpect(status().isBadRequest());
		mvc.perform(get("/api/submissions/rows").param("formId", "casco-risk").param("repeater", "drivers[*]"))
			.andExpect(status().isBadRequest());
	}

	@Test
	void describesTheApiWithOpenApi() throws Exception {
		mvc.perform(get("/v3/api-docs"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.info.title").value("Sigorta Dinamik Form Motoru API"))
			.andExpect(jsonPath("$.paths['/api/submissions']").exists())
			.andExpect(jsonPath("$.paths['/api/definitions/{formKey}/versions/{version}/publish']").exists());
	}

	// ---- helpers ----------------------------------------------------------------------

	private ResultActions create(String definition) throws Exception {
		return mvc.perform(post("/api/definitions").contentType(MediaType.APPLICATION_JSON).content(definition));
	}

	private ResultActions submit(String formId, int version, Map<String, Object> values) throws Exception {
		Map<String, Object> body = Map.of("formId", formId, "version", version, "values", values);
		return mvc.perform(post("/api/submissions").contentType(MediaType.APPLICATION_JSON)
			.content(JSON.writeValueAsString(body)));
	}

	private ResultActions list(String formId, String field, String value) throws Exception {
		return mvc.perform(get("/api/submissions").param("formId", formId).param("field", field).param("value", value))
			.andExpect(status().isOk());
	}

	private static String withId(String definition, String id, String title) {
		ObjectNode node = (ObjectNode) JSON.readTree(definition);
		node.put("id", id);
		node.put("title", title);
		return JSON.writeValueAsString(node);
	}

	/** The shared example answers, with dates that stay valid whenever the test runs. */
	private static Map<String, Object> cascoAnswers() throws Exception {
		Map<String, Object> fixture = JSON.readValue(Path.of("..", "fixtures", "example-answers.json").toFile(),
				new TypeReference<Map<String, Object>>() {
				});
		@SuppressWarnings("unchecked")
		Map<String, Object> answers = new LinkedHashMap<>(
				(Map<String, Object>) ((Map<String, Object>) fixture.get("answers")).get("casco-risk"));
		answers.put("startDate", "2099-01-01");
		return answers;
	}

	private static Map<String, Object> driver(String name) {
		return Map.of("driverName", name, "driverBirthDate", "1985-01-01", "licenseYear", 2005);
	}
}

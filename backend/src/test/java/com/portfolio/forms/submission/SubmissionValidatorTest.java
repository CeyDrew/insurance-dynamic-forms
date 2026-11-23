package com.portfolio.forms.submission;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import com.portfolio.forms.lookup.LookupService;
import com.portfolio.forms.schema.FormDefinition;
import com.portfolio.forms.schema.FormDefinitionReader;
import com.portfolio.forms.submission.SubmissionValidator.Result;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

class SubmissionValidatorTest {

	private static final JsonMapper JSON = JsonMapper.builder().build();
	private static final Map<String, Object> FIXTURE = read(Path.of("..", "fixtures", "example-answers.json"));
	private static final LocalDate TODAY = LocalDate.parse((String) FIXTURE.get("today"));
	private static final Map<String, String> FILES = Map.of("casco-risk", "casco.json", "home-risk", "home.json",
			"health-risk", "health.json", "travel-risk", "travel.json");

	private final SubmissionValidator validator = new SubmissionValidator(new LookupService(JSON));

	@SuppressWarnings("unchecked")
	static Stream<String> forms() {
		return ((Map<String, Object>) FIXTURE.get("answers")).keySet().stream().sorted();
	}

	/** The same answers the frontend accepts (shared fixture) must pass the server too. */
	@ParameterizedTest
	@MethodSource("forms")
	void acceptsTheSharedExampleAnswers(String formId) {
		Result result = validate(formId, answers(formId));

		assertThat(result.errors()).isEmpty();
	}

	@Test
	void storesCanonicalAnswers() {
		Map<String, Object> values = answers("casco-risk");
		values.put("vehicleAge", 99); // computed: the client's value is ignored
		values.put("driversInfo", null); // info fields may be sent as null

		Map<String, Object> answers = validate("casco-risk", values).answers();

		assertThat(answers.get("vehicleAge")).isEqualTo(7L);
		assertThat(answers.get("modelYear")).isEqualTo(2019L);
		assertThat(answers).doesNotContainKey("driversInfo");
		assertThat(answers.get("drivers")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.LIST)
			.singleElement()
			.isEqualTo(Map.of("driverName", "Ayşe Yılmaz", "driverBirthDate", "1990-05-20", "driverAge", 35L,
					"licenseYear", 2010L));
	}

	@Test
	void dropsWhatHiddenFieldsWereSent() {
		Map<String, Object> values = answers("casco-risk");
		values.put("fuelType", "diesel"); // hides hasLpg, and through it lpgBrand

		Result result = validate("casco-risk", values);

		assertThat(result.errors()).isEmpty();
		assertThat(result.answers().get("hasLpg")).isNull();
		assertThat(result.answers().get("lpgBrand")).isNull();
	}

	@Test
	void enforcesRequiredAndRequiredWhen() {
		Map<String, Object> values = answers("casco-risk");
		values.remove("plate");
		values.put("lpgBrand", null); // required because hasLpg == true
		values.put("drivers", List.of());

		assertThat(errors("casco-risk", values)).containsExactlyInAnyOrder(
				tuple("plate", "REQUIRED", "Bu alan zorunlu"),
				tuple("lpgBrand", "REQUIRED", "Bu alan zorunlu"),
				tuple("drivers", "REQUIRED", "En az bir satır eklenmeli"));
	}

	@Test
	void appliesDefinitionValidatorsWithTheirMessages() {
		Map<String, Object> values = answers("casco-risk");
		values.put("plate", "99ABC123");
		values.put("modelYear", 1975);
		values.put("startDate", "2026-03-14");

		assertThat(errors("casco-risk", values)).containsExactlyInAnyOrder(
				tuple("plate", "PATTERN", "Geçersiz plaka"),
				tuple("modelYear", "MIN", "1980 öncesi araçlar için şubeye başvurun"),
				tuple("startDate", "MIN_DATE", "Geçmiş tarihli poliçe başlatılamaz"));
	}

	@Test
	void usesTheFrontendDefaultMessages() {
		Map<String, Object> values = answers("home-risk");
		values.put("district", "x".repeat(51));
		values.put("grossArea", 10.5);

		assertThat(errors("home-risk", values)).containsExactlyInAnyOrder(
				tuple("district", "MAX_LENGTH", "En fazla 50 karakter olabilir"),
				tuple("grossArea", "MIN", "En az 20 olmalı"));
	}

	@Test
	void checksTypesOptionsAndUnknownFields() {
		Map<String, Object> values = answers("casco-risk");
		values.put("modelYear", "2019");
		values.put("usageType", "rental"); // static options
		values.put("brand", "ferrari"); // remote options, checked against the lookup
		values.put("extras", List.of("glass", "gold"));
		values.put("discount", 10);

		assertThat(errors("casco-risk", values)).containsExactlyInAnyOrder(
				tuple("modelYear", "INVALID_TYPE", "Değer tipi hatalı"),
				tuple("usageType", "INVALID_OPTION", "Geçersiz seçim"),
				tuple("brand", "INVALID_OPTION", "Geçersiz seçim"),
				tuple("extras", "INVALID_OPTION", "Geçersiz seçim"),
				tuple("discount", "UNKNOWN_FIELD", "Formda böyle bir alan yok"));
	}

	@Test
	void validatesRepeaterRowsInTheirOwnScope() {
		Map<String, Object> values = answers("casco-risk");
		List<Object> drivers = new ArrayList<>();
		for (int i = 0; i < 6; i++) {
			drivers.add(new LinkedHashMap<>(Map.of("driverName", "Sürücü " + i, "driverBirthDate", "1990-01-01",
					"licenseYear", 2010)));
		}
		drivers.set(1, new LinkedHashMap<>(Map.of("driverBirthDate", "2030-01-01", "licenseYear", 2010, "x", 1)));
		values.put("drivers", drivers);

		assertThat(errors("casco-risk", values)).containsExactlyInAnyOrder(
				tuple("drivers", "MAX_ITEMS", "En fazla 5 satır eklenebilir"),
				tuple("drivers[1].x", "UNKNOWN_FIELD", "Formda böyle bir alan yok"),
				tuple("drivers[1].driverName", "REQUIRED", "Bu alan zorunlu"),
				tuple("drivers[1].driverBirthDate", "MAX_DATE", "15.03.2026 veya öncesi olmalı"));
	}

	@Test
	void requiresFieldsOfStepsThatBecomeVisible() {
		Map<String, Object> values = answers("health-risk");
		values.put("hadSurgery", true);
		values.put("surgeries", List.of());
		values.put("smoker", true);

		assertThat(errors("health-risk", values)).containsExactlyInAnyOrder(
				tuple("surgeries", "REQUIRED", "En az bir satır eklenmeli"),
				tuple("cigarettesPerDay", "REQUIRED", "Bu alan zorunlu"));
	}

	private List<org.assertj.core.groups.Tuple> errors(String formId, Map<String, Object> values) {
		return validate(formId, values).errors().stream()
			.map(e -> tuple(e.field(), e.code(), e.message()))
			.toList();
	}

	private Result validate(String formId, Map<String, Object> values) {
		return validator.validate(definition(formId), values, TODAY);
	}

	private static FormDefinition definition(String formId) {
		try {
			return new FormDefinitionReader().read(Files.readString(Path.of("..", "examples", FILES.get(formId))));
		}
		catch (IOException ex) {
			throw new java.io.UncheckedIOException(ex);
		}
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> answers(String formId) {
		Map<String, Object> all = (Map<String, Object>) FIXTURE.get("answers");
		return JSON.convertValue(all.get(formId), new TypeReference<LinkedHashMap<String, Object>>() {
		});
	}

	private static Map<String, Object> read(Path path) {
		return JSON.readValue(path.toFile(), new TypeReference<Map<String, Object>>() {
		});
	}
}

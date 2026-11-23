package com.portfolio.forms.schema;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import com.fasterxml.jackson.annotation.JsonProperty;

import org.springframework.stereotype.Component;

import tools.jackson.core.JacksonException;
import tools.jackson.core.TokenStreamLocation;
import tools.jackson.core.exc.StreamReadException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.exc.InvalidFormatException;
import tools.jackson.databind.exc.MismatchedInputException;
import tools.jackson.databind.exc.UnrecognizedPropertyException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Binds definition JSON to {@link FormDefinition} strictly: unknown keys, wrong value
 * types and trailing content are rejected and reported with their document path.
 */
@Component
public class FormDefinitionReader {

	private final JsonMapper mapper = JsonMapper.builder()
		.enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
		.enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
		.enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
		.disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
		.disable(MapperFeature.ALLOW_COERCION_OF_SCALARS)
		.build();

	public FormDefinition read(String json) {
		if (json == null || json.isBlank()) {
			throw new DefinitionParseException(new DefinitionError("", DefinitionErrorCode.INVALID_JSON, "Tanım boş"));
		}
		FormDefinition definition;
		try {
			definition = mapper.readValue(json, FormDefinition.class);
		}
		catch (JacksonException ex) {
			throw new DefinitionParseException(toError(ex));
		}
		if (definition == null) {
			throw new DefinitionParseException(
					new DefinitionError("", DefinitionErrorCode.INVALID_JSON, "Tanım bir JSON nesnesi olmalı"));
		}
		return definition;
	}

	private DefinitionError toError(JacksonException ex) {
		String path = path(ex.getPath());
		if (ex instanceof UnrecognizedPropertyException unknown) {
			return new DefinitionError(path, DefinitionErrorCode.UNKNOWN_PROPERTY,
					"Bilinmeyen anahtar '" + unknown.getPropertyName() + "'");
		}
		if (ex instanceof InvalidFormatException invalid && invalid.getTargetType() != null
				&& invalid.getTargetType().isEnum()) {
			return new DefinitionError(path, DefinitionErrorCode.INVALID_VALUE, "Geçersiz değer '" + invalid.getValue()
					+ "'. İzinli değerler: " + enumNames(invalid.getTargetType()));
		}
		if (ex instanceof MismatchedInputException mismatched) {
			return new DefinitionError(path, DefinitionErrorCode.INVALID_VALUE,
					"Değer tipi hatalı, beklenen: " + typeName(mismatched.getTargetType()));
		}
		if (ex instanceof StreamReadException read) {
			TokenStreamLocation location = read.getLocation();
			String where = location == null ? ""
					: " (satır " + location.getLineNr() + ", sütun " + location.getColumnNr() + ")";
			return new DefinitionError(path, DefinitionErrorCode.INVALID_JSON, "Geçersiz JSON" + where);
		}
		return new DefinitionError(path, DefinitionErrorCode.INVALID_JSON, "Tanım okunamadı");
	}

	static String path(List<JacksonException.Reference> references) {
		StringBuilder sb = new StringBuilder();
		for (JacksonException.Reference ref : references) {
			if (ref.getPropertyName() != null) {
				if (!sb.isEmpty()) {
					sb.append('.');
				}
				sb.append(ref.getPropertyName());
			}
			else if (ref.getIndex() >= 0) {
				sb.append('[').append(ref.getIndex()).append(']');
			}
		}
		return sb.toString();
	}

	private static String enumNames(Class<?> type) {
		return Arrays.stream(type.getFields())
			.filter(java.lang.reflect.Field::isEnumConstant)
			.map(f -> {
				JsonProperty property = f.getAnnotation(JsonProperty.class);
				return property != null ? property.value() : f.getName();
			})
			.collect(Collectors.joining(", "));
	}

	private static String typeName(Class<?> type) {
		if (type == null) {
			return "uygun tip";
		}
		if (Number.class.isAssignableFrom(type) || type.isPrimitive() && type != boolean.class) {
			return "sayı";
		}
		if (type == Boolean.class || type == boolean.class) {
			return "true/false";
		}
		if (type == String.class) {
			return "metin";
		}
		if (List.class.isAssignableFrom(type)) {
			return "dizi";
		}
		return "nesne";
	}
}

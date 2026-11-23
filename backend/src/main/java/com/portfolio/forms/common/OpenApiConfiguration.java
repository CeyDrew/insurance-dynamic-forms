package com.portfolio.forms.common;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;

/** API description shown at {@code /swagger-ui.html}. */
@Configuration(proxyBeanMethods = false)
class OpenApiConfiguration {

	@Bean
	OpenAPI formsOpenApi() {
		return new OpenAPI().info(new Info()
			.title("Sigorta Dinamik Form Motoru API")
			.version("v1")
			.description("Versiyonlu form tanımları, sunucu tarafında yeniden doğrulanan cevaplar ve "
					+ "Oracle JSON sorguları. Hata cevapları RFC 9457 problem details biçimindedir."));
	}
}

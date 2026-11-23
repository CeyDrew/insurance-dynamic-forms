package com.portfolio.forms.common;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class ClockConfiguration {

	/** Turkish local time: decides what "today" means in rules such as {@code minDate: today}. */
	@Bean
	Clock clock() {
		return Clock.system(ZoneId.of("Europe/Istanbul"));
	}
}

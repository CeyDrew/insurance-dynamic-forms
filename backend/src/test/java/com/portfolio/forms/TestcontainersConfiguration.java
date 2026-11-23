package com.portfolio.forms;

import java.time.Duration;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.oracle.OracleContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfiguration {

	@Bean
	@ServiceConnection
	OracleContainer oracleFreeContainer() {
		// Oracle can take a few minutes on a busy machine or a CI runner.
		return new OracleContainer(DockerImageName.parse("gvenzl/oracle-free:23-slim-faststart"))
			.withStartupTimeout(Duration.ofMinutes(5));
	}

}

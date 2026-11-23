# Build context is the repository root: the build copies ../examples into the jar.
# The official Maven image is used instead of ./mvnw so the build does not have to download Maven itself.
FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /src/backend

# Dependencies first, so source edits do not invalidate the Maven cache layer.
COPY backend/pom.xml ./
RUN mvn -q -B dependency:go-offline

COPY examples /src/examples
COPY backend/src src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --no-create-home app
COPY --from=build /src/backend/target/forms-0.0.1-SNAPSHOT.jar app.jar
USER app
EXPOSE 8081
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]

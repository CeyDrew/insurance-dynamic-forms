# Build context is the repository root: the build copies ../examples into the jar.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src/backend

# Dependencies first, so source edits do not invalidate the Maven cache layer.
COPY backend/.mvn .mvn
COPY backend/mvnw backend/pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw -q -B dependency:go-offline

COPY examples /src/examples
COPY backend/src src
RUN ./mvnw -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --no-create-home app
COPY --from=build /src/backend/target/forms-0.0.1-SNAPSHOT.jar app.jar
USER app
EXPOSE 8081
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]

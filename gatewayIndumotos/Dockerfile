FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/gateway-indumotos-0.1.0-SNAPSHOT.jar app.jar
EXPOSE 8030
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

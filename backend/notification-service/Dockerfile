FROM eclipse-temurin:17-jdk-alpine as builder
WORKDIR /app
COPY .mvn/ .mvn
COPY mvnw pom.xml ./
# RUN ./mvnw dependency:go-offline
COPY src ./src
# RUN ./mvnw package -DskipTests

ENTRYPOINT ["java", "-jar", "app.jar"]

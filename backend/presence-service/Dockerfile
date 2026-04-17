FROM eclipse-temurin:17-jdk-alpine as builder
WORKDIR /app
COPY .mvn/ .mvn
COPY mvnw pom.xml ./
# RUN ./mvnw dependency:go-offline
COPY src ./src
# RUN ./mvnw package -DskipTests

# Stage 2 (Tạm cheat copy nguyên code để dev, hoặc build layer)
# Để chạy docker-compose nhanh, đoạn này sẽ giả lập hoặc bạn có thể cmt lại.
# Trong thực tế, bạn cần đóng gói fat-jar.
ENTRYPOINT ["java", "-jar", "app.jar"]

package com.autominer.auth;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

public final class AuthManager {
    private static final URI AUTH_ENDPOINT = URI.create("http://localhost:3000/api/auth");
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(REQUEST_TIMEOUT)
            .build();

    public static volatile boolean isAuthorized = false;

    private AuthManager() {
    }

    public static void initialize(UUID playerUuid) {
        Thread.ofPlatform()
                .name("autominer-auth")
                .daemon(true)
                .start(() -> authenticate(playerUuid));
    }

    private static void authenticate(UUID playerUuid) {
        isAuthorized = false;

        try {
            URI requestUri = URI.create(AUTH_ENDPOINT + "?uuid=" + playerUuid);
            HttpRequest request = HttpRequest.newBuilder(requestUri)
                    .timeout(REQUEST_TIMEOUT)
                    .GET()
                    .build();

            HttpResponse<Void> response = HTTP_CLIENT.send(
                    request,
                    HttpResponse.BodyHandlers.discarding()
            );

            isAuthorized = response.statusCode() == 200;
            System.out.println("[AuthManager] Authentication result for " + playerUuid + ": " + isAuthorized);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            isAuthorized = false;
        } catch (Exception exception) {
            System.err.println("[AuthManager] Authentication failed: " + exception.getMessage());
            isAuthorized = false;
        }
    }
}

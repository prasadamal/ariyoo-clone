package com.ariyoo.corporate.common;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Values from application.yml (all overridable by environment variables). */
@ConfigurationProperties(prefix = "ariyoo")
public record Settings(List<String> corsOrigins, String adminKey, int formRateLimit) {
    public boolean adminEnabled() {
        return adminKey != null && !adminKey.isBlank();
    }
}

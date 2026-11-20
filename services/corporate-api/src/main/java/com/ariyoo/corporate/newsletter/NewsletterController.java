package com.ariyoo.corporate.newsletter;

import com.ariyoo.corporate.common.Times;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Newsletter sign-up and one-click unsubscribe. */
@RestController
@RequestMapping("/api/newsletter")
public class NewsletterController {
    public record Subscribe(@NotBlank(message = "Please enter your email.") @Email(message = "That email doesn't look right.") @Size(max = 254) String email) {}

    public record Unsubscribe(@NotBlank @Size(min = 64, max = 64) String token) {}

    private static final SecureRandom RANDOM = new SecureRandom();
    private final JdbcClient db;

    public NewsletterController(JdbcClient db) {
        this.db = db;
    }

    /** Same answer whether or not the address was already subscribed, so the form can't be used to check who is. */
    @PostMapping("/subscribe")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, Object> subscribe(@Valid @RequestBody Subscribe req) {
        String email = req.email().trim().toLowerCase();
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        int added = db.sql("INSERT INTO newsletter_subscriber (email, token, created_at) "
                        + "SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM newsletter_subscriber WHERE email = ?)")
                .params(email, HexFormat.of().formatHex(raw), Times.nowUtc(), email)
                .update();
        // Signing up again after unsubscribing turns it back on.
        if (added == 0) db.sql("UPDATE newsletter_subscriber SET unsubscribed_at = NULL WHERE email = ?").param(email).update();
        return Map.of("subscribed", true);
    }

    @PostMapping("/unsubscribe")
    public Map<String, Object> unsubscribe(@Valid @RequestBody Unsubscribe req) {
        db.sql("UPDATE newsletter_subscriber SET unsubscribed_at = ? WHERE token = ? AND unsubscribed_at IS NULL")
                .params(Times.nowUtc(), req.token()).update();
        return Map.of("unsubscribed", true);
    }
}

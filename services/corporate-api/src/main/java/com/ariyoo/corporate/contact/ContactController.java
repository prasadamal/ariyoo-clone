package com.ariyoo.corporate.contact;

import com.ariyoo.corporate.common.Times;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The website's contact form. */
@RestController
@RequestMapping("/api/contact")
public class ContactController {
    public static final String TOPICS = "general|partnership|investor|press|support|careers";

    public record Request(
            @NotBlank(message = "Please tell us your name.") @Size(max = 120, message = "Name is too long.") String name,
            @NotBlank(message = "Please enter your email.") @Email(message = "That email doesn't look right.") @Size(max = 254) String email,
            @NotBlank(message = "Please choose a topic.") @Pattern(regexp = TOPICS, message = "Please choose a topic.") String topic,
            @Size(max = 160, message = "Organisation is too long.") String organisation,
            @NotBlank(message = "Please write a message.") @Size(min = 10, max = 4000, message = "Messages are 10 to 4000 characters.") String message,
            // A hidden field real visitors never fill in. Bots usually do.
            String website) {}

    public record Entry(long id, String name, String email, String topic, String organisation, String message, Instant createdAt) {}

    private final JdbcClient db;

    public ContactController(JdbcClient db) {
        this.db = db;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, Object> submit(@Valid @RequestBody Request req) {
        // Looks successful to a bot, but nothing is stored.
        if (req.website() != null && !req.website().isBlank()) return Map.of("received", true);
        db.sql("INSERT INTO contact_message (name, email, topic, organisation, message, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                .params(req.name().trim(), req.email().trim().toLowerCase(), req.topic(),
                        req.organisation() == null || req.organisation().isBlank() ? null : req.organisation().trim(),
                        req.message().trim(), Times.nowUtc())
                .update();
        return Map.of("received", true);
    }

    public static List<Entry> latest(JdbcClient db, int limit) {
        return db.sql("SELECT id, name, email, topic, organisation, message, created_at FROM contact_message ORDER BY created_at DESC, id DESC LIMIT ?")
                .param(limit)
                .query((rs, i) -> new Entry(rs.getLong("id"), rs.getString("name"), rs.getString("email"), rs.getString("topic"),
                        rs.getString("organisation"), rs.getString("message"), Times.read(rs, "created_at")))
                .list();
    }
}

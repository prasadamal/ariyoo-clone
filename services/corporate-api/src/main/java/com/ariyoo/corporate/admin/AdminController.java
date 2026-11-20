package com.ariyoo.corporate.admin;

import com.ariyoo.corporate.careers.CareersController;
import com.ariyoo.corporate.common.Times;
import com.ariyoo.corporate.contact.ContactController;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * For the team, behind the X-Admin-Key header: read what came in, and publish or remove roles and news
 * without touching the database by hand.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private static final String SLUG = "^[a-z0-9]+(-[a-z0-9]+)*$";

    public record NewJob(
            @NotBlank @Pattern(regexp = SLUG, message = "Use lowercase letters, numbers and dashes.") @Size(max = 80) String slug,
            @NotBlank @Size(max = 160) String title, @NotBlank @Size(max = 80) String team,
            @NotBlank @Size(max = 120) String location, @NotBlank @Size(max = 40) String employment,
            @NotBlank @Size(max = 2000) String summary) {}

    public record NewPress(
            @NotBlank @Pattern(regexp = SLUG, message = "Use lowercase letters, numbers and dashes.") @Size(max = 100) String slug,
            @NotBlank @Size(max = 200) String title, @NotBlank @Size(max = 500) String summary,
            @NotBlank @Size(max = 20000) String body, Instant publishedAt) {}

    private final JdbcClient db;

    public AdminController(JdbcClient db) {
        this.db = db;
    }

    @GetMapping("/inbox")
    public Map<String, Object> inbox() {
        return Map.of("contacts", ContactController.latest(db, 200), "applications", CareersController.latest(db, 200));
    }

    @PostMapping("/jobs")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> publishJob(@Valid @RequestBody NewJob job) {
        try {
            db.sql("INSERT INTO job (slug, title, team, location, employment, summary, published, created_at) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)")
                    .params(job.slug(), job.title().trim(), job.team().trim(), job.location().trim(), job.employment().trim(), job.summary().trim(), Times.nowUtc())
                    .update();
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A role with that slug already exists.");
        }
        return Map.of("published", true, "slug", job.slug());
    }

    @DeleteMapping("/jobs/{slug}")
    public Map<String, Object> closeJob(@PathVariable String slug) {
        db.sql("DELETE FROM job WHERE slug = ?").param(slug).update();
        return Map.of("closed", true);
    }

    @PostMapping("/press")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> publishPress(@Valid @RequestBody NewPress item) {
        try {
            db.sql("INSERT INTO press_item (slug, title, summary, body, published_at) VALUES (?, ?, ?, ?, ?)")
                    .params(item.slug(), item.title().trim(), item.summary().trim(), item.body().trim(),
                            item.publishedAt() == null ? Times.nowUtc() : java.time.LocalDateTime.ofInstant(item.publishedAt(), java.time.ZoneOffset.UTC))
                    .update();
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An article with that slug already exists.");
        }
        return Map.of("published", true, "slug", item.slug());
    }

    @DeleteMapping("/press/{slug}")
    public Map<String, Object> removePress(@PathVariable String slug) {
        db.sql("DELETE FROM press_item WHERE slug = ?").param(slug).update();
        return Map.of("removed", true);
    }
}

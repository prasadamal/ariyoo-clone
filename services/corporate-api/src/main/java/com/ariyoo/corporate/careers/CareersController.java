package com.ariyoo.corporate.careers;

import com.ariyoo.corporate.common.Times;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Open roles and applications. The list is empty until the team publishes a role. */
@RestController
@RequestMapping("/api")
public class CareersController {
    public record Job(long id, String slug, String title, String team, String location, String employment, String summary) {}

    public record Application(
            // Empty means an open application, not tied to a role.
            String jobSlug,
            @NotBlank(message = "Please tell us your name.") @Size(max = 120) String name,
            @NotBlank(message = "Please enter your email.") @Email(message = "That email doesn't look right.") @Size(max = 254) String email,
            @Pattern(regexp = "^$|^https?://\\S{3,480}$", message = "Please enter a full link starting with http(s)://") String profileUrl,
            @NotBlank(message = "Please tell us about yourself.") @Size(min = 20, max = 4000, message = "Please write 20 to 4000 characters.") String message,
            String website) {}

    public record ApplicationEntry(long id, String role, String name, String email, String profileUrl, String message, Instant createdAt) {}

    private final JdbcClient db;

    public CareersController(JdbcClient db) {
        this.db = db;
    }

    @GetMapping("/jobs")
    public List<Job> jobs() {
        return db.sql("SELECT id, slug, title, team, location, employment, summary FROM job WHERE published ORDER BY created_at DESC, id DESC")
                .query(Job.class).list();
    }

    @GetMapping("/jobs/{slug}")
    public Job job(@PathVariable String slug) {
        return db.sql("SELECT id, slug, title, team, location, employment, summary FROM job WHERE published AND slug = ?")
                .param(slug).query(Job.class).optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "That role is not open."));
    }

    @PostMapping("/applications")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, Object> apply(@Valid @RequestBody Application req) {
        if (req.website() != null && !req.website().isBlank()) return Map.of("received", true);
        Long jobId = null;
        if (req.jobSlug() != null && !req.jobSlug().isBlank()) {
            jobId = db.sql("SELECT id FROM job WHERE published AND slug = ?").param(req.jobSlug()).query(Long.class).optional()
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "That role is no longer open."));
        }
        db.sql("INSERT INTO job_application (job_id, name, email, profile_url, message, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                .params(jobId, req.name().trim(), req.email().trim().toLowerCase(),
                        req.profileUrl() == null || req.profileUrl().isBlank() ? null : req.profileUrl().trim(),
                        req.message().trim(), Times.nowUtc())
                .update();
        return Map.of("received", true);
    }

    public static List<ApplicationEntry> latest(JdbcClient db, int limit) {
        return db.sql("SELECT a.id, COALESCE(j.title, 'Open application') AS role, a.name, a.email, a.profile_url, a.message, a.created_at "
                        + "FROM job_application a LEFT JOIN job j ON j.id = a.job_id ORDER BY a.created_at DESC, a.id DESC LIMIT ?")
                .param(limit)
                .query((rs, i) -> new ApplicationEntry(rs.getLong("id"), rs.getString("role"), rs.getString("name"), rs.getString("email"),
                        rs.getString("profile_url"), rs.getString("message"), Times.read(rs, "created_at")))
                .list();
    }
}

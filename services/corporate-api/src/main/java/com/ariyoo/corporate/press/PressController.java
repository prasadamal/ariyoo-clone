package com.ariyoo.corporate.press;

import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import com.ariyoo.corporate.common.Times;

/** Company news. Empty until something is published. */
@RestController
@RequestMapping("/api/press")
public class PressController {
    public record Summary(String slug, String title, String summary, Instant publishedAt) {}

    public record Article(String slug, String title, String summary, String body, Instant publishedAt) {}

    private final JdbcClient db;

    public PressController(JdbcClient db) {
        this.db = db;
    }

    @GetMapping
    public List<Summary> list() {
        return db.sql("SELECT slug, title, summary, published_at FROM press_item WHERE published_at <= ? ORDER BY published_at DESC LIMIT 100")
                .param(Times.nowUtc())
                .query((rs, i) -> new Summary(rs.getString("slug"), rs.getString("title"), rs.getString("summary"), Times.read(rs, "published_at")))
                .list();
    }

    @GetMapping("/{slug}")
    public Article one(@PathVariable String slug) {
        return db.sql("SELECT slug, title, summary, body, published_at FROM press_item WHERE slug = ? AND published_at <= ?")
                .params(slug, Times.nowUtc())
                .query((rs, i) -> new Article(rs.getString("slug"), rs.getString("title"), rs.getString("summary"), rs.getString("body"), Times.read(rs, "published_at")))
                .optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "We couldn't find that article."));
    }
}

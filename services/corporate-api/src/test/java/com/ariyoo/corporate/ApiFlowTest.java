package com.ariyoo.corporate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiFlowTest {
    static final String KEY = "test-admin-key-not-a-secret";

    @Autowired MockMvc mvc;
    @Autowired JdbcClient db;

    @BeforeEach
    void clean() {
        for (String t : new String[] {"job_application", "job", "contact_message", "newsletter_subscriber", "press_item"}) {
            db.sql("DELETE FROM " + t).update();
        }
    }

    private static String contact(String topic, String message, String website) {
        return "{\"name\":\"Priya Nair\",\"email\":\"Priya@Example.com\",\"topic\":\"" + topic + "\",\"organisation\":\"Acme\","
                + "\"message\":\"" + message + "\",\"website\":" + (website == null ? "null" : "\"" + website + "\"") + "}";
    }

    @Test
    void contactFormStoresAValidMessageAndNormalisesTheEmail() throws Exception {
        mvc.perform(post("/api/contact").contentType(MediaType.APPLICATION_JSON).content(contact("partnership", "We would like to talk about a partnership.", null)))
                .andExpect(status().isAccepted()).andExpect(jsonPath("$.received").value(true));
        mvc.perform(get("/api/admin/inbox").header("X-Admin-Key", KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contacts.length()").value(1))
                .andExpect(jsonPath("$.contacts[0].email").value("priya@example.com"))
                .andExpect(jsonPath("$.contacts[0].topic").value("partnership"))
                .andExpect(jsonPath("$.contacts[0].createdAt").value(org.hamcrest.Matchers.endsWith("Z")));
    }

    @Test
    void contactFormRefusesBadInputWithFieldMessages() throws Exception {
        mvc.perform(post("/api/contact").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"email\":\"nope\",\"topic\":\"spam\",\"message\":\"short\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fields.name").exists())
                .andExpect(jsonPath("$.fields.email").exists())
                .andExpect(jsonPath("$.fields.topic").exists())
                .andExpect(jsonPath("$.fields.message").exists());
        mvc.perform(post("/api/contact").contentType(MediaType.APPLICATION_JSON).content("not json")).andExpect(status().isBadRequest());
        assertThat(db.sql("SELECT COUNT(*) FROM contact_message").query(Long.class).single()).isZero();
    }

    @Test
    void aFilledHiddenFieldLooksLikeSuccessButStoresNothing() throws Exception {
        mvc.perform(post("/api/contact").contentType(MediaType.APPLICATION_JSON).content(contact("general", "Buy cheap watches now, great deals.", "http://spam.example")))
                .andExpect(status().isAccepted());
        assertThat(db.sql("SELECT COUNT(*) FROM contact_message").query(Long.class).single()).isZero();
    }

    @Test
    void newsletterGivesTheSameAnswerForNewAndExistingAddressesAndUnsubscribes() throws Exception {
        String body = "{\"email\":\"Reader@Example.com\"}";
        for (int i = 0; i < 2; i++) {
            mvc.perform(post("/api/newsletter/subscribe").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isAccepted()).andExpect(jsonPath("$.subscribed").value(true));
        }
        assertThat(db.sql("SELECT COUNT(*) FROM newsletter_subscriber").query(Long.class).single()).isEqualTo(1);
        String token = db.sql("SELECT token FROM newsletter_subscriber WHERE email = 'reader@example.com'").query(String.class).single();
        assertThat(token).hasSize(64);
        mvc.perform(post("/api/newsletter/unsubscribe").contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}")).andExpect(status().isOk());
        assertThat(db.sql("SELECT unsubscribed_at FROM newsletter_subscriber").query(java.sql.Timestamp.class).single()).isNotNull();
        mvc.perform(post("/api/newsletter/subscribe").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isAccepted());
        assertThat(db.sql("SELECT unsubscribed_at FROM newsletter_subscriber").query(java.sql.Timestamp.class).optional()).isEmpty();
        mvc.perform(post("/api/newsletter/subscribe").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"bad\"}")).andExpect(status().isBadRequest());
    }

    @Test
    void rolesAreEmptyUntilPublishedThenApplicationsLinkToThem() throws Exception {
        mvc.perform(get("/api/jobs")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/jobs/backend-engineer")).andExpect(status().isNotFound());

        String job = "{\"slug\":\"backend-engineer\",\"title\":\"Backend Engineer\",\"team\":\"Engineering\",\"location\":\"Bengaluru\",\"employment\":\"Full-time\",\"summary\":\"Build the services behind Ariyoo.\"}";
        mvc.perform(post("/api/admin/jobs").header("X-Admin-Key", KEY).contentType(MediaType.APPLICATION_JSON).content(job)).andExpect(status().isCreated());
        mvc.perform(post("/api/admin/jobs").header("X-Admin-Key", KEY).contentType(MediaType.APPLICATION_JSON).content(job)).andExpect(status().isConflict());
        mvc.perform(get("/api/jobs")).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].title").value("Backend Engineer"));
        mvc.perform(get("/api/jobs/backend-engineer")).andExpect(status().isOk());

        String about = "I have built payment systems for six years and want to work on local knowledge.";
        mvc.perform(post("/api/applications").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobSlug\":\"backend-engineer\",\"name\":\"Ravi\",\"email\":\"ravi@example.com\",\"profileUrl\":\"https://linkedin.com/in/ravi\",\"message\":\"" + about + "\"}"))
                .andExpect(status().isAccepted());
        mvc.perform(post("/api/applications").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Meera\",\"email\":\"meera@example.com\",\"message\":\"" + about + "\"}"))
                .andExpect(status().isAccepted());
        mvc.perform(post("/api/applications").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobSlug\":\"closed-role\",\"name\":\"Meera\",\"email\":\"meera@example.com\",\"message\":\"" + about + "\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/applications").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Meera\",\"email\":\"meera@example.com\",\"profileUrl\":\"javascript:alert(1)\",\"message\":\"" + about + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.profileUrl").exists());
        mvc.perform(get("/api/admin/inbox").header("X-Admin-Key", KEY))
                .andExpect(jsonPath("$.applications.length()").value(2))
                .andExpect(jsonPath("$.applications[?(@.name=='Ravi')].role").value("Backend Engineer"))
                .andExpect(jsonPath("$.applications[?(@.name=='Meera')].role").value("Open application"));

        mvc.perform(delete("/api/admin/jobs/backend-engineer").header("X-Admin-Key", KEY)).andExpect(status().isOk());
        mvc.perform(get("/api/jobs")).andExpect(jsonPath("$.length()").value(0));
        // The application stays, now shown as an open application.
        mvc.perform(get("/api/admin/inbox").header("X-Admin-Key", KEY)).andExpect(jsonPath("$.applications.length()").value(2));
    }

    @Test
    void pressShowsOnlyPublishedItems() throws Exception {
        mvc.perform(get("/api/press")).andExpect(jsonPath("$.length()").value(0));
        String past = "{\"slug\":\"hello\",\"title\":\"Ariyoo opens\",\"summary\":\"We are live.\",\"body\":\"Full story.\",\"publishedAt\":\"2026-01-01T00:00:00Z\"}";
        String future = "{\"slug\":\"later\",\"title\":\"Coming soon\",\"summary\":\"Not yet.\",\"body\":\"Embargoed.\",\"publishedAt\":\"2999-01-01T00:00:00Z\"}";
        for (String item : new String[] {past, future}) {
            mvc.perform(post("/api/admin/press").header("X-Admin-Key", KEY).contentType(MediaType.APPLICATION_JSON).content(item)).andExpect(status().isCreated());
        }
        mvc.perform(get("/api/press")).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].slug").value("hello"));
        mvc.perform(get("/api/press/hello")).andExpect(status().isOk()).andExpect(jsonPath("$.body").value("Full story."));
        mvc.perform(get("/api/press/later")).andExpect(status().isNotFound());
        mvc.perform(post("/api/admin/press").header("X-Admin-Key", KEY).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"Bad Slug!\",\"title\":\"x\",\"summary\":\"x\",\"body\":\"x\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void adminNeedsTheKeyAndPublicRoutesNeedNone() throws Exception {
        mvc.perform(get("/api/admin/inbox")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/inbox").header("X-Admin-Key", "wrong")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/admin/jobs/x")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/jobs")).andExpect(status().isOk());
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    @Test
    void responsesCarryBrowserProtections() throws Exception {
        mvc.perform(get("/api/jobs"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Cache-Control", "no-store"));
    }

    @Test
    void onlyTheWebsiteMayCallFromABrowser() throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options("/api/contact")
                        .header("Origin", "http://localhost:4200").header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options("/api/contact")
                        .header("Origin", "https://evil.example").header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }
}

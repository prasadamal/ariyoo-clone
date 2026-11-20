package com.ariyoo.corporate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** With no ADMIN_API_KEY the admin API must not exist, even for someone who guesses a header. */
@SpringBootTest(properties = {"ariyoo.admin-key=", "spring.datasource.url=jdbc:h2:mem:nokey;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminDisabledTest {
    @Autowired MockMvc mvc;

    @Test
    void adminIsNotFoundWithoutAConfiguredKey() throws Exception {
        mvc.perform(get("/api/admin/inbox").header("X-Admin-Key", "")).andExpect(status().isNotFound());
        mvc.perform(get("/api/admin/inbox").header("X-Admin-Key", "anything")).andExpect(status().isNotFound());
    }
}

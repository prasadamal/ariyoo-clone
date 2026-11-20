package com.ariyoo.corporate.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Protects /api/admin/** with the key in the X-Admin-Key header. With no key configured the admin API
 * does not exist (404), so a missing setting can never leave it open.
 */
public class AdminKeyInterceptor implements HandlerInterceptor {
    private final Settings settings;

    public AdminKeyInterceptor(Settings settings) {
        this.settings = settings;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equals(request.getMethod())) return true;
        if (!settings.adminEnabled()) {
            response.sendError(404);
            return false;
        }
        String given = request.getHeader("X-Admin-Key");
        boolean ok = given != null
                && MessageDigest.isEqual(given.getBytes(StandardCharsets.UTF_8), settings.adminKey().getBytes(StandardCharsets.UTF_8));
        if (!ok) {
            response.setStatus(401);
            response.setContentType("application/json");
            response.getWriter().write("{\"code\":\"UNAUTHORIZED\",\"message\":\"Admin key required.\"}");
        }
        return ok;
    }
}

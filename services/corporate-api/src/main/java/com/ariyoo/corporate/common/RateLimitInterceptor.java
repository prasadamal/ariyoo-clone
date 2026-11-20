package com.ariyoo.corporate.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Clock;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Limits how often one address can submit the public forms (default 5 a minute), so the contact form
 * cannot be used to flood the team's inbox. Memory is bounded: idle addresses are dropped.
 */
public class RateLimitInterceptor implements HandlerInterceptor {
    private static final long WINDOW_MS = 60_000;
    private static final int MAX_TRACKED = 10_000;

    private final int limit;
    private final Clock clock;
    private final ConcurrentHashMap<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    public RateLimitInterceptor(int limit, Clock clock) {
        this.limit = limit;
        this.clock = clock;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!"POST".equals(request.getMethod())) return true;
        if (!allow(request.getRemoteAddr())) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.setHeader("Retry-After", "60");
            response.getWriter().write("{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests. Please wait a minute and try again.\"}");
            return false;
        }
        return true;
    }

    boolean allow(String address) {
        long now = clock.millis();
        if (hits.size() > MAX_TRACKED) hits.entrySet().removeIf(e -> expired(e.getValue(), now));
        Deque<Long> times = hits.computeIfAbsent(address, k -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && now - times.peekFirst() >= WINDOW_MS) times.pollFirst();
            if (times.size() >= limit) return false;
            times.addLast(now);
            return true;
        }
    }

    private static boolean expired(Deque<Long> times, long now) {
        synchronized (times) {
            return times.isEmpty() || now - times.peekLast() >= WINDOW_MS;
        }
    }
}

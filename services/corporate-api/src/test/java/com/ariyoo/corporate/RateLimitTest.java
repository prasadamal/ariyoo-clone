package com.ariyoo.corporate;

import static org.assertj.core.api.Assertions.assertThat;

import com.ariyoo.corporate.common.RateLimitInterceptor;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class RateLimitTest {
    /** A clock the test can move. */
    static class Movable extends Clock {
        long now = 1_000_000;
        public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(java.time.ZoneId z) { return this; }
        public Instant instant() { return Instant.ofEpochMilli(now); }
    }

    @Test
    void allowsTheLimitThenBlocksAndRecoversAfterAMinute() throws Exception {
        Movable clock = new Movable();
        RateLimitInterceptor limiter = new RateLimitInterceptor(3, clock);
        var allow = RateLimitInterceptor.class.getDeclaredMethod("allow", String.class);
        allow.setAccessible(true);
        for (int i = 0; i < 3; i++) assertThat((boolean) allow.invoke(limiter, "1.2.3.4")).isTrue();
        assertThat((boolean) allow.invoke(limiter, "1.2.3.4")).isFalse();
        // Someone else is not affected.
        assertThat((boolean) allow.invoke(limiter, "5.6.7.8")).isTrue();
        clock.now += 60_000;
        assertThat((boolean) allow.invoke(limiter, "1.2.3.4")).isTrue();
    }
}

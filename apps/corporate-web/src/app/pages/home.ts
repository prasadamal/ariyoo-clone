import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="hero">
      <div class="wrap">
        <p class="eyebrow">Ariyoo</p>
        <h1>Local knowledge, from the people who live it.</h1>
        <p class="lede">Ariyoo connects people who need a trustworthy answer with local experts who know a place first-hand, in conversations built for safety and privacy.</p>
        <div class="btn-row">
          <a routerLink="/contact" class="btn btn--light">Talk to our team</a>
          <a routerLink="/product" class="btn btn--ghost-light">How Ariyoo works</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <p class="eyebrow">Who Ariyoo is for</p>
        <h2>One platform, three ways to take part.</h2>
        <div class="grid grid--3 audience">
          <article class="card">
            <h3>People with a question</h3>
            <p>Where to eat in an unfamiliar city, how a local process really works, what to watch out for. Ask in plain words and get an answer from someone who knows.</p>
            <a routerLink="/product">See how asking works</a>
          </article>
          <article class="card">
            <h3>Local experts</h3>
            <p>Share what you know about your area, on your terms. Answer the questions that match your topics and build a record of the people you have helped.</p>
            <a routerLink="/product">See how experts take part</a>
          </article>
          <article class="card">
            <h3>Partners and investors</h3>
            <p>A focused product, a safety-first approach and a founding team based in Bengaluru. We are happy to talk about partnerships and the road ahead.</p>
            <a routerLink="/contact">Get in touch</a>
          </article>
        </div>
      </div>
    </section>

    <section class="section section--alt">
      <div class="wrap">
        <p class="eyebrow">How it works</p>
        <h2>From question to resolved, in three steps.</h2>
        <ol class="steps">
          <li><span class="num">1</span><div><h3>Ask</h3><p>Describe what you need and add a topic or a place. Photos can be shared inside the conversation when they help.</p></div></li>
          <li><span class="num">2</span><div><h3>Get matched</h3><p>Your question goes to a local expert whose topics fit. If none is available, it waits in an open queue where any expert can pick it up.</p></div></li>
          <li><span class="num">3</span><div><h3>Close the loop</h3><p>Mark the question answered and say whether it helped. Experts build a visible record, and you keep a private library of the answers worth saving.</p></div></li>
        </ol>
      </div>
    </section>

    <section class="section section--deep">
      <div class="wrap">
        <p class="eyebrow">Our principles</p>
        <h2>Built to be trusted from the first conversation.</h2>
        <div class="grid grid--3 principles">
          <div><h3>Safety by design</h3><p>Reporting and blocking in every conversation, automatic filtering of abusive messages, and a moderation team that can suspend accounts.</p></div>
          <div><h3>Privacy by default</h3><p>No advertising, no analytics trackers, no location or contacts collected. Photos can be opened only by the two people in the conversation.</p></div>
          <div><h3>Accountable experts</h3><p>Askers can say whether an answer helped, and that feedback becomes the expert's public record. Reputation is earned, not claimed.</p></div>
        </div>
        <div class="btn-row"><a routerLink="/trust" class="btn btn--ghost">Read about Trust &amp; Safety</a></div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="cta card">
          <div>
            <h2>Let's talk about what Ariyoo can do for you.</h2>
            <p class="lede">Whether you want to partner, invest, report on us or join the team, we read every message.</p>
          </div>
          <a routerLink="/contact" class="btn btn--primary">Contact us</a>
        </div>
      </div>
    </section>
  `,
  styles: `
    .hero { background: var(--deep); color: var(--on-deep); padding: clamp(72px, 12vw, 150px) 0 clamp(64px, 10vw, 128px); background-image: radial-gradient(1000px 460px at 80% -10%, rgba(60, 197, 155, 0.2), transparent 70%), radial-gradient(600px 320px at 0% 100%, rgba(242, 178, 78, 0.1), transparent 70%); }
    .hero .eyebrow { color: var(--green-bright); }
    .hero h1 { max-width: 16ch; }
    .hero .lede { color: var(--on-deep-soft); font-size: clamp(1.15rem, 1.8vw, 1.4rem); }
    .audience a { font-weight: 600; }
    .steps { list-style: none; padding: 0; margin: 40px 0 0; display: grid; gap: 28px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .steps li { display: flex; gap: 18px; align-items: flex-start; }
    .num { flex: none; width: 44px; height: 44px; border-radius: 50%; background: var(--green); color: #fff; display: grid; place-items: center; font: 700 1.15rem/1 var(--font-display); }
    .principles { margin-top: 36px; }
    .principles h3 { color: var(--on-deep); }
    .principles p { color: var(--on-deep-soft); }
    .cta { display: flex; align-items: center; justify-content: space-between; gap: 28px; flex-wrap: wrap; }
    .cta h2 { margin-bottom: 0.3em; }
    .cta p { margin: 0; }
  `,
})
export class Home {}

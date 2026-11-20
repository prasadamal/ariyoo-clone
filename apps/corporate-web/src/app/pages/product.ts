import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHero } from '../ui/page-hero';

@Component({
  selector: 'app-product',
  imports: [RouterLink, PageHero],
  template: `
    <app-page-hero eyebrow="Product" title="A question, a local expert, a real answer." lede="Ariyoo is a mobile platform for asking questions about a place and getting answers from people who know it first-hand." />

    <section class="section">
      <div class="wrap grid grid--2">
        <article class="card">
          <h2>For people asking</h2>
          <ul class="ticks">
            <li>Ask in plain words, with a topic or a place so the right expert sees it.</li>
            <li>Chat privately with the expert who takes your question, including photos when they help.</li>
            <li>Get notified when you receive an answer.</li>
            <li>Mark the question answered and say whether it helped.</li>
            <li>Search everything you have asked and keep the answers worth saving in your own private library.</li>
          </ul>
        </article>
        <article class="card">
          <h2>For local experts</h2>
          <ul class="ticks">
            <li>Choose the topics and places you know, and see questions that match.</li>
            <li>Pick up open questions from a shared queue. One expert takes each question, so no one answers twice.</li>
            <li>Build a visible record: how many questions you have answered and how many helped.</li>
            <li>Block or report anyone who behaves badly, in a tap.</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="section section--alt">
      <div class="wrap">
        <p class="eyebrow">What is inside</p>
        <h2>The platform, in brief.</h2>
        <div class="grid grid--3">
          <div class="card"><h3>Smart matching</h3><p>Questions reach experts by topic. Questions without a match wait in an open queue, claimed by exactly one expert.</p></div>
          <div class="card"><h3>Private conversations</h3><p>Real-time chat between two people. Photos are visible only to the two participants.</p></div>
          <div class="card"><h3>Outcomes that count</h3><p>Closing a question records whether it helped, which becomes the expert's public track record.</p></div>
          <div class="card"><h3>Personal library</h3><p>Search your own conversations and save the answers you will want again. Saved answers are private to you.</p></div>
          <div class="card"><h3>Safety tools</h3><p>Report, block, automatic filtering of abusive messages, and moderator suspension, all built in.</p></div>
          <div class="card"><h3>Light and dark</h3><p>An interface that follows your phone's appearance setting, designed for readability.</p></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <h2>Availability</h2>
        <p class="lede">Ariyoo for Android and iOS is being prepared for public launch. If you would like early access, a demonstration, or to discuss a partnership, we would be glad to hear from you.</p>
        <div class="btn-row"><a routerLink="/contact" class="btn btn--primary">Request a demonstration</a></div>
      </div>
    </section>
  `,
  styles: `
    .ticks { list-style: none; padding: 0; margin: 18px 0 0; display: grid; gap: 14px; }
    .ticks li { padding-left: 30px; position: relative; }
    .ticks li::before { content: ''; position: absolute; left: 0; top: 0.5em; width: 14px; height: 8px; border-left: 2.5px solid var(--green); border-bottom: 2.5px solid var(--green); transform: rotate(-45deg) translateY(-3px); }
  `,
})
export class Product {}

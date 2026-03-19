---
title: 'March 18 Research Notes: Agentic Vending, Pre-Training Data, and Constitutional Classifiers'
excerpt: "A cleaned-up synthesis of the March 18 deck, spanning Project Vend 2, data poisoning, token-level filtering, duplication, replayed pre-training data, and Anthropic's next-generation constitutional classifiers."
publishDate: '2026-03-19T09:30:00-04:00'
isFeatured: false
tags:
  - Agents
  - Pre-training
  - Data
  - AI Safety
  - LLM
seo:
  title: 'March 18 Research Notes: Agentic Vending, Pre-Training Data, and Constitutional Classifiers'
  description: 'A synthesis of the March 18 deck on Project Vend 2, pre-training data control, poisoning, duplication, and constitutional classifiers.'
  image:
    src: '/blog/march-18-data-synthesis.svg'
    alt: 'Diagram connecting agentic environments, training data control, and safety classifiers'
---

The March 18 deck looks broad on the surface. It starts with an agent running a vending-machine business, moves into pre-training data curation, and ends with constitutional classifiers for safety. But I do not think these are disconnected topics.

What follows is my synthesis of the deck's connective tissue and cited papers, not a slide-by-slide transcription of every claim.

The deck itself reads more like a research-group handout than a finished essay. The slides are terse, some opinions are stated very bluntly, and several papers are referenced only through a single takeaway. Turning that into a useful blog post means keeping the specific claims from the PDF while also making the larger argument easier to see.

My read is that the deck is really about one question:

> **How much of model behavior can we shape without changing the base model architecture?**

The slides point to three different control surfaces:

- the **environment and scaffolding** around an agent;
- the **data distribution** used during pre-training and fine-tuning;
- the **classifier and escalation layers** used at inference time.

That is why the sequence makes sense. `Project Vend 2` is about shaping agent behavior through tools, authority, and business constraints. The pre-training section is about shaping capability through data choice. The constitutional-classifier section is about shaping harmful behavior with a layered safety system.

![A map linking agentic environment design, data curation, and safety classifiers.](/blog/march-18-data-synthesis.svg)

_Figure 1. The March 18 material can be read as a single story about controllability: environment design, data selection, and safety gating are all levers on model behavior._

## What the deck covers

One reason the PDF can feel more fragmented than it actually is is that each slide compresses a larger paper into one or two bullets. Read at the level of research agenda rather than slide formatting, the structure is clean:

| Block | What the deck emphasizes | Why it matters |
| --- | --- | --- |
| `Project Vend 2` | Better tooling and executive oversight improve outcomes, but the agent still lacks disciplined business judgment | Agent performance depends on environment design, not just model quality |
| Pre-training data papers | Small poisoned sample counts matter; filtering can be token-level; replay reduces forgetting; duplication changes with scale | Data curation is a capability-control layer, not just a hygiene step |
| Constitutional classifiers | Cheap probes can escalate only suspicious cases to a larger model | Safety systems can be hierarchical instead of uniformly expensive |

The PDF also references earlier discussions with placeholders like "link" instead of full citations. I read those as reminders that this deck sits inside an ongoing reading group rather than as missing technical claims that the post needs to reconstruct.

## 1. Project Vend 2: better scaffolding helps, but it does not create business judgment

The first major topic in the deck is `Project Vend 2`, which follows an earlier vending-machine-agent setup. The premise is simple and useful: deploy Claude as an agent, let it manage a vending-machine business, and observe what happens when that agent has to make repeated operational decisions.

The deck highlights the failure mode from the earlier `Vend 1` setup:

- the agent ordered extremely expensive but useless items from suppliers;
- it was too easy to persuade with discounts or promotions;
- it behaved more like a gullible local optimizer than a competent operator.

`Vend 2` adds more structure:

- more scaffolding around the agent;
- access to a customer relationship management (`CRM`) tool;
- access to inventory;
- access to the internet;
- an extra agent acting as the `CEO` of Claudius, with authority to reject some discount or promotion requests.

The result, according to the deck, is directionally encouraging but not fully satisfying. Financial performance improves, yet the agent is still "not very calculated" in its decisions.

That outcome is important because it separates two things that are often conflated in agent discussions:

- **constraint handling**
- **strategic reasoning**

Additional tools and oversight can reduce the worst mistakes. They can stop obviously bad purchases, force the agent to look at inventory, and make persuasion attacks harder. But those same controls do not automatically produce strong business judgment. An agent can become less reckless without becoming truly analytical.

I think that is exactly why this environment is interesting.

### Why Vend is a strong research environment

The deck explicitly calls this "a perfect environment/example to study agentic behavior in OR/business contexts." I agree with that framing for at least four reasons.

First, it has **real objectives**. Revenue, cost, margin, stockouts, and procurement choices give the problem a quantitative structure that is more meaningful than a toy chat benchmark.

Second, it has **adversarial inputs**. Suppliers can pitch bad deals. Customers create shifting demand. Promotions can be manipulative. That makes it a better test of judgment than a static question-answer setup.

Third, it exposes the value of **organizational structure**. Adding a CEO agent is not a model-weight change. It is a governance change. That lets researchers ask when oversight layers help and when they merely slow things down.

Fourth, it is naturally suited to **operations research style analysis**. You can inspect policies, costs, interventions, and business outcomes directly. That makes it a promising bridge between modern LLM agents and classical decision-making research.

### The main lesson from Vend 2

The core lesson is not that the model "failed." It is that agent competence is highly sensitive to the surrounding system design.

In other words:

- better scaffolding can improve performance materially;
- oversight can reduce exploitable behavior;
- but neither one guarantees that the agent will reason in a disciplined, profit-aware way.

That is a useful warning for anyone building agents in commercial settings. If an agent looks bad in a live workflow, the failure may not mean the base model is useless. But it also does not mean a few guardrails will turn it into a good operator. You still need a serious view of incentives, authority, information access, and escalation.

## 2. Pre-training data is not just fuel; it is a capability control surface

The middle of the deck shifts from deployed agents to the data pipeline. This section is the densest part of the material, and I think it carries the strongest technical message.

The message is this:

> **Training data does not just fill the model with knowledge. It shapes what the model can do, forget, generalize, and misuse.**

The slides briefly point to Hugging Face's [FinePhrase](https://huggingface.co/spaces/HuggingFaceFW/finephrase) and then focus on a cluster of papers about poisoning, filtering, replay, duplication, and data selection. Read together, those papers argue that data engineering is increasingly a precision tool rather than a coarse cleaning step.

### A quick note on the FinePhrase slide

The FinePhrase mention is brief, and the slide itself signals that it is only a quick pointer rather than a confident evaluation. So I do not want to assign it more weight than the PDF does.

What it does show is the intended framing for the rest of the section. The pre-training block is not just a list of unrelated readings. It is a survey of ways to *intervene on the corpus itself*: inspect it better, poison it, filter it more selectively, replay parts of it later, or rethink what counts as duplication.

## 3. A few hundred poisoned samples can matter far more than their fraction suggests

The first paper highlighted is Anthropic's ["A small number of samples can poison LLMs of any size"](https://www.anthropic.com/research/small-samples-poison).

The setup in the deck is strikingly simple:

- models of `600M`, `2B`, `7B`, and `13B` parameters;
- each trained with roughly the Chinchilla-optimal token budget;
- only `250` to `500` poisoned training samples mixed into pre-training.

The main takeaway written on the slide is the one that matters most:

- the poisoning attack works;
- the dangerous quantity is not a fixed proportion such as `1%` of pre-training data;
- instead, even a **small absolute number of malicious samples** can be enough.

This matters because many people still reason about data risk proportionally. They implicitly think, "Our corpus is so large that a few hundred bad documents cannot matter." The slide points in the opposite direction. If the poisoned samples are well-designed and the training setup is sensitive to them, absolute count can matter more than naive percentage-based intuition.

That is an uncomfortable result, but also a clarifying one. It means pre-training security is closer to software supply-chain security than to ordinary random-noise robustness. A small number of strategically placed failures can have outsized downstream effect.

## 4. Token-level filtering is a much more surgical way to shape capabilities

The next paper, ["Shaping capabilities with token-level data filtering"](https://arxiv.org/pdf/2601.21571), asks a different question:

> Suppose we want a model to remain broadly useful while becoming weaker on a specific domain such as medicine. How precisely can we edit the training distribution?

The deck contrasts two approaches.

The common approach is **document filtering**:

- identify documents related to medicine;
- remove those documents from the training corpus.

The proposed approach is **token-level filtering**:

- keep the document;
- remove only the tokens associated with the target capability.

The mechanism described in the slides is also interesting:

- train a small sparse autoencoder;
- use node activations associated with the target concept;
- label tokens through those activations;
- filter at token granularity instead of document granularity.

Why is this important? Because document filtering is blunt. Real documents mix many capabilities together. A medical article may also contain ordinary grammar, commonsense facts, and general reasoning structure. If you remove the whole document, you discard much more than the targeted capability.

Token-level filtering promises a finer intervention:

- retain more of the generic training signal;
- remove less collateral information;
- shape capabilities more selectively.

This is part of a broader trend I find notable: interpretability tools are no longer only diagnostic. They are increasingly being used as control mechanisms inside training-data pipelines.

## 5. Replaying pre-training data during SFT is a clean answer to forgetting

Another paper in the deck is ["Replaying pre-training data improves fine-tuning"](https://arxiv.org/pdf/2603.04964).

The idea is simple enough to explain in one sentence:

> Mix some pre-training data back into supervised fine-tuning so the model does not forget too much of its general competence.

The slide's figure contrasts pre-training data and SFT data visually, and the written summary is direct: replay helps avoid forgetting.

This may sound unsurprising, but it is important because it treats post-training as a **continual learning** problem rather than a one-way specialization step.

When people fine-tune aggressively on narrow instruction data, they often pay for it through regression in broad knowledge or general-purpose behavior. The replay perspective says we should not accept that tradeoff as inevitable. Instead, we can explicitly preserve the pre-training distribution inside the fine-tuning stage.

That has at least three practical implications:

- fine-tuning should be thought of as **distribution mixing**, not just instruction imitation;
- broad capability preservation should be measured intentionally;
- forgetting can be managed through data composition, not only optimizer tricks.

## 6. Duplication depends on model scale, which should change how we think about dedup

The deck then turns to ["Scale Dependent Data Duplication"](https://arxiv.org/pdf/2603.06603), which the slide author describes as a great paper for researchers from statistics and operations research, even if not immediately practical.

The paper's framing, as summarized in the deck, is elegant:

- measure the effect of a sample `x_i` by the gradient it induces under next-token prediction or SFT;
- measure similarity between samples `x_i` and `x_j` using cosine similarity between those gradient vectors;
- define "duplicates" not only as exact copies, but also as transformed variants.

The transformations listed on the slide include:

- swapping characters;
- dropping words;
- capitalization changes;
- translation into Chinese, French, or German.

That is already a useful conceptual move. It shifts duplication away from raw string identity and toward **optimization-level equivalence**.

The reported finding is even more interesting:

- smaller models may not treat `x` and `T(x)` as duplicates;
- larger models increasingly do;
- duplicated samples hurt the scaling behavior of pre-training.

The slide author also briefly gestures to another recent paper as a "negative example," but does not explain the criticism. I would not overread that aside. The durable point here is the metric design: define redundancy in gradient space, then show that redundancy is relative to model scale rather than fixed by string similarity.

This suggests that deduplication policy should be **scale-aware**. A transformation that looks meaningfully distinct to a smaller model may become redundant to a larger one. If so, corpus curation cannot be fully model-agnostic. What counts as wasteful repetition depends on the representational power of the model you are training.

I think that is one of the strongest ideas in the whole deck. It opens a line of thinking where data curation is not a static preprocessing step performed once for every future model size. Instead, it becomes part of the scaling law itself.

## 7. The notes are skeptical of optimization-geometry-driven data selection

The deck also mentions ["OPUS: Towards Efficient and Principled Data Selection in Large Language Model Pre-training in Every Iteration"](https://arxiv.org/abs/2602.05400), but the commentary here is notably harsher.

The slide says, in plain terms, that it is "not a good paper" in the author's view and adds a strong opinion:

> You should not change the data selection based on optimization geometry like the gradient or Hessian.

I would present that not as a settled result, but as the stance embedded in the deck. The broader concern is understandable, though.

If you adjust the data distribution too aggressively based on short-horizon optimization signals, you risk turning pre-training into a reactive process that chases local geometry instead of building a stable, diverse corpus. That could create at least three problems:

- overfitting data choice to transient optimization dynamics;
- reducing interpretability of the training pipeline;
- confusing short-term training efficiency with long-term capability quality.

Even if one does not fully endorse the criticism, the skepticism is valuable. It pushes back against the reflex that every observable training statistic should become a control knob.

## 8. What ties the pre-training section together

These papers are not all solving the same problem, but they do fit a common pattern.

They collectively argue that:

- **small amounts of bad data can matter a lot**;
- **selective removal can be more effective than coarse removal**;
- **general competence can be preserved by replaying old distributions**;
- **redundancy is model-scale dependent, not fixed once and for all**.

That is a remarkably compact summary of where data-centric LLM research is going. We are moving from "collect a large corpus and filter obvious junk" toward "treat the dataset as a precise instrument for shaping behavior."

## 9. Constitutional classifiers: safety through fast probes and selective escalation

The final major topic is Anthropic's ["Next-generation Constitutional Classifiers"](https://www.anthropic.com/research/next-generation-constitutional-classifiers).

The deck presents this with a note of caution: it suggests that this may not be the core mechanism used inside Claude, but it still treats the work as something the open-source community can learn from. I think that is a fair stance.

The slide frames the problem in terms familiar from Anthropic's `Constitution` and OpenAI's `Model Spec`:

- define behavioral principles;
- detect or block harmful content;
- do so without making the system too slow or too expensive.

The previous version, as described in the deck, relied on fine-tuning Claude as a binary harmful-content classifier. The issue was cost. Deliberative safety systems can be effective, but they can also be slow and computationally heavy.

The new direction is much cheaper:

- perform linear probing on the model's internal activations;
- use logistic regression to predict harmfulness;
- build a hierarchical system;
- if the lightweight probe raises an alarm, escalate to a larger model.

The slide itself truncates one line after "to predict," but the intended role is clear from the surrounding bullets: the probe is there to predict a harmfulness or safety-risk signal cheaply enough to use as a first-pass filter.

That architecture is attractive because it separates **screening** from **judgment**.

A cheap probe can handle the easy cases or, at minimum, identify suspicious ones. A larger model only spends tokens and latency when the first-stage signal warrants escalation. That is exactly how many practical systems need to work if they are going to serve real traffic.

There is also a deeper idea here: internal representations may carry useful safety information before the full model has generated a long explicit deliberation. If that is true, representation-level monitoring becomes a powerful complement to output-level moderation.

## 10. The deck's deeper throughline

If I had to compress the whole March 18 deck into three claims, they would be these.

These three points are my reading of the deck's throughline rather than three literal bullets presented verbatim on a single slide.

### 10.1 Behavior is shaped by more than weights

`Vend 2` shows that tools, authority, and scaffolding can materially alter outcomes. The constitutional-classifier work shows that a layered moderation system can alter deployment behavior without retraining the core generator. The data papers show that distribution design changes the capabilities the model internalizes in the first place.

That is one continuum, not three separate stories.

### 10.2 Control is getting more fine-grained

The deck repeatedly moves from coarse intervention to finer intervention:

- from a naive agent to an agent with tool access and supervisory structure;
- from document filtering to token-level filtering;
- from monolithic moderation to hierarchical probe-and-escalate systems.

This is the clearest research trend in the material. The field is learning that blunt controls are often too destructive or too expensive.

### 10.3 Good systems need both competence and governance

The agentic-business example is not solved by guardrails alone. The safety example is not solved by competence alone. The data example is not solved by scale alone.

A useful AI system needs all three:

- capability;
- operational discipline;
- governance layers that catch failures efficiently.

## 11. Where I think the strongest research opportunities are

The deck implicitly suggests a research agenda that I think is worth making explicit.

### 11.1 OR-style benchmarks for agentic business behavior

`Project Vend` is exactly the sort of environment where we can study whether agents understand tradeoffs, inventory dynamics, pricing, persuasion, and approval workflows. That feels much closer to real deployment than pure QA benchmarks.

### 11.2 Scale-aware data curation

If duplication is scale dependent and poisoning is sensitive to small absolute sample counts, then data pipelines should become much more tightly coupled to the target model scale and threat model.

### 11.3 Representation-level safety systems

The constitutional-classifier direction suggests that internal activations may be a practical moderation surface. If that line develops, safety engineering could become much more hierarchical, with cheap internal signals routing only the hard cases to expensive models.

## 12. Bottom line

The March 18 deck is best read not as a loose pile of paper summaries, but as a coherent note on **controllability**.

- `Vend 2` says environment design shapes deployed behavior.
- The pre-training papers say data composition shapes capability and failure modes.
- Constitutional classifiers say representation-level probes and escalation layers shape what safely reaches the user.

That is a strong and modern systems view of LLMs. The model matters, of course. But increasingly, the most interesting research is about how we structure the world around the model: its tools, its data, and the mechanisms that decide when to trust it.

If I had to summarize the practical message in one line, it would be this: better AI systems will not come only from larger base models. They will also come from better environments, more deliberate dataset design, and cheaper, smarter ways to route risky cases before they turn into failures.

## Sources Mentioned In The Deck

- [Hugging Face FinePhrase](https://huggingface.co/spaces/HuggingFaceFW/finephrase)
- [Anthropic: A small number of samples can poison LLMs of any size](https://www.anthropic.com/research/small-samples-poison)
- [_Shaping capabilities with token-level data filtering_](https://arxiv.org/pdf/2601.21571)
- [_Replaying pre-training data improves fine-tuning_](https://arxiv.org/pdf/2603.04964)
- [_Scale Dependent Data Duplication_](https://arxiv.org/pdf/2603.06603)
- [_OPUS: Towards Efficient and Principled Data Selection in Large Language Model Pre-training in Every Iteration_](https://arxiv.org/abs/2602.05400)
- [Anthropic: Next-generation Constitutional Classifiers](https://www.anthropic.com/research/next-generation-constitutional-classifiers)

---
title: Why Agentic Design is Necessary for Data Analytics
publishDate: 'Jan 11 2026'
isFeatured: true
---

**Authors:** Yikai Wang

## 1. The Central Question

This paper asks a precise systems question: when data-analytics tasks are multi-step and multi-task, can a standalone LLM inference pipeline ever be enough, or is agentic design structurally necessary?

The paper defines the two modes clearly:

- **standalone inference**: feed the prompt into a pretrained or post-trained LLM and take the output directly, without reasoning loops or tool calls;
- **agentic inference**: allow planning, decomposition, verification, and tool use at inference time.

The claim is not merely empirical. The paper argues that in multi-task data analytics, standalone inference has a representation bottleneck that standard pre-training and post-training do not resolve.

<figure style="margin: 1.5rem 0;">
  <img src="/papers/agentic-vs-standalone.jpg" alt="Agentic versus standalone" style="display:block; width:100%; max-width:760px; margin:0 auto;" loading="lazy" />
  <figcaption><em>The first figure makes the distinction clean: agentic systems insert intermediate control flow, while standalone systems collapse the whole task into one direct pass.</em></figcaption>
</figure>

## 2. Formal Setup: Multi-task Analytics as Prompt-conditioned Learning

The paper studies prompts of the form

$$
P = [x_1, y_1, x_2, y_2, \ldots, x_n, y_n, x_{n+1}]
$$

where the pairs `(x_i, y_i)` come from some underlying task `f`, and the model is expected to output `y_{n+1} = f(x_{n+1})`.

In a single-task setting, a sufficiently trained Transformer can do surprisingly well at this kind of in-context learning. The interesting question is what happens when the task itself is sampled from a mixture distribution, for example:

- linear regression,
- quadratic regression,
- classification.

Now the model must do two things at once:

1. infer the task type from the prompt;
2. solve the task conditional on that inferred type.

The paper argues that this first step is exactly where standalone inference breaks down.

<figure style="margin: 1.5rem 0;">
  <img src="/papers/agentic-performance-gap.jpg" alt="Agentic performance gap" style="display:block; width:100%; max-width:760px; margin:0 auto;" loading="lazy" />
  <figcaption><em>The empirical gap is large before any theorem is invoked: on the same multi-task setting, agentic systems strongly outperform standalone inference.</em></figcaption>
</figure>

## 3. The Representation Bottleneck in Standalone Inference

To make the argument analyzable, the paper abstracts a Transformer-based standalone LLM as

$$
f_\omega(P) = \varpi_\omega(\rho_\omega(P))
$$

where $\rho_\omega(P)$ is the prompt representation produced by the Transformer stack and $\varpi_\omega$ is the relatively simple output head. Once written in this way, the weakness becomes clear: all prompts from all tasks must first be mapped into one shared representation space.

If prompts from different task families are not well separated in that space, then the output head cannot consistently apply the correct task rule. In other words, downstream prediction quality depends on whether the penultimate representation carries task identity cleanly enough.

<figure style="margin: 1.5rem 0;">
  <img src="/papers/agentic-transformer-abstraction.jpg" alt="Transformer abstraction for standalone inference" style="display:block; width:100%; max-width:760px; margin:0 auto;" loading="lazy" />
  <figcaption><em>The paper's decomposition clarifies why the issue is structural. The model can only succeed if the representation extractor separates task types before the final head makes its prediction.</em></figcaption>
</figure>

The experiments support exactly this diagnosis. The authors take embeddings from the penultimate layer and train a classifier to predict the task type. The task classification accuracy is only slightly above random guessing in the multi-task environments considered. That means the representation is already too entangled before the final prediction stage.

<figure style="margin: 1.5rem 0;">
  <img src="/papers/agentic-standalone-models.jpg" alt="Standalone models comparison" style="display:block; width:100%; max-width:760px; margin:0 auto;" loading="lazy" />
  <figcaption><em>The model comparison further shows that this is not just a small-model issue. Off-the-shelf standalone LLMs also remain weak in the same multi-task setting.</em></figcaption>
</figure>

## 4. Why Standard Pre-training and Post-training Do Not Fix the Problem

The paper then makes a stronger claim: the failure is not repaired by the usual training upgrades.

Under the standard pre-training pipeline, the model minimizes the main prediction loss on prompts sampled from a mixture of task distributions. But the training objective does not explicitly reward task identification. So the model can converge to an averaged representation that is adequate on aggregate and still poor at separating tasks.

This leads to the paper's theoretical conclusions:

- when task embeddings are not well separated, the achievable downstream loss has a nontrivial lower bound;
- post-training can improve the task classification rate slightly, but not in a stable enough way to restore downstream performance;
- in some reported settings, post-training actually worsens the downstream analytics behavior relative to pre-training.

This is a sharp result because it pushes back on a common assumption that more SFT or RLHF should eventually solve everything. The paper's argument is that if the representation itself is wrong for multi-task analytics, post-training only moves the output head around a flawed latent geometry.

## 5. Agentic Design Works Because It Avoids the Need for One-shot Task Compression

The paper does not attempt a full theorem for agentic systems, and that is reasonable because there is no single canonical agentic architecture. But the conceptual advantage is clear.

An agentic system does not need to encode the entire multi-task decision process into one latent vector and one direct output. Instead, it can:

- inspect the prompt;
- infer the likely task class;
- decide which operation or tool is needed;
- verify intermediate results;
- re-plan if the previous step was wrong.

That decomposition removes the main burden placed on `rho_omega(P)` in standalone inference. The model no longer has to solve the whole task-selection-and-solution pipeline in one irreversible pass.

In data analytics, that matters because tasks are rarely atomic. Cleaning, transformation, model selection, estimation, and interpretation are chained operations. Agentic design is therefore not an aesthetic preference. It is a way to avoid a brittle compression bottleneck.

## 6. The Alternative Proposed in the Paper: Auxiliary Loss During Pre-training

The paper does explore a non-agentic repair strategy. If the pre-training data includes task labels $z$, add an auxiliary classifier on top of the learned representation and optimize

$$
L_T(\theta, \psi) = E\left[L_{\mathrm{main}}(\varpi_\omega(\rho_\omega(P)), y) + \lambda L_{\mathrm{aux}}(h_\psi(\rho_\omega(P)), z)\right]
$$

This augmented objective explicitly teaches the model to separate tasks in representation space while still solving the original predictive objective.

<figure style="margin: 1.5rem 0;">
  <img src="/papers/agentic-auxiliary-pipeline.jpg" alt="Auxiliary pretraining pipeline" style="display:block; width:100%; max-width:760px; margin:0 auto;" loading="lazy" />
  <figcaption><em>The auxiliary-loss proposal is important because it shows the authors are not simply claiming failure. They identify the bottleneck and then modify training to attack that bottleneck directly.</em></figcaption>
</figure>

Empirically, this works in the expected direction. Task classification from the learned embeddings improves, and downstream predictive performance improves as well.

<figure style="margin: 1.5rem 0;">
  <img src="/papers/agentic-auxiliary-results.jpg" alt="Auxiliary training results" style="display:block; width:100%; max-width:760px; margin:0 auto;" loading="lazy" />
  <figcaption><em>The auxiliary-loss results confirm the paper's diagnosis: once task representations are made more separable, standalone inference improves. The failure mode was representational, not merely a lack of scale.</em></figcaption>
</figure>

But the paper is careful here. Even with the improved pipeline, standalone inference still remains weaker than a simple agentic approach. So the alternative loss is not presented as a replacement for agents. It is presented as evidence for why the standard non-agentic pipeline is mismatched to the task.

## 7. Additional Evidence: Task-mixture Imbalance and Averaging Behavior

The later experiments strengthen the story in two ways.

First, the relative proportions of tasks in the pre-training distribution influence downstream performance. That means standalone inference is sensitive to how much each task family is represented during pre-training, which is exactly what you would expect if the model is learning an average latent compromise rather than a clean routing mechanism.

Second, in the two-task regression environment, the paper shows that the standard pipeline behaves like an average of the task-specific Bayes estimators instead of recognizing which estimator should be active. The auxiliary-loss pipeline tracks the correct estimator more closely.

This is a very nice result because it turns the representation argument into something observable. The model is not just wrong. It is wrong in a very specific way: it averages across incompatible task structures.

## 8. Why This Paper Matters

The paper matters because it upgrades a common intuition into a concrete technical statement. People often say agentic systems are better for analytics because they can plan and use tools. This work explains **why** standalone inference is weak even before planning and tools are added.

The central message is:

1. multi-task analytics requires implicit task identification;
2. standard standalone LLM training does not encourage clean task separation in representation space;
3. therefore standalone inference remains structurally limited;
4. agentic design is the practical answer, unless one is willing to redesign pre-training itself.

That last point is important. The paper is not saying standalone inference is impossible. It is saying that making it truly competitive would require a different training pipeline than the one most LLMs use today. For actual data-analytics systems, agentic design is therefore the more realistic engineering path.

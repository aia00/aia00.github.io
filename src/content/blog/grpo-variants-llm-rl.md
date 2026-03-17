---
title: "GRPO and Its Variants: What Actually Changes, and Why It Matters"
excerpt: A long-form engineering guide to GRPO, Dr.GRPO, DAPO, BNPO, REINFORCE++, RLOO, and newer trainer variants, with an emphasis on normalization, length bias, and practical training choices for LLM RL.
publishDate: '2026-03-17T18:00:00-04:00'
isFeatured: false
tags:
  - RLHF
  - GRPO
  - LLM
  - Reinforcement Learning
seo:
  title: "GRPO and Its Variants: What Actually Changes, and Why It Matters"
  description: An English overview of GRPO and related variants such as Dr.GRPO, DAPO, BNPO, REINFORCE++, and RLOO, with formulas, tradeoffs, and implementation guidance.
  image:
    src: '/blog/grpo-variants-map.svg'
    alt: Map of GRPO variants in LLM reinforcement learning
---

`GRPO` itself is not hard to understand.

For one prompt, sample several completions, score them, compare them within the same group, and push up the better ones without training a separate critic. That is the core idea.

The part that gets messy is not GRPO. The messy part is what came *after* it: `Dr.GRPO`, `DAPO`, `BNPO`, `REINFORCE++`, `RLOO`, and newer trainer variants. Those methods are all trying to fix specific weaknesses in the original recipe.

Before getting there, it is still useful to place `GRPO` next to `PPO` and `DPO`, because these three names are often mixed together even though they answer different questions:

- `PPO`: online RLHF with a critic;
- `DPO`: offline preference optimization from chosen-vs-rejected pairs;
- `GRPO`: online critic-free RL using same-prompt relative rewards.

That is enough context. The rest of the story is really about what people changed inside GRPO once they started training long reasoning traces at scale.

In practice, most of the GRPO line is repeatedly editing three things:

- how rewards are normalized into advantages;
- how token losses are aggregated across responses of different lengths;
- how aggressively the update is clipped, filtered, or reweighted.

Once you look at the family through those three axes, the landscape becomes much easier to reason about.

![GRPO family map](/blog/grpo-variants-map.svg)

*Figure 1. Most methods in the GRPO line are not changing everything at once. They mainly edit normalization, length handling, and update control.*

## 1. PPO, DPO, and GRPO in one table

The shortest useful comparison is this:

| Method | Training signal | Online rollouts? | Critic needed? | Typical strength | Typical weakness |
| --- | --- | --- | --- | --- | --- |
| PPO | scalar reward from RM or verifier | yes | yes | flexible online RL baseline | expensive and operationally heavy |
| DPO | chosen vs rejected preference pairs | no | no | simple offline alignment | cannot adapt online to the current policy |
| GRPO | same-prompt group-relative reward comparison | yes | no | online and critic-free | sensitive to normalization and length handling |

The tradeoff is straightforward:

- if you already have a preference dataset and want the simplest stable pipeline, `DPO` is often the first thing to try;
- if you need online exploration against a reward model or verifier and can afford a full RL stack, `PPO` is the classical answer;
- if you need online adaptation but want to avoid the cost of a value model, `GRPO` becomes appealing.

This is why GRPO shows up so often in math, code, tool use, and other RLVR-style settings: the reward is sparse but checkable, so online exploration helps, while a large critic may not be worth the extra complexity.

## 2. Start with the real problem: LLM RL without an expensive critic

Suppose we have a prompt \(q\). We sample \(G\) completions from the current policy:

$$
o_1, o_2, \dots, o_G.
$$

Each completion receives a scalar reward \(r_i\). In reasoning and RLVR settings, that reward is often verifiable:

- a math answer is correct or incorrect;
- a code solution passes or fails tests;
- a format constraint is satisfied or violated;
- a tool-use trace is accepted or rejected by a checker.

The key point is that reward is usually **sparse and sequence-level**. We do not have dense token-level supervision, and we often do not want to train a separate value model if we can avoid it.

That is where GRPO became attractive. Instead of training a critic, it compares multiple completions for the **same prompt** and uses their relative rewards as the learning signal.

A common simplified form is

$$
A_i = \frac{r_i - \bar r}{\operatorname{std}(r_1,\dots,r_G)},
\qquad
\bar r = \frac{1}{G}\sum_{j=1}^{G} r_j.
$$

Here \(A_i\) is the advantage assigned to the whole completion \(o_i\). Every token in that completion then inherits the same sequence-level advantage.

The policy loss is still PPO-like. If \(\rho_{i,t}\) is the new-to-old policy ratio at token \(t\) in completion \(i\), a standard schematic form is

$$
\mathcal{L}_{\text{GRPO}}
= - \frac{1}{G} \sum_{i=1}^{G} \frac{1}{|o_i|} \sum_{t=1}^{|o_i|}
\min\big(\rho_{i,t} A_i,\; \operatorname{clip}(\rho_{i,t}, 1-\epsilon, 1+\epsilon) A_i\big)
+ \beta\,\mathrm{KL}.
$$

This already tells you what GRPO really is:

- **REINFORCE-style policy gradient** because it uses sampled returns;
- **PPO-style trust-region control** because it uses ratio clipping;
- **group-relative advantages** because it replaces a learned critic with within-prompt comparison.

That is why I think the cleanest description is:

> GRPO is a critic-free, group-baselined, PPO-style objective for sequence-level rewards.

## 3. Why original GRPO mattered so much

The attraction of GRPO was never that it was mathematically exotic. Its attraction was operational.

A PPO-style RLHF stack for LLMs often needs:

- a policy model;
- a reference model;
- a reward model or verifier;
- a critic or value model.

That critic is not free. It costs memory, compute, implementation complexity, and often additional instability. In verifiable-reward tasks, it can also feel like an awkward fit: the environment already tells you whether the sampled answer worked, so why spend extra budget estimating values?

GRPO removed that extra component while staying close to PPO's update style. That made it especially appealing for:

- mathematical reasoning;
- code generation with tests;
- symbolic or rule-based verification;
- post-training regimes where memory budget is tight.

This is the context in which `DeepSeekMath` introduced the method and showed it could work well in practice.[^deepseekmath]

## 4. The three axes that explain almost every GRPO variant

If you want a compact mental model, use these three axes.

### 3.1 Advantage normalization

How do we transform raw rewards into a usable advantage scale?

Common choices include:

- **group mean / group std**, as in the original GRPO framing;
- **group mean without std scaling**;
- **global or batch-level normalization**, as emphasized by REINFORCE++;
- **adaptive reward normalization**, as in BNPO-style approaches.

This matters because the normalization rule determines how much each prompt contributes to the global gradient. A local group standard deviation can make every prompt look equally scaled, even when some prompts are intrinsically much harder or much noisier than others.

### 3.2 Loss aggregation across different output lengths

Once a completion-level advantage is assigned, how should token losses be averaged?

There are at least three distinct choices:

- divide each completion by its own length \(|o_i|\);
- divide by the total number of active tokens in the local batch;
- divide by a fixed constant such as the configured max completion length.

These are not cosmetic differences. They change how long and short responses contribute to the update, which is why length bias became such a major theme in follow-up work.

### 3.3 Trust-region and sample-efficiency tricks

Most open implementations still keep PPO-style clipping, but the exact training recipe can also vary through:

- asymmetric clipping;
- masking of truncated completions;
- filtering of all-correct or all-wrong prompt groups;
- reward shaping for overlong generations.

This is where DAPO becomes more than a one-line objective tweak. It is really a training recipe for long-chain reasoning.

## 5. Original GRPO: elegant, useful, and more biased than it first appears

The original formulation deserves credit for making group-relative RL practical. It is simple, critic-free, and well matched to tasks where reward is easy to verify but hard to densify.

Still, three limitations quickly became visible.

### 4.1 Local standard-deviation scaling can distort inter-prompt weighting

The term

$$
A_i = \frac{r_i - \bar r}{\sigma_r}
$$

looks innocuous, but \(\sigma_r\) depends only on the sampled completions for the current prompt. That means prompts with very different reward dispersion can produce similarly scaled gradients. A later paper analyzing R1-Zero-like training argues that this introduces **question-level difficulty bias**.[^drgrpo]

The intuition is simple: if a prompt is hard and produces a tightly clustered reward set, dividing by a small within-group standard deviation can amplify its gradient. If another prompt is easy and produces more spread, its gradient can be relatively shrunk. Whether that is desirable is not obvious, and in many cases it is not.

### 4.2 Per-response length averaging creates length bias

The original GRPO loss divides each completion's summed token loss by \(|o_i|\). That means a 32-token answer and a 512-token answer are each normalized separately before being averaged at the group level.

This changes the effective weight of long versus short completions. Later analyses and trainer docs explicitly identify this as a **length bias** issue and motivate alternatives such as DAPO and Dr.GRPO.[^trl-docs]

### 4.3 Group-relative learning can go flat when all samples look the same

If every sampled completion for a prompt is wrong, or every sampled completion is correct, then the group provides very little ranking information. In the degenerate case, the centered reward signal nearly vanishes. Implementations then need some combination of epsilon handling, prompt filtering, or broader sampling policy to keep compute from being wasted.

That observation is one reason DAPO introduces dynamic sampling.

## 6. Dr.GRPO: remove the bias you do not actually want

The most useful way to think about `Dr.GRPO` is not as a totally different algorithm. It is better understood as a correction to two specific biases in the original GRPO objective.

### 5.1 First correction: do not blindly scale by group std

The analysis paper behind Dr.GRPO argues that group-standard-deviation scaling introduces undesirable prompt-dependent weighting.[^drgrpo] In practice, that leads to a very concrete recommendation seen in trainer docs as well: prefer turning off reward scaling when this bias is hurting you.

So instead of always insisting on

$$
A_i = \frac{r_i - \bar r}{\sigma_r},
$$

you may use a simpler centered reward signal,

$$
A_i = r_i - \bar r,
$$

possibly followed by a broader batch-level normalization step if your implementation supports it.

### 5.2 Second correction: stop normalizing each response by its own length

TRL documents the Dr.GRPO variant as

$$
\mathcal{L}_{\text{Dr.GRPO}} = -\frac{1}{L G} \sum_{i=1}^{G}\sum_{t=1}^{|o_i|} l_{i,t},
$$

where \(L\) is typically the configured maximum completion length.[^trl-docs]

This matters because the denominator no longer depends on each sampled response length. The objective is no longer quietly reweighting samples just because one output is longer than another.

So the clean summary is:

> Dr.GRPO removes two sources of bias that were easy to overlook in the original GRPO recipe: local std reward scaling and per-response length averaging.

That makes it a strong choice when you want something close to GRPO in spirit, but less distorted by normalization artifacts.

## 7. DAPO: not just a loss tweak, but a recipe for long-CoT RL

`DAPO` is important because it moves the discussion from isolated formula edits to a broader systems view of reasoning RL. The project page summarizes four core techniques:[^dapo]

- **Clip-Higher**;
- **Dynamic Sampling**;
- **Token-Level Policy Gradient Loss**;
- **Overlong Reward Shaping**.

The token-level loss is the easiest place to start. TRL documents DAPO as

$$
\mathcal{L}_{\text{DAPO}} = - \frac{1}{\sum_{i=1}^{G}|o_i|} \sum_{i=1}^{G}\sum_{t=1}^{|o_i|} l_{i,t}.
$$

This changes the denominator from per-sequence averaging to the total count of active completion tokens in the batch.[^trl-docs]

### 6.1 Why token-level normalization helps

With per-response averaging, a very long response is first compressed to a per-token average before being mixed with short responses. With DAPO-style aggregation, the denominator is the total number of active tokens across the sampled completions. That makes the optimization much closer to a true token-level objective and reduces one major source of length-dependent distortion.

It is worth being precise here. The TRL docs say DAPO **reduces** length bias, while Dr.GRPO goes further by eliminating response-length-dependent normalization through a constant denominator.[^trl-docs] So if you want the short version:

- `GRPO`: biased by per-response averaging;
- `DAPO`: much better for long outputs, but still denominator-dependent on active tokens;
- `Dr.GRPO`: pushes even harder toward length-unbiased scaling.

### 6.2 Why dynamic sampling is not a detail

Dynamic sampling addresses a very practical waste pattern. If a prompt group produces:

- all successes, or
- all failures,

then the within-group ranking signal is weak or useless. DAPO's answer is not to pretend those groups are helpful. Its answer is to spend more training effort on prompts where the model is uncertain enough for relative comparison to matter.

That is an engineering decision, but it is a good one. Compute spent on uninformative groups is real compute.

### 6.3 Why overlong reward shaping exists

Long-chain reasoning training often runs into truncation, over-generation, or pathological verbosity. If the training system silently clips or masks those cases, optimization noise can become substantial. DAPO treats this as a first-class systems problem rather than a corner case.

In other words, DAPO is not only asking, "What is the right objective?" It is also asking, "What are the right samples to learn from, and how should we prevent pathological long outputs from contaminating the signal?"

That is why DAPO often looks more attractive than original GRPO for long-CoT runs, even when the mathematical core is still recognizably from the same family.

## 8. BNPO: adaptive reward normalization, and an acronym you should treat carefully

The BNPO paper proposes **Beta Normalization Policy Optimization**, motivated by the fact that binary or bounded rewards are common in verifiable-reward training.[^bnpo-paper] Instead of treating normalization as a static afterthought, the paper models reward normalization adaptively with a Beta distribution.

The important idea is not the Beta distribution by itself. The important idea is that **normalization is part of the algorithm**, not just a harmless preprocessing step.

Why can this matter?

- Binary rewards are common in correctness-based reasoning tasks.
- Their distribution changes as policy quality improves.
- Fixed or local normalization rules may become poorly calibrated over training.

BNPO's contribution is to turn that observation into a principled normalization mechanism.

### 7.1 A practical naming warning

Library code can overload acronyms. In the current Hugging Face TRL docs, `loss_type="bnpo"` is described as normalizing by the number of active tokens in the local batch.[^trl-docs] That implementation detail is narrower than the broader statistical framing of the BNPO paper.

So if you see `bnpo` in code, do not assume the paper and the trainer option are identical. Read the trainer docs and the paper separately.

## 9. REINFORCE++, REINFORCE++-baseline, and RLOO belong in the same conversation

Even if they are not always marketed as "GRPO variants," they are clearly adjacent critic-free baselines and should be compared on the same whiteboard.

### 8.1 REINFORCE++

The `REINFORCE++` paper argues that you can keep the good parts of PPO-style RL for LLMs without carrying around a critic, and that **global advantage normalization** is often a better idea than purely prompt-local normalization.[^reinforcepp]

This is a crucial conceptual move. It says the right comparison is not necessarily

- local group mean and local group std,

but maybe

- centered rewards or baselines at the prompt level,
- followed by more global normalization at the batch level.

That shifts the algorithm away from the "every prompt lives in its own tiny statistical universe" feeling that original GRPO sometimes has.

### 8.2 REINFORCE++-baseline

In reasoning settings, a practical version uses same-prompt multi-sample baselines while still relying on broader normalization and simple critic-free updates. This makes it close enough to GRPO to be comparable, but different enough that it often behaves more stably.

### 8.3 RLOO

`RLOO` uses a leave-one-out baseline: for each sampled completion, the baseline is the average reward of the *other* completions from the same prompt.[^openrlhf]

That gives you another way to exploit same-prompt multi-sampling without inheriting every choice made by original GRPO. In practice, RLOO is attractive because it is simple, critic-free, and often easier to reason about than a heavily modified GRPO stack.

## 10. Newer trainer-level variants you will see in libraries

At this point the ecosystem has moved beyond only `grpo`, `dapo`, and `dr_grpo`. The current TRL docs also expose additional loss types such as `sapo`, `cispo`, and `luspo`.[^trl-docs]

You do not need to memorize all of them to make progress, but it helps to understand why they exist.

- `SAPO` softens the clip gate instead of using PPO's hard `min` operator. The goal is smoother gradients near the clipping boundary.
- `CISPO` clips the *importance weights* directly rather than the advantage-scaled surrogate. That can make the trust-region behavior easier to interpret.
- `LUSPO` is documented as a length-unbiased variant motivated by the same family of concerns that led to DAPO and Dr.GRPO.

The broader lesson is that the field is converging on a small number of recurring questions:

- how local should normalization be;
- how length-unbiased should token aggregation be;
- how sharp or soft should the trust region be.

## 11. A compact comparison table

| Method | Baseline idea | Normalization emphasis | Loss denominator | Extra mechanism | Best use case |
| --- | --- | --- | --- | --- | --- |
| PPO | learned critic | critic-estimated advantage | token-level PPO objective | mature trust region | when you can afford a critic and want a classic baseline |
| GRPO | same-prompt group mean/std | local group normalization | per-response length average | PPO clipping | simple critic-free baseline for verifiable reward |
| Dr.GRPO | same-prompt centered reward | reduce prompt-local scaling bias | fixed constant \(L G\) | less biased normalization | when length bias and prompt-difficulty bias are obvious |
| DAPO | same-prompt relative reward | token-level aggregation | active tokens in batch | dynamic sampling, overlong shaping, clip tuning | long-CoT reasoning at scale |
| BNPO | adaptive reward model | adaptive normalization for changing reward distributions | implementation-dependent | Beta-distribution normalization | binary or bounded rewards with unstable scaling |
| REINFORCE++ | critic-free baseline with global normalization | batch/global normalization | simpler policy-gradient form | low-complexity stable baseline | when you want a strong non-GRPO critic-free baseline |
| RLOO | leave-one-out same-prompt baseline | prompt-level baseline, often with broader batch treatment | implementation-dependent | LOO baseline | simple multi-sample critic-free training |

## 12. How I would choose in practice

If I had to make a practical selection rule, it would be this.

### 12.1 If you want the canonical historical baseline

Choose **original GRPO**.

Use it when:

- you want the closest thing to the early DeepSeekMath framing;
- your rewards are verifiable and reasonably clean;
- you need a simple reference point before trying more ambitious recipes.

### 12.2 If your main complaint is length bias

Choose **Dr.GRPO** first.

Use it when:

- completions vary widely in length;
- you do not want response length to silently change gradient scale;
- you still want to stay close to the GRPO family.

### 12.3 If you are training long-chain reasoning at scale

Choose **DAPO**.

Use it when:

- outputs are long and truncation is a real problem;
- many sampled prompt groups are uninformative;
- you need a complete training recipe, not just a loss formula.

### 12.4 If you suspect normalization itself is the bottleneck

Investigate **BNPO-style** approaches.

Use them when:

- rewards are binary or bounded;
- reward distributions drift during training;
- the run is unstable in ways that clipping alone does not explain.

### 12.5 If you just want a strong, clean critic-free baseline

Try **REINFORCE++** or **RLOO** as well.

Use them when:

- you are not doctrinally attached to GRPO;
- you care more about stability and simplicity than lineage;
- you want to test whether prompt-local standardization is helping or hurting.

## 13. What these choices look like in code

Many "new algorithms" collapse to a few trainer knobs once you look at the implementation layer.

In TRL, the main knobs are things like:

- `loss_type`;
- reward scaling mode;
- clipping coefficient;
- whether truncated completions are masked;
- KL coefficient.

A minimal example looks like this:

```python
from trl import GRPOConfig

config = GRPOConfig(
    loss_type="dr_grpo",      # or "grpo", "dapo", "bnpo", "sapo", ...
    scale_rewards="none",     # or "group"
    beta=0.0,                  # KL coefficient
    mask_truncated_completions=True,
)
```

That means the right question is usually not "Which acronym won this month?" The right question is:

> Which part of the training signal do I actually distrust: the baseline, the normalization, the length handling, or the trust region?

If you cannot answer that question, you are probably not ready to choose among GRPO variants yet.

## 14. The most important takeaway

The GRPO line is best understood as a continuing attempt to repair three recurring weaknesses in critic-free LLM RL:

- **advantage scaling that is too local**;
- **loss aggregation that is too length-sensitive**;
- **update rules that are too brittle for long reasoning traces**.

That is why the family keeps splitting.

- `Dr.GRPO` mainly repairs bias.
- `DAPO` mainly repairs long-CoT training behavior.
- `BNPO` mainly repairs normalization statistics.
- `REINFORCE++` and `RLOO` remind us that the best baseline may not be GRPO at all.

So the mature way to read this literature is not to memorize names. It is to ask, each time:

1. What is the baseline?
2. What is the normalization rule?
3. What is the denominator of the token loss?
4. What happens when all samples for a prompt are equally bad or equally good?
5. What happens when completions are very long?

If a paper does not answer those questions clearly, the name of the algorithm is not the important part.

## References

- Zhihu discussion link provided by the user: https://www.zhihu.com/question/1893241692582285916/answer/1967273400784369077?share_code=1dAHMmQRoziaq&utm_psn=2017241955441070975
- Proximal Policy Optimization Algorithms: https://arxiv.org/abs/1707.06347
- Direct Preference Optimization: Your Language Model is Secretly a Reward Model: https://arxiv.org/abs/2305.18290
- Hugging Face TRL GRPO Trainer docs: https://huggingface.co/docs/trl/grpo_trainer
- DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models: https://arxiv.org/abs/2402.03300
- DAPO: An Open-Source LLM Reinforcement Learning System at Scale: https://arxiv.org/abs/2503.14476
- Understanding R1-Zero-Like Training: A Critical Perspective: https://arxiv.org/abs/2503.20783
- REINFORCE++: A Simple and Efficient Approach for Aligning Large Language Models: https://arxiv.org/abs/2501.03262
- BNPO: Beta Normalization Policy Optimization for Binary-Valued Reward-based LLM Reasoning: https://arxiv.org/abs/2506.02864
- OpenRLHF repository and docs: https://github.com/OpenRLHF/OpenRLHF

[^deepseekmath]: Shao et al., *DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models*.
[^trl-docs]: Hugging Face TRL documentation for `GRPOTrainer` and the documented `loss_type` variants.
[^drgrpo]: *Understanding R1-Zero-Like Training: A Critical Perspective*.
[^dapo]: DAPO project page and paper summary by the authors.
[^bnpo-paper]: *BNPO: Beta Normalization Policy Optimization for Binary-Valued Reward-based LLM Reasoning*.
[^reinforcepp]: *REINFORCE++: A Simple and Efficient Approach for Aligning Large Language Models*.
[^openrlhf]: OpenRLHF repository documentation describing RLOO-style trainer support.

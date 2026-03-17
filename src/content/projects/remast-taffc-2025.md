---
title: REMAST Real-time Emotion-based Music Arrangement with Soft Transition
description: IEEE Transactions on Affective Computing (IEEE TAFFC), 2025
publishDate: 'Apr 1 2025'
isFeatured: true
seo:
  image:
    src: 'project-7.jpg'
---
![REMAST overview](/papers/project-7.jpg)

**Authors:** Zihao Wang, Le Ma, Chen Zhang, Bo Han, Yikai Wang, Xinyi Chen, Haorong Hong, Wenbo Liu, Xinda Wu, Kejun Zhang

**Paper Link:** [IEEE Xplore (Document 10734159)](https://ieeexplore.ieee.org/document/10734159)

## Problem Setting

Emotion-conditioned accompaniment in real time is difficult because systems must handle two competing requirements:

- **instantaneous emotion fit**: music at time `t` should match the target emotion immediately;
- **temporal continuity**: emotion should evolve smoothly instead of jumping between disconnected states.

In practical applications (games, music therapy, interactive creation), poor transition quality can degrade user experience even when frame-level emotion prediction is accurate.

## REMAST Architecture

REMAST introduces a real-time emotion arrangement framework with three components.

1. **Emotion fusion module**
   - estimates emotion from previous generated music;
   - fuses historical emotion with current target emotion;
   - stabilizes transitions across adjacent timesteps.

2. **Flexible melody downsampling**
   - controls temporal granularity of melody conditioning;
   - provides a knob to balance faithfulness vs responsiveness.

3. **Domain-informed representation and training**
   - injects music-theory features to strengthen affective representation;
   - leverages semi-supervised learning to reduce annotation subjectivity.

## Evaluation Design

The paper reports both objective and subjective evaluations against prior baselines.

- **Objective side**: quantitative indicators of emotion fit and structural consistency.
- **Subjective side**: listening studies for smoothness, coherence, and overall musical quality.

## Main Results

- REMAST consistently improves emotion alignment under real-time constraints.
- Transition smoothness is significantly better than non-fusion baselines.
- Overall generation quality improves without sacrificing responsiveness.

## Why This Matters

REMAST is a practical step toward controllable affective music generation in interactive systems, especially where user-facing temporal smoothness is as important as pointwise emotion accuracy.

## Publication

- Journal: *IEEE Transactions on Affective Computing*
- Year: 2025
- Volume/Issue: 16(2)
- Pages: 1016-1030
- DOI: 10.1109/TAFFC.2024.3486224

---
title: Risk Profiling and Modulation for LLMs
description: arXiv preprint (arXiv), 2025
publishDate: 'Sep 30 2025'
isFeatured: true
---

**Authors:** Yikai Wang, Xiaocheng Li, Guanting Chen

**Paper:** [arXiv:2509.23058v3](https://arxiv.org/abs/2509.23058v3)

## Key Figures

![Figure 1. Problem setup and risk evaluation interface](/papers/risk-profiling-fig1.jpg)

![Figure 2. Comparative modeling and optimization results](/papers/risk-profiling-fig2.jpg)

![Figure 3. Transfer behavior across evaluation settings](/papers/risk-profiling-fig3.jpg)

## Motivation

Accuracy-only evaluation is not enough when LLM outputs drive downstream decisions under uncertainty. In many real deployments, we need an explicit and controllable risk posture:

- conservative when failure cost is high;
- neutral when balanced exploration is needed;
- risk-seeking only in low-cost/high-upside scenarios.

This paper studies both measurement and control of that posture in a unified framework.

## Problem Formulation

The model is treated as a utility-based decision-maker.

- **Risk profiling** estimates the model's implicit utility/risk parameters from controlled choice tasks.
- **Risk modulation** optimizes model behavior toward a target utility profile.

This turns qualitative statements ("the model seems conservative") into quantitative and comparable parameters.

## Methodology

### 1) Risk Profiling

- Build behavioral tests, including lottery-style decision tasks and standardized risk preference instruments.
- Fit utility-theoretic models with Bayesian inference.
- Compare profiles across training regimes (pretraining-only, instruction-tuned, and preference-aligned).

### 2) Risk Modulation

- Evaluate prompt-only and in-context control strategies.
- Evaluate post-training methods (including SFT and DPO-style alignment).
- Measure both in-domain fit and cross-task transfer of induced risk behavior.

## Experimental Findings

- Instruction-tuned models are typically better described by stable utility profiles than pretraining-only or RLHF-only counterparts.
- Prompt/in-context controls can shift behavior but often lack stability and transfer.
- Post-training alignment gives the strongest and most reproducible risk modulation.
- Behavior shifts generalize across evaluation instruments, suggesting real preference transfer rather than benchmark overfitting.

## Practical Implications

The framework provides an operational path to **risk-aware LLM deployment** in domains such as finance, healthcare, and policy analysis, where controllable decision behavior is as important as raw predictive quality.

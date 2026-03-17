---
title: Why Agentic Design is Necessary for Data Analytics
publishDate: 'Jan 11 2026'
isFeatured: true
---

**Authors:** Yikai Wang

## Key Figures

![Figure 1. Agentic vs standalone inference framing](/papers/agentic-design-fig1.jpg)

![Figure 2. Multi-step analytics decomposition and pipeline structure](/papers/agentic-design-fig2.jpg)

![Figure 3. Empirical behavior comparison across settings](/papers/agentic-design-fig3.jpg)

## Overview

This work analyzes why **standalone LLM inference** is structurally insufficient for robust multi-task data analytics, and why agentic design is required in practice.

- *Standalone inference*: direct prompting without explicit planning/tool loop.
- *Agentic inference*: planning, decomposition, tool use, and iterative verification during inference.

## Core Question

Can pretraining + post-training alone (including SFT/RLHF) close the capability gap for multi-step analytical workflows without adding agentic mechanisms?

The paper's conclusion is that this is generally unlikely in realistic quantitative settings.

## Technical Argument

Data analytics tasks often require:

- compositional reasoning across many substeps;
- mixed symbolic/numeric operations;
- external tool invocation and result checking;
- adaptive branching based on intermediate outputs.

Standalone prompting lacks explicit control flow for these requirements, which leads to brittle behavior and poor recovery from intermediate errors.

## Theory and Evidence

- The paper provides a formal lens on the representational and procedural limits of standalone inference pipelines.
- It argues that removing these limits purely via post-training is hard; meaningful gains would require substantial changes at pretraining time.
- Empirical analyses show repeatable failure modes in multi-step, multi-task analytical settings and better behavior under agentic pipelines.

## Practical Implications

For production-grade analytics assistants, system design should prioritize agentic orchestration (planning + tools + validation) rather than relying on single-shot prompting alone.

This provides concrete guidance for building reliable LLM-based data analysis systems.

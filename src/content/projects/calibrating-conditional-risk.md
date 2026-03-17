---
title: Calibrating Conditional Risk
publishDate: 'Jan 10 2026'
isFeatured: true
---

**Authors:** Yikai Wang

## Key Figures

![Figure 1. Overview figure from the manuscript](/papers/conditional-risk-fig1.jpg)

![Figure 2. Empirical calibration/estimation comparison](/papers/conditional-risk-fig2.jpg)

![Figure 3. Additional evaluation results on conditional risk behavior](/papers/conditional-risk-fig3.jpg)

## Overview

This project studies **conditional risk calibration**: estimating expected loss conditioned on features, rather than only reporting global uncertainty.

In decision systems, the operational question is usually instance-specific: "How likely is this prediction to be wrong for this particular input?" Conditional risk directly targets that question.

## Formal Goal

For input `x`, estimate conditional predictive risk:

- expected task loss given `x`;
- calibration quality at the individual (or subgroup) level.

This differs from aggregate calibration metrics, which may look good globally while hiding local reliability failures.

## Main Contributions

### 1) Problem formalization

- Define conditional risk calibration as an explicit machine learning objective.
- Separate it conceptually from standard global uncertainty estimation.

### 2) Theoretical analysis

- Show the calibration task can be reformulated as a regression problem in both classification and regression settings.
- Establish links between probability calibration and conditional risk quality in classification.
- Characterize settings where improvements in probability calibration do or do not transfer to conditional risk.

### 3) Empirical validation

- Validate the theoretical claims across multiple task/model settings.
- Provide qualitative and quantitative analyses of estimator behavior.
- Demonstrate downstream value in defer/escalate-style decision pipelines.

## Why This Matters

Conditional risk calibration is a core component for reliable uncertainty-aware decision systems. This work provides a principled base for moving from coarse global confidence scores to actionable input-level reliability estimates.

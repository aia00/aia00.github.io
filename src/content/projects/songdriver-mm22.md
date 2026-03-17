---
title: SongDriver Real-time Music Accompaniment Generation without Logical Latency nor Exposure Bias
description: Proceedings of the 30th ACM International Conference on Multimedia (ACM MM), 2022
publishDate: 'Oct 13 2022'
isFeatured: true
seo:
  image:
    src: 'project-1.jpg'
---
![SongDriver overview](/papers/project-1.jpg)

**Authors:** Zihao Wang, Kejun Zhang, Yuxing Wang, Chen Zhang, Qihao Liang, Pengfei Yu, Yongsheng Feng, Wenbo Liu, Yikai Wang, Yuntao Bao, Yiheng Yang

**Paper Link:** [ACM DOI: 10.1145/3503161.3548368](https://dl.acm.org/doi/10.1145/3503161.3548368)

## Problem Setting

Real-time accompaniment generation needs to satisfy two constraints simultaneously:

- **musical quality**: generated harmony and texture should be coherent with melody and style;
- **system responsiveness**: accompaniment must arrive in time for live interaction.

Most prior systems struggle with the trade-off between these goals. Autoregressive generation can improve local consistency but often causes delay and error accumulation (exposure bias) in long streams.

## SongDriver Pipeline

SongDriver is designed as a two-stage real-time pipeline.

1. **Arrangement stage (Transformer-based)**
   - receives incoming melody segments;
   - predicts chordal and structural arrangement information;
   - caches arrangement states for downstream generation.

2. **Prediction stage (CRF-based)**
   - converts cached arrangement signals into playable multi-track accompaniment;
   - avoids dependence on unstable self-generated history;
   - reduces long-horizon drift compared with purely autoregressive decoding.

The key idea is to decouple arrangement planning from final note realization, so the system can remain low-latency while preserving global musical logic.

## Why the Method Improves Real-Time Performance

- **Zero logical latency objective**: generation is aligned to the online setting rather than offline full-sequence assumptions.
- **Reduced exposure bias**: CRF conditioning on cached structure mitigates compounding autoregressive errors.
- **Long-term musical context**: extra long-term features are injected to recover structure beyond local windows.

## Experimental Evaluation

The paper evaluates SongDriver on open-source data and the introduced aiMusic dataset, with both objective and subjective protocols.

- **Objective evaluation** measures arrangement quality and timing behavior.
- **Subjective evaluation** measures perceived musicality, coherence, and usability in interactive scenarios.

## Main Findings

- SongDriver improves both quality and responsiveness compared with previous real-time baselines.
- Physical latency is reduced while maintaining better musical consistency.
- Human evaluation favors SongDriver in overall accompaniment quality and interaction smoothness.

## Practical Value

SongDriver provides a deployable architecture for interactive music systems, including live accompaniment assistants, educational software, and rehearsal tools where strict timing is critical.

## Publication

- Conference: *Proceedings of the 30th ACM International Conference on Multimedia (MM '22)*
- Pages: 1057-1067
- DOI: 10.1145/3503161.3548368

---
title: An Auxiliary Device for Music Composition
description: Chinese invention patent (CN114724534B), granted, 2025
publishDate: '2025-11-21'
isFeatured: false
seo:
  title: "An Auxiliary Device for Music Composition"
  description: Chinese invention patent CN114724534B on Transformer-guided chord generation for music composition assistance.
---

**Patent:** CN114724534B

**Status:** Granted Chinese invention patent

**Publication date:** November 21, 2025

**Application number:** CN202210348788.X

**Filing date:** April 1, 2022

**Applicant:** Zihao Wang

**Agency:** Hangzhou Tianqin Intellectual Property Agency Co., Ltd.

**IPC:** G10H1/00

**Inventors:** Zihao Wang, Wenbo Liu, Yikai Wang, Yuxing Wang, Jiaqi Wang, Yuntai Bao, Qihao Liang, Kuai Yu, Shengxuan Chen, Yongsheng Feng, Jing Xue, Xuhong Wang, Donglai Wei, Ruoxi Ning, Yuguo Wang, Yanan Ji

## Overview

This patent describes a music composition assistance device for automatic chord generation from an input melody. The core idea is to extract high-level musical features from the melody, encode those features into guidance vectors, and then use a Transformer-style encoder-decoder architecture to generate harmonically appropriate chords.

The system is designed around the observation that raw note sequences alone do not fully expose the structural cues needed for musically coherent accompaniment. Instead, it first derives a more structured representation of the melody and then conditions chord generation on that representation.

## Technical Idea

According to the patent abstract, the device contains three main modules.

### 1. Feature extraction module

This module extracts high-level musical signals from the input melody. The abstract explicitly mentions four kinds of features:

- weighted notes;
- weighted chords;
- cadential chords;
- structural chords.

These features are meant to summarize musical emphasis and phrase-level structure, rather than treating the melody only as a flat token stream.

### 2. Feature encoding and concatenation module

The second module converts the extracted musical features into encoded vectors. In particular, it forms:

- an **encoder guidance vector** from the current note, weighted note, and weighted chord;
- a **decoder guidance vector** from the previous beat's chord, the cadential chord, and the structural chord.

This design separates the information used to represent the current melodic context from the information used to guide harmonic decoding.

### 3. Chord generation module

The final module feeds the encoder guidance vector into the Transformer's encoder and the decoder guidance vector into the Transformer's decoder, then performs forward computation to generate chords.

At a high level, the generation pipeline can be summarized as

$$
z_t = \operatorname{Transformer}_\theta(e_t, d_t),
$$

where \(e_t\) is the encoded melodic guidance signal and \(d_t\) is the harmonic guidance signal carried into the decoder.

The architectural point is straightforward: the model is not asked to infer harmony from raw melody alone. It is explicitly guided by musically structured features that encode emphasis, cadence, and harmonic backbone.

## Why It Matters

The patent targets a practical music-creation problem: improving both the **quality** and **accuracy** of machine-assisted harmony generation. For composition assistance, chord generation must do more than produce locally acceptable transitions. It should also respect phrase structure, cadential movement, and the broader harmonic role of each segment in the melody.

What makes this patent technically meaningful is that it combines:

- symbolic music feature engineering;
- explicit harmonic guidance;
- Transformer-based sequence modeling.

That combination makes it closely aligned with a broader line of work on controllable music accompaniment and arrangement, where long-range musical structure matters as much as short-range prediction quality.

## Patent Abstract in Plain Terms

In plain language, the patented device takes a melody, extracts musically meaningful clues about emphasis and structure, turns those clues into model inputs, and then generates chords with a Transformer-based architecture. The intended benefit is more musically coherent and accurate harmonic support during composition.

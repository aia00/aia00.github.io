---
title: "Gene-Expression Modules, PAM50, and Breast Cancer Pathology"
excerpt: A breast-cancer-focused introduction to gene-expression modules, showing how luminal, proliferation, HER2, basal, immune, and stromal programs relate to PAM50 subtypes, H&E morphology, and IHC.
publishDate: '2026-03-17T15:00:00-04:00'
isFeatured: false
tags:
  - Breast Cancer
  - Pathology
  - Gene Expression
  - Computational Pathology
seo:
  title: "Gene-Expression Modules, PAM50, and Breast Cancer Pathology"
  description: Learn how gene-expression modules in breast cancer relate to PAM50 subtypes, H&E morphology, ER IHC, and clinical interpretation.
  image:
    src: '/blog/gene-expression-modules-pathology.svg'
    alt: Diagram of breast cancer gene-expression modules and their links to PAM50 and pathology
---

When people in breast cancer research talk about **modules**, they usually mean **coordinated gene-expression programs**: combinations or groups of genes that tend to move together across samples, not software blocks and not generic pipeline stages.

That is an important distinction because a breast tumor is not described well by one gene at a time. What usually matters is a *pattern*:

- a **luminal / ER-associated** program,
- a **proliferation** program,
- a **HER2-related** program,
- a **basal-like** program,
- and often additional **immune** or **stromal** programs.

Those programs are often more informative than any single marker because they tell you what biological state the tumor is occupying.

This is also why modules are a useful bridge between:

- **RNA measurements**,
- **PAM50 subtype calls**,
- **ER / PR / HER2 IHC**,
- and **morphology on H&E**.

![Breast cancer gene-expression modules and pathology phenotypes](/blog/gene-expression-modules-pathology.svg)

*Figure 1. In breast cancer, modules are best thought of as continuous biological programs whose combinations help explain PAM50 subtype tendencies, morphology, and treatment-relevant phenotype.*

## 1. What a gene-expression module actually is

Suppose we start with a gene-expression matrix

$$
X \in \mathbb{R}^{n \times p},
$$

where rows are tumor samples and columns are genes. A module is a subset of genes

$$
M_k \subseteq \{1,2,\dots,p\}
$$

whose expression tends to move together across samples.

In practice, that usually means the genes in the module are responding to a shared biological process:

- hormone-response signaling,
- cell-cycle activity,
- HER2 pathway activation,
- basal or de-differentiated lineage state,
- immune infiltration,
- stromal remodeling.

This is why modules are often easier to interpret than single genes. A single gene may be noisy or context-dependent. A coordinated group of genes is more likely to reflect a real program.

## 2. Why modules are especially useful in breast cancer

Breast cancer biology is already organized around overlapping programs rather than one-dimensional labels.

For example:

- many **ER-positive** tumors have a strong luminal program,
- but some ER-positive tumors also have a high proliferation program,
- some tumors have strong **HER2-enriched** biology even when their routine pathology picture is not trivial,
- and immune or stromal programs can strongly shape prognosis and treatment response without being identical to the tumor-cell intrinsic state.

This is exactly where modules help. They let you represent the tumor as a combination of biological axes instead of forcing it into a single box too early.

## 3. Modules are not the same as PAM50, but they help explain it

The relationship between modules and PAM50 is important to get right.

| Concept | What it is | Breast-cancer example |
| --- | --- | --- |
| single gene | one measured feature | `ESR1`, `ERBB2`, `MKI67` |
| module | a coordinated biological program | luminal, proliferation, HER2, basal, immune |
| subtype | a broader intrinsic category | Luminal A, Luminal B, HER2-enriched, Basal-like |
| classifier | a rule that maps expression patterns to labels | PAM50 |

PAM50 is **not** itself one module. It is a classifier built from a curated gene set that helps assign tumors to intrinsic subtypes. But those subtypes make more sense if you think of them as different **combinations of module strength**.

A useful mental model is:

- **Luminal A**: high luminal program, relatively low proliferation
- **Luminal B**: luminal program still present, but proliferation is higher
- **HER2-enriched**: strong HER2-related and proliferative biology, with variable ER context
- **Basal-like**: strong basal / de-differentiated program, often high proliferation, little luminal signal

That is not the full PAM50 algorithm, but it is close to the biological intuition that pathologists and computational modelers need.

## 4. How modules are built in practice

There are several common routes.

### 4.1 Co-expression modules

The classical approach is to look for genes that correlate across samples:

1. compute gene-gene correlation,
2. build a similarity structure,
3. cluster genes that move together,
4. interpret each cluster as a program.

This is the general logic behind co-expression methods such as **WGCNA**.

### 4.2 Curated modules

Sometimes the module is built from prior biology rather than discovered de novo. In breast cancer that may include:

- estrogen-response genes,
- ERBB2-related genes,
- cell-cycle genes,
- basal cytokeratin-associated genes,
- immune-response genes.

These are often easier to compare across datasets because their biological meaning is specified in advance.

### 4.3 Latent-factor approaches

Modules can also be learned through factorization. A simple way to express this is

$$
X \approx WH,
$$

where the latent factors in $H$ represent gene programs and the sample-specific weights in $W$ tell you how much each tumor expresses each program.

That viewpoint is useful in breast cancer because many tumors are mixtures of several active processes, not clean members of one single state.

## 5. How a module becomes a sample-level score

Once a module is defined, you usually summarize it with one number per sample.

A common option is the **module eigengene**, roughly the first principal component of the module genes:

$$
e_k = \mathrm{PC1}(X_{M_k}).
$$

Another is a weighted score:

$$
s_k = \sum_{j \in M_k} w_j x_j.
$$

These module scores are useful because they can be:

- correlated with PAM50 subtypes,
- associated with survival or recurrence,
- fused with H&E image features,
- or predicted from multimodal pathology inputs.

## 6. The breast cancer modules that matter most

### 6.1 Luminal / ER module

This module captures hormone-response and luminal epithelial identity. It is the program most naturally associated with ER-positive disease.

Typical interpretation:

- stronger estrogen-response biology,
- more differentiated epithelial state,
- closer alignment with luminal intrinsic subtypes.

In pathology terms, this often coexists with more organized epithelial morphology, though the RNA-to-image mapping is never perfect.

### 6.2 Proliferation module

This module reflects cell-cycle activity, DNA replication, and mitotic drive. It is one of the most clinically important continuous axes in breast cancer.

Typical interpretation:

- faster tumor growth,
- higher grade biology,
- more aggressive behavior if not offset by favorable signals.

This is one of the main reasons **Luminal A** and **Luminal B** differ. Both may be luminal, but the proliferation program is generally stronger in Luminal B.

### 6.3 HER2-related module

This module reflects ERBB2/HER2-associated signaling and related transcriptional activity.

Typical interpretation:

- activation of HER2-driven biology,
- overlap with HER2-enriched intrinsic state,
- but not perfect equivalence to clinical HER2 positivity by IHC/FISH.

That distinction matters. A tumor may show HER2-related transcriptional behavior that is informative even when the mapping to routine clinical HER2 categorization is not one-to-one.

### 6.4 Basal-like module

This module reflects a less differentiated, more basal epithelial state and often travels with high proliferation.

Typical interpretation:

- more aggressive phenotype,
- less luminal differentiation,
- frequent overlap with triple-negative biology.

This is often the program most associated with Basal-like PAM50 calls.

### 6.5 Immune module

This module reflects lymphocyte presence, interferon signaling, antigen presentation, and related immune activity.

Typical interpretation:

- stronger immune infiltration,
- inflamed microenvironment,
- potentially important treatment context, especially in more immune-active disease.

In slide terms, this may correspond to TIL-rich regions or broader immune-rich stroma, but it is not reducible to one visual cue.

### 6.6 Stromal module

This module reflects extracellular matrix, fibroblasts, and microenvironmental remodeling.

Typical interpretation:

- desmoplasia,
- stromal abundance,
- microenvironment-driven variation in bulk RNA.

This is particularly important because a stromal module may partly reflect *who is present in the specimen* rather than only what the tumor cells are doing.

## 7. A breast-cancer-focused summary table

| Module | What it usually means | How it often connects to breast cancer |
| --- | --- | --- |
| Luminal / ER | hormone response and epithelial differentiation | stronger ER-positive, luminal biology |
| Proliferation | cell-cycle activity and growth | helps separate lower-risk luminal from higher-risk luminal disease |
| HER2-related | ERBB2-associated signaling | overlaps with HER2-enriched biology |
| Basal-like | de-differentiated epithelial state | overlaps with basal / often triple-negative patterns |
| Immune | lymphocyte and inflammatory activity | reflects tumor-immune microenvironment |
| Stromal | fibroblast and matrix programs | reflects desmoplasia and specimen composition |

## 8. How these modules help explain PAM50

A useful way to understand PAM50 is not as magic, but as a structured readout of how several programs combine.

### Luminal A

Think:

- high luminal / ER signal,
- relatively low proliferation,
- usually more differentiated biology.

### Luminal B

Think:

- luminal program still present,
- but proliferation pushed upward,
- often higher-risk behavior than Luminal A.

### HER2-enriched

Think:

- stronger HER2-related program,
- often strong proliferative component,
- variable relation to ER context.

### Basal-like

Think:

- strong basal / de-differentiated program,
- often high proliferation,
- usually weak luminal signal.

This framing is valuable because it explains why two tumors may both be ER positive yet still land in very different biological neighborhoods. One may have a strong luminal signal with modest proliferation; the other may have enough proliferative or HER2-related activity to shift its intrinsic classification and risk profile.

## 9. Why this matters for H&E and IHC

This is where pathology becomes truly multimodal.

- **H&E** gives morphology, architecture, grade, stromal context, and immune context.
- **IHC** gives targeted protein readouts such as ER, PR, HER2, or Ki-67.
- **RNA modules** summarize broader biological programs.

These measurements are related but not identical.

Examples:

- a strong **luminal module** often aligns with ER-related biology and more differentiated appearance;
- a strong **proliferation module** may align with high-grade morphology and often with higher Ki-67;
- an **immune module** may correspond to TIL-rich tissue regions;
- a **stromal module** may reflect desmoplastic or fibroblast-rich tissue architecture.

But none of these correspondences is exact. That is why module-based targets are interesting for computational pathology: they are richer than single biomarkers, yet still interpretable enough to connect back to tissue phenotype.

## 10. The biggest caveat: module scores can reflect composition as well as biology

This is the main place where over-interpretation happens.

A module score can reflect true pathway activity, but it can also reflect:

- tumor purity,
- cell-type mixture,
- stromal abundance,
- immune infiltration,
- batch effects,
- or site-specific assay differences.

In breast cancer, this matters a lot.

For example:

- a high immune module may partly mean the tumor is more inflamed,
- but it may also mean the sampled region simply contains more immune cells;
- a high stromal module may reflect true microenvironmental remodeling,
- but it may also reflect the tissue composition of the profiled specimen.

So modules are best interpreted as biologically meaningful but not automatically tumor-intrinsic.

## 11. Why module thinking is useful for your kind of work

If you are doing computational pathology around ER status, PAM50, H&E, or ER IHC, module thinking is often more informative than flat label thinking.

Instead of asking only:

- can the model predict ER positive vs ER negative?
- can the model classify PAM50 subtype?

you can also ask:

- can the image recover a luminal program score?
- can morphology distinguish high-proliferation luminal tumors from low-proliferation luminal tumors?
- does ER IHC improve alignment with luminal / receptor-related modules?
- do immune and stromal modules explain residual errors in subtype prediction?

That line of reasoning is often closer to real biology than a single hard classification target.

## 12. The main takeaway

In breast cancer pathology, **gene-expression modules** are best understood as **continuous biological programs** such as luminal, proliferation, HER2-related, basal-like, immune, and stromal activity.

They are useful because they:

- explain why tumors with similar routine biomarkers can still behave differently,
- provide intuition for PAM50 subtype tendencies,
- connect RNA to H&E and IHC,
- and give multimodal pathology models richer, more interpretable targets.

If you think in terms of modules, PAM50 stops looking like a black-box labeler and starts looking like what it really is: a structured readout of several interacting biological programs inside the tumor.

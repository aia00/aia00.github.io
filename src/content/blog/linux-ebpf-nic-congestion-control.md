---
title: "Linux eBPF, NIC Queues, and Congestion Control: How the Stack Fits Together"
excerpt: A practical introduction to how Linux eBPF observes packet processing, how congestion appears in NIC and qdisc queues, and how algorithms such as CUBIC, BBR, DCTCP, and DCQCN react.
publishDate: '2026-03-17T09:00:00-04:00'
isFeatured: false
tags:
  - Linux
  - eBPF
  - Networking
  - Systems
seo:
  title: "Linux eBPF, NIC Queues, and Congestion Control"
  description: Learn how eBPF hooks into the Linux networking stack, where NIC and queue congestion shows up, and how major congestion control algorithms differ.
  image:
    src: '/blog/ebpf-network-pipeline.svg'
    alt: Linux networking pipeline with eBPF hook points
---

The phrase "network congestion control" often gets reduced to a single box labeled *TCP*. In production Linux systems, that is too coarse. Congestion emerges at several places: the transport layer, the qdisc layer, the NIC transmit and receive rings, and the physical network fabric itself. If you want to reason about latency spikes, tail loss, or throughput collapse, you need to understand how these layers interact.

eBPF is useful here because it lets you observe and sometimes steer that interaction without building a custom kernel. It does **not** magically replace all kernel congestion control logic, and it does **not** eliminate the physics of finite queues. What it gives you is precise visibility at the right points in the packet path and, in some cases, programmable policy.

## 1. What eBPF actually is

eBPF stands for **extended Berkeley Packet Filter**. Historically, classic BPF was a small filtering mechanism for packets. Modern eBPF is much broader: it is a **safe, programmable execution environment inside the Linux kernel**.

That description matters. eBPF is not just "some tracing tool," and it is not just "packet filtering." A more accurate definition is:

- an eBPF **program** is small kernel-executed bytecode loaded from user space;
- the kernel runs a **verifier** before loading it, to reject unsafe behavior such as unbounded loops, invalid memory access, or unchecked pointer use;
- the program can call a restricted set of kernel **helpers** and exchange state through **maps**;
- once accepted, it is often **JIT-compiled** into native machine code for speed;
- the program runs only at explicit **attachment points**, such as XDP, `tc`, tracepoints, uprobes, kprobes, or socket hooks.

So the right mental model is not "eBPF is a replacement kernel." The right model is "eBPF is a constrained kernel-side runtime for small, event-driven programs."

That is why it became so important in networking and systems work. You can insert logic *inside* the kernel's hot path without shipping an out-of-tree kernel module every time you want a new measurement or policy.

The shortest contrast looks like this:

| Mechanism | Where it runs | Safety model | Typical use in networking | Tradeoff |
| --- | --- | --- | --- | --- |
| User-space agent | Outside kernel | process isolation | metrics, logs, control plane | easiest to ship, but too far from hot path |
| Kernel module | Inside kernel | full kernel privilege | custom drivers, deep kernel extensions | powerful, but risky to maintain and debug |
| eBPF | Inside kernel at controlled hooks | verifier + helper restrictions | XDP, `tc`, tracing, per-flow policy | less freedom than a module, much safer to iterate |

The distinction from a kernel module is especially important. A kernel module can do almost anything, including crashing the machine if it is wrong. An eBPF program is deliberately constrained. That limitation is not a bug; it is the reason teams can use eBPF in production for observability and policy enforcement with much less operational risk.

![Linux networking pipeline with eBPF hook points](/blog/ebpf-network-pipeline.svg)

*Figure 1. A simplified Linux packet path. The important idea is that congestion is not just "in the wire"; it can build up in qdiscs, driver queues, or NIC rings before the packet ever leaves the host.*

## 2. Where eBPF actually fits

On Linux, eBPF can attach to several networking-adjacent points:

- **XDP** at the driver level, before the full networking stack runs.
- **tc ingress/egress** around the qdisc layer.
- **sock_ops / sk_msg / cgroup hooks** around socket policy and per-flow behavior.
- **tracepoints, kprobes, perf events, ring buffers** for observability.

That placement matters. If your bottleneck is an overloaded receive path with tiny packets and too many cache misses, XDP may help because it runs early and cheaply. If your problem is queue buildup after transport scheduling but before DMA to the NIC, then `tc` and qdisc instrumentation are usually the right level. If you want to understand how a TCP sender reacts to RTT growth or retransmissions, socket-oriented eBPF and tracepoints are more informative.

The clean mental model is:

1. **transport control** decides how aggressively to send,
2. **queueing layers** decide how packets are staged,
3. **the NIC and network** decide whether service rate matches offered load,
4. **feedback signals** travel back and modify the sender.

eBPF fits mainly in steps 2 to 4: it measures, classifies, and sometimes enforces policy at those boundaries.

## 3. What "NIC congestion" means in practice

When people say a NIC is congested, they usually mean one of three things:

- the **TX ring** is persistently busy and descriptors are not reclaimed fast enough;
- the **RX ring** is overflowing or forcing drops because the CPU cannot drain packets via NAPI quickly enough;
- the **host-side queue before the NIC** is growing, so packets experience queueing delay before transmission.

These are different failure modes.

### TX-side pressure

On transmit, Linux may queue packets in the socket, then in the qdisc, then in the driver/NIC rings. If the sender keeps injecting data faster than the link or downstream network can drain it, the queue grows. That increases latency and can eventually create drops or ECN marks.

### RX-side pressure

On receive, the issue is often not sender aggressiveness but CPU service rate. If interrupts, NAPI polling, GRO aggregation, or application consumption cannot keep up, packets can pile up in the receive ring or be dropped before the application sees them.

### Fabric congestion

Even if the host is fine, the *network* may be the source of congestion: a shallow-buffer switch, incast traffic, or a cross-rack oversubscription point. In that case the sender only sees indirect feedback: queueing delay, ECN, or loss.

This is why queue-aware debugging matters more than raw throughput graphs.

## 4. The control loop: signal in, actuation out

A congestion controller is fundamentally a feedback controller. It observes some signal and changes a sending variable.

At a very high level,

$$
\text{throughput} \approx \frac{\text{cwnd}}{\text{RTT}}
$$

so if RTT rises because queues are filling, the same congestion window implies lower delivery rate. A useful decomposition is

$$
\text{RTT}_{\text{observed}} = \text{RTT}_{\min} + \text{queueing delay}.
$$

That second term is often the first clue that the path is drifting from "fully utilized" to "over-buffered."

The standard feedback signals are:

- **loss**: packets are dropped, retransmissions or duplicate ACKs occur;
- **ECN**: packets are delivered, but marked to indicate incipient congestion;
- **RTT growth**: latency rises before loss happens;
- **delivery rate**: the sender estimates whether bandwidth is actually being used efficiently.

The standard control knobs are:

- **cwnd**: how much data may be in flight;
- **pacing rate**: how fast packets are emitted;
- **application or cgroup policy**: who gets priority when the host is oversubscribed.

![Congestion feedback loops](/blog/congestion-control-feedback.svg)

*Figure 2. Different controllers respond to different primary signals. Loss-based algorithms react late, ECN-based algorithms react earlier, and model-based algorithms try to infer bandwidth and propagation delay directly.*

## 5. Host TCP control versus NIC-centric control

One source of confusion is that "congestion control" can mean either a **host TCP algorithm** or a **NIC/RDMA rate-control algorithm**.

For ordinary Linux TCP traffic, the key controllers are typically **CUBIC**, **BBR**, and in datacenter environments **DCTCP**. For RoCE/RDMA environments, a NIC-centered algorithm such as **DCQCN** becomes relevant because the NIC participates directly in rate control.

| Algorithm | Typical domain | Main signal | Primary knob | Strength | Main risk |
| --- | --- | --- | --- | --- | --- |
| CUBIC | General Linux TCP | Loss | `cwnd` growth and backoff | Mature default, high throughput on long-fat networks | Can build large queues before reacting |
| BBR | General Linux TCP | Delivery rate + min RTT | pacing rate and in-flight model | Usually lower queue occupancy and good latency/throughput balance | Can interact poorly with some queue disciplines or mixed traffic |
| DCTCP | ECN-enabled datacenter TCP | ECN fraction | `cwnd` scaled by congestion estimate | Reacts before hard drops, good for shallow-buffer fabrics | Needs correct ECN support end-to-end |
| DCQCN | RoCEv2 / RDMA | ECN-based feedback in NIC/RDMA stack | NIC rate adjustment | Better fit for RDMA fabrics with loss sensitivity | Specific to RDMA ecosystems, not generic Linux TCP |

The important operational point is this:

- if you are running a web service over standard TCP, focus first on **CUBIC / BBR / DCTCP**, qdisc choice, pacing, and queue instrumentation;
- if you are running **RoCEv2 or another NIC-assisted transport**, then host TCP is no longer the whole story and NIC-aware algorithms such as **DCQCN** matter.

## 6. A little more math: why DCTCP feels different

DCTCP is useful to mention because it captures the "react earlier" philosophy cleanly. Instead of waiting for packet loss, it uses the fraction of ECN-marked packets as a congestion estimate.

If \(F\) is the measured fraction of marked packets in a window, DCTCP maintains a running estimate

$$
\alpha \leftarrow (1 - g)\alpha + gF
$$

and then reduces congestion window roughly as

$$
\text{cwnd} \leftarrow \text{cwnd}\left(1 - \frac{\alpha}{2}\right).
$$

That is structurally different from classic loss-based backoff. The controller is trying to trim rate *before* the network has to drop packets. This is why DCTCP is attractive in shallow-buffer datacenter fabrics where loss is already a sign that latency got out of hand.

BBR is different again: it tries to estimate a bottleneck bandwidth \(BtlBw\) and a propagation delay \(RTprop\), then pace traffic around that model instead of treating loss as the primary truth signal.

## 7. What eBPF is good for in this space

There is a temptation to frame eBPF as "programmable congestion control." That is too broad. In practice, eBPF is strongest in four roles.

### 7.1 Fine-grained observability

eBPF can attach to tracepoints and socket callbacks to export per-flow RTT samples, retransmission counts, drops, ECN behavior, qdisc backlog, or NIC queue pressure. This is often the highest-value use because it converts a vague complaint like "the NIC is congested" into a measurable story.

Typical questions eBPF can answer well:

- Which flow class is filling the qdisc?
- Is tail latency dominated by qdisc backlog, retransmissions, or receive-side CPU saturation?
- Are ECN marks occurring before drops?
- Are short flows suffering because long bulk flows dominate pacing slots?

### 7.2 Lightweight policy at XDP or tc

At XDP or `tc`, eBPF can:

- drop obviously unwanted traffic early,
- classify packets into traffic classes,
- redirect flows to different queues or interfaces,
- attach metadata for downstream policy.

This does not replace transport control, but it can reduce congestion amplification from bad traffic mixes.

### 7.3 Socket-aware adaptation

With socket-oriented hooks, eBPF can help select policy by cgroup, tenant, or application type. For example, you may decide that latency-sensitive RPC traffic should be isolated from backup traffic, or that some service class should prefer a different pacing configuration.

### 7.4 Control-plane experimentation

eBPF is also a good way to prototype feedback logic around the kernel's existing controllers. It is far easier to observe a controller, enrich its telemetry, and enforce per-class policy than to fully re-implement a transport algorithm inside eBPF.

That last point matters. The eBPF verifier, execution limits, and maintainability constraints make full transport reimplementation unattractive for many production systems. In most deployments, eBPF complements the congestion controller instead of replacing it.

## 8. A practical debugging checklist

When a team reports "network congestion" on Linux, the shortest path to a useful diagnosis is usually this table.

| Question | What to measure | Useful Linux/eBPF vantage point | Likely next action |
| --- | --- | --- | --- |
| Are we actually overdriving the path? | delivery rate, pacing rate, `cwnd`, RTT | socket tracepoints, `sock_ops` telemetry | compare controller behavior; consider BBR or pacing changes |
| Are queues growing before the NIC? | qdisc backlog, enqueue/dequeue delay | `tc`, qdisc stats, tracepoints | tune qdisc, isolate classes, reduce burstiness |
| Is the NIC itself the bottleneck? | ring occupancy, drops, NAPI budget, CPU softirq time | driver stats plus eBPF tracepoints | rebalance IRQs, tune queue counts, inspect CPU saturation |
| Is the fabric signaling congestion early? | ECN marks, switch telemetry, RTT inflation | packet metadata, socket stats | enable or tune DCTCP/DCQCN where appropriate |
| Are some flows hurting others? | per-cgroup or per-tenant queue occupancy | cgroup + socket hooks | enforce class-based shaping or priority |

This is where eBPF is especially effective: it lets you build those measurements without waiting for a kernel fork or vendor-specific observability agent.

## 9. Choosing among algorithms

A reasonable rule of thumb is:

- choose **CUBIC** when you want the conservative Linux default and broad compatibility;
- choose **BBR** when latency under load matters and you trust pacing/model-based behavior;
- choose **DCTCP** when you control the datacenter and have correct ECN configuration;
- think about **DCQCN** only when you are truly in a RoCE/RDMA environment where the NIC participates in congestion management.

That last distinction is important because many discussions mix up host TCP control and NIC-centric rate control. They are related, but not interchangeable.

## 10. Final takeaway

The clean conceptual picture is:

- **eBPF** gives you programmability and observability at the right hook points;
- **qdisc and NIC queues** are where host-side congestion often becomes visible;
- **transport or NIC algorithms** decide how the sender backs off or paces forward;
- **good systems work** comes from matching the signal, controller, and queueing layer correctly.

If you remember only one thing, remember this: when debugging "NIC congestion" on Linux, do not ask only *which TCP algorithm am I using?* Ask **where the queue is growing, what feedback signal is available, and whether eBPF can expose or enforce the right policy at that layer.**

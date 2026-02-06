# Safe Serialization Under Mutual Suspicion (Miller, 1998) — Summary

This note summarizes the E Language paper "Safe Serialization Under Mutual Suspicion" (Mark S. Miller, October 3, 1998). The document is partially incomplete, but the core ideas are coherent and useful for capability systems.

**Thesis**
Serialization can be made compatible with object‑capability security if it is expressed as ordinary object interactions, with explicit mechanisms to control authority, identity, and visibility across the serialization boundary. The system should provide general mechanisms that let different policy choices coexist, rather than baking in one privileged serializer.

**Core Distinctions**
- **Portrayal vs depiction**: A portrayal is a live object graph of references that the serializer walks. A depiction is the serialized form (e.g., a program in Data‑E) that can reconstruct a graph later. The serializer is only allowed to get portrayals through public interfaces; it never peers into private state.
- **Mechanism vs policy**: The framework provides hooks for policy choices (what to serialize, how much to reveal, what authority to grant) without requiring god‑mode privileges.

**Data‑E and Uneval**
- Data‑E is a subset of the E language used as a serialization format. A depiction is an executable expression that reconstructs the object graph when evaluated.
- The serializer is framed as a **recognizer** and the unserializer as a **builder**, with the recognizer producing a depiction and the builder evaluating it.
- **Uneval / uncall**: Objects can provide a portrayal via an “uncall” triple that names a reconstructing call (receiver, verb, args). A list of “uncallers” acts as the policy surface for what can be portrayed.

**Exit Security (authority at the exits)**
- Serialization must not let objects **claim authority they do not have** (veracity). It also must not grant the serializer special introspection powers that bypass capability discipline.
- The design uses **named exit points** to represent references that the serializer does not traverse. These exits are reconnected during unserialization by controlled mappings (e.g., safe import points).
- The exit mechanism is how capability references are preserved or transformed across time/space/version boundaries without letting an attacker forge authority.

**Subgraph Security (selective transparency)**
- Only a subgraph of the system should be serializable, and only to a serializer that has the right to see it.
- The paper uses **rights amplification** patterns to allow objects to reveal more to a trusted serializer than they would to arbitrary clients.

**Entry Security (identity at the entries)**
- When unserializing, the new graph must be connected to the surrounding system in a controlled way.
- The paper explores how object identity can be preserved or deliberately changed (e.g., reincarnation), and how identity rights can be chained or transformed across serialization boundaries.

**Relevance for ERTP / Webkeys**
- The portrayal/depiction split maps well to webkey protocols: a webkey is an exit point, not a data dump.
- Uncall/uneval patterns suggest a principled way to define what objects are exportable and how they are reconstructed without giving the serializer ambient authority.
- The emphasis on veracity and selective transparency aligns with OCAP requirements for ERTP in a hostile network.

**Caveats**
- The paper is incomplete in places (some chapters flagged as not coherent).
- It is a conceptual framework, not a drop‑in protocol spec. It informs the design of serialization and capability exchange, but still needs concrete protocol decisions.

**Sources**
- `/home/connolly/Downloads/commons-research/jhu-paper/www.erights.org/data/serial/jhu-paper/index.html`
- `/home/connolly/Downloads/commons-research/jhu-paper/www.erights.org/data/serial/jhu-paper/intro.html`
- `/home/connolly/Downloads/commons-research/jhu-paper/www.erights.org/data/serial/jhu-paper/deconstructing.html`
- `/home/connolly/Downloads/commons-research/jhu-paper/www.erights.org/data/serial/jhu-paper/recog-n-build.html`
- `/home/connolly/Downloads/commons-research/jhu-paper/www.erights.org/data/serial/jhu-paper/exit-security.html`
- `/home/connolly/Downloads/commons-research/jhu-paper/www.erights.org/data/serial/jhu-paper/subgraph-security.html`
- `/home/connolly/Downloads/commons-research/jhu-paper/www.erights.org/data/serial/jhu-paper/entry-security.html`

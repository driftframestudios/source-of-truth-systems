# Build with Source of Truth

Follow a sample from intake to a result, then follow the code that makes that exploration possible. Source of Truth is a visual, interactive life sciences showcase built around synthetic workflows and recorded histories.

## Start with something you can run

The [live application](https://kindlight.ai) is available to explore. Source access currently requires a repository invitation; invited collaborators can use the local setup below.

[Run the example](../getting-started.md), select a well in Plate, and compare its results. The bundled scenario works without a database or an account. The Node server adds the real GraphQL boundaries used by the production application.

## Find the owner of a change

| You want to… | Start here |
| --- | --- |
| Choose persistence for an adaptation | [Database choices](../database-choices.md) |
| Add or inspect a read | [GraphQL reads](../graphql-read-api.md) and the [generated reference](./graphql-reference.md) |
| Preserve policy through a command | [Permission scenarios](../permission-scenarios.md) |
| Extend colors without moving a scene | [Theme contracts](../theme-contract.md) |
| Choose evidence for a change | [Focused checks](../runbooks/selective-check-delivery.md) |
| Deliver the application | [Deployment](../deployment.md) |

The application separates its visual scenes, accepted browser state, canonical commands and server adapters. A small change belongs with the owner that can explain its effect and recovery. [The documentation index](../README.md) leads to the complete set of source contracts.

## Work from explicit examples

Synthetic records support exploration of questions such as “Why was this sample rerun?” and “Which result used this file?” [Fixture provenance](../fixture-provenance.md) explains what those examples establish. Production clinical decisions, verified private accounts and real patient data require their own receiving design and authority.

## Contribute a focused improvement

Describe the behavior a person can observe, change its owning source, and choose a check that distinguishes the intended outcome from a plausible fault. The [testing method](../../.agents/skills/test-suite-composition/SKILL.md) and local runbooks support that route. Repository instructions document collaboration; application permission checks retain runtime authority.

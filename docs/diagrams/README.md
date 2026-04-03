# Architecture Diagram Options

This folder contains the same Phantom Auth0 architecture expressed three ways so you can compare the notation and output style.

- `phantom-auth0.d2`: best for polished architecture diagrams
- `phantom-auth0.mmd`: best for docs-native Mermaid rendering
- `workspace.dsl`: best for formal C4-style modeling with Structurizr

If the local renderers are installed, typical commands are:

```bash
d2 docs/diagrams/phantom-auth0.d2 docs/diagrams/phantom-auth0.d2.svg
mmdc -i docs/diagrams/phantom-auth0.mmd -o docs/diagrams/phantom-auth0.mmd.svg -b transparent
structurizr export -workspace docs/diagrams/workspace.dsl -format plantuml/mermaid/dot
```

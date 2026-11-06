# Ícones das habilidades

Cada ícone fica em `<pasta>/<id-da-habilidade>.webp` (ou `.png`), quadrado, 512 × 512, pintura de ponta a ponta e sem moldura (o jogo coloca um filete dourado). Para trocar um ícone, substitua o arquivo com o mesmo nome.

- `<pasta>` é o personagem: `lyra`, `vexra`, `dravenor`, `kael`, `nyxara`, `vorath`.
- As versões do Eclipse (Lâmina Dilacerante, Marca Profana, Véu do Massacre) ficam em `vaelith/`, com os mesmos ids da Nyxara.
- O id é o da habilidade no código, por exemplo `lyra/astral-orb.webp`, `lyra/star-field.webp`, `lyra/arcane-barrier.webp` e `lyra/supernova.webp`.

O jogo encontra os arquivos sozinho no build. Se um ícone faltar, aparece um marcador discreto no lugar; numa forma alternativa sem ícone próprio, usa-se o da forma base. A lista completa de ids está em `docs/selecao.md`.

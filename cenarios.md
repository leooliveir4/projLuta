# Cenários (3.7.0)

O jogo passou de dois para cinco cenários. Os três novos são artes finais, usadas exatamente como foram enviadas: os arquivos WebP não foram recortados, redimensionados nem recomprimidos.

| Id | Nome | Arquivo |
| --- | --- | --- |
| `arcane` | Arena Arcana | `src/assets/images/arena-arcana.svg` (existente) |
| `ring` | Ringue | `src/assets/images/ringue.webp` (existente) |
| `ruinas-antigas` | Ruínas Antigas | `src/assets/images/stages/ruinas-antigas.webp` (1672 × 941) |
| `templo-eclipse` | Templo do Eclipse | `src/assets/images/stages/templo-eclipse.webp` (1672 × 941) |
| `dimensao-abissal` | Dimensão Abissal | `src/assets/images/stages/dimensao-abissal.webp` (1672 × 941) |

Os arquivos são importados em `src/ui/art.ts`. O Vite gera nomes com hash, então eles funcionam no GitHub Pages com qualquer `BASE_PATH` e podem ficar em cache. O manifesto original está em `assets-source/images/stages/manifesto.json`.

![Templo do Eclipse em combate](screenshots/cenario-templo.webp)

## Onde se escolhe

- **Duelo.** No passo "Escolha o adversário", o seletor de cenário é o mesmo grupo de opções de antes, agora com uma miniatura de cada mapa. Fica no canto superior esquerdo no desktop e abaixo da dificuldade no tablet e no celular. O cenário escolhido aparece escurecido ao fundo da tela, como prévia.
- **Desafio.** Cada etapa tem um cenário fixo:

  | Etapa | Cenário |
  | --- | --- |
  | 1 | Arena Arcana |
  | 2 | Ringue |
  | 3 | Ruínas Antigas |
  | 4 (sua sombra) | Dimensão Abissal |

  As duas primeiras continuam como antes. A lista fica em `CHALLENGE_STAGES`, em `art.ts`. O Templo do Eclipse aparece só no Duelo; para colocá-lo no Desafio, basta trocar um item dessa lista.

![Escolha do cenário](screenshots/escolha-cenario.webp)

## Como a arte é usada na arena

- **Enquadramento.** A arte é o fundo de toda a tela de combate (`.battle__stage::before`). Nos três mapas novos, a camada tem a altura necessária para que os pés dos lutadores caiam a 76% da imagem, sobre o piso pintado.
  - A posição dos pés é medida pela `BattleUI` (`--floor-y`) e atualizada quando a tela muda de tamanho.
  - No desktop, isso ocupa a tela inteira.
  - No celular e no tablet, a imagem termina um pouco abaixo dos lutadores e se funde ao fundo escuro atrás do painel de ações. Assim os personagens ficam sobre o chão, e não sobre o céu.
- **Contraste.** Os ajustes são discretos e só no fundo, nunca nos personagens:

  | Cenário | Ajuste | Motivo |
  | --- | --- | --- |
  | Ruínas Antigas | brilho 84% | Lua e céu claros |
  | Templo do Eclipse | brilho 86% e um reflexo vermelho bem leve no chão | — |
  | Dimensão Abissal | brilho 74% e saturação 78% | O fundo roxo tem a mesma cor da Lyra e do Vorath; com o ajuste, as silhuetas continuam legíveis. |

  O degradê escuro no alto e embaixo, que já existia, mantém o HUD e o painel de ações legíveis.
- **Sem acréscimos.** Não há neblina, partículas nem animações novas no cenário. A Arena Arcana e o Ringue não mudaram.

## Verificação realizada

| Verificação | Resultado |
| --- | --- |
| `npm test` | 145 testes passando (3 novos em `tests/stages.test.ts`: os cinco cenários, a ordem do desafio e a volta ao início da lista). |
| `npm run typecheck` e `npm run build` | Sem erros. O build inclui os três WebP com hash. |
| Batalhas no navegador | Chrome sem interface com Playwright e build de produção. Luta iniciada nos **cinco** cenários em 1440 × 900 e 390 × 844, e nos três novos também em 768 × 1024 e 1920 × 1080. Em todos: imagem carregada, as duas artes dos lutadores visíveis e no mesmo lugar dos mapas antigos, nenhum erro no console, nenhum arquivo faltando e nenhuma rolagem horizontal. |
| Mapas antigos | Arena Arcana e Ringue testados com Lyra × Vorath e Kael × Nyxara. |
| Seleção | O passo do adversário cabe sem rolar em 1280 × 800, 1366 × 768 e 1440 × 900. O Ringue e os mapas novos escolhidos chegam à luta. |
| Desafio | A primeira etapa abriu na Arena Arcana, como antes. |
| Regressão | O roteiro completo (menu, seleção, luta, entrada e saída do Eclipse, resultado) passou em 1440 e 390 px. |

### Limitações

- Só testei no Chrome.
- Num celular deitado (paisagem baixa), a tela rola na vertical, como antes, e o fundo segue a mesma regra.

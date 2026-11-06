# Integração visual 3.2.0

As ilustrações aprovadas de Lyra, Vexra, Dravenor, Kael, Nyxara (duas formas) e Vorath foram incorporadas como WebP transparentes, substituindo os SVG provisórios nos personagens e retratos.

## Arquivos

- `src/assets/images/characters/*.webp`: corpo inteiro transparente.
- `src/assets/images/portraits/*.webp`: enquadramento quadrado derivado da arte individual para HUD e seleção.
- `src/ui/art.ts`: referências da arte por ID e pela forma (`eclipse`).
- `src/styles/battle.css`: leve ajuste de escala para Vorath e Nyxara.

## Restrições preservadas

- Nenhuma alteração no motor de combate, na IA, nas habilidades ou nos testes.
- Cenário, layout e controles existentes mantidos.
- A forma `eclipse` continua a trocar imagem e retrato pela mesma API de antes.

## Próximas verificações manuais

1. Rodar o jogo e confirmar os retratos na seleção, HUD, turnos e tela de desafio.
2. Testar confrontos que incluam os seis personagens e a transformação Nyxara/Vaelith.
3. Conferir enquadramento desktop e mobile e o espelhamento do adversário.
4. Após validar a apresentação estática, criar sprites e animações em etapa separada.

Os arquivos de arte podem ter transparência difusa nas bordas (cabelos, partículas e névoas), preservada intencionalmente para não recortar detalhes da ilustração.

## Atualização 3.3.0

O ajuste de escala por personagem que ficava em `battle.css` foi substituído pelo enquadramento centralizado em `src/ui/art.ts`. Detalhes em [`polimento-visual.md`](polimento-visual.md).

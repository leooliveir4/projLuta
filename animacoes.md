# Animações de combate (3.4.0)

Esta versão anima o combate usando as ilustrações que já existem. Nenhum arquivo de arte foi alterado, nenhuma regra mudou e o `BattleEngine`, a IA e o balanceamento continuam iguais. As animações apenas reproduzem, na tela, os eventos que o motor já emitia (`action`, `damage`, `dodge`, `heal`, `effect-applied`, `form-change`, `defeated`…).

![Investida do Dravenor: repouso, aproximação, impacto e retorno](screenshots/anim-investida.webp)

## Como está organizado

| Arquivo | Papel |
| --- | --- |
| `src/ui/choreography.ts` | Dados puros, sem DOM: como cada ataque básico e cada habilidade se movimenta. Testado em `tests/choreography.test.ts`. |
| `src/ui/Vfx.ts` | Camada de efeitos da arena: projéteis, impactos, carga de energia, rachadura no chão, partículas, anéis, tremor e clarão. |
| `src/ui/BattleUI.ts` | Orquestra a sequência (preparo → projétil ou investida → impacto → reação → retorno) e controla poses e estados de cada lutador. |
| `src/ui/art.ts` | Além do enquadramento, guarda a ponta da arma (`muzzle`) da Lyra e da Vexra e aceita arquivos de pose opcionais (`poses`). |
| `src/styles/battle.css` | Poses, respiração, efeitos e estados persistentes, com versões paradas para movimento reduzido. |

Cada movimento em `choreography.ts` informa:

- **aproximação**: `melee` (vai até o adversário e volta), `ranged` (dispara da arma), `cast` (conjura no alvo) ou `self` (efeito em si mesmo);
- **projétil**: orbe, tiro, granada ou supernova;
- **impacto**: explosão de luz, corte, corte em X, garras, golpe pesado, explosão, estrelas, fenda, implosão, onda de choque, selo ou absorção;
- **intensidade**: tremor de 0 a 3, carga de energia antes do golpe, clarão e rachadura no chão.

Para mudar a animação de uma habilidade basta editar a entrada dela; um teste falha se algum personagem ficar sem movimento definido.

## O que cada habilidade faz na tela

| Personagem | Ação | Animação |
| --- | --- | --- |
| Lyra | Ataque básico | Orbe que sai do cajado e estoura no alvo. |
| | Orbe Astral | Orbe maior, explosão de luz e tremor leve. |
| | Campo de Estrelas | Estrelas caem sobre o adversário. |
| | Barreira Arcana | Anel azul e cúpula translúcida enquanto o escudo durar. |
| | Supernova | Energia converge no cajado, esfera gigante, explosão, clarão e tremor forte. |
| Vexra | Ataque básico e Rajada Perfurante | Clarão na boca do canhão e traçante até o alvo. |
| | Granada Explosiva | Granada em arco e explosão com fumaça. |
| | Torre Automática | A torre aparece no chão à frente da Vexra e dispara dela no início de cada turno. |
| | Sobrecarga | Contorno pulsante e círculo de energia no chão. |
| Dravenor | Ataque básico | Investida e golpe pesado. |
| | Golpe Devastador | Investida, corte largo e tremor. |
| | Pele de Ferro | Brilho metálico no contorno enquanto durar. |
| | Fúria Ancestral | Aura pulsante. |
| | Ruptura da Terra | Golpe no chão, rachadura que corre até o adversário e onda de choque. |
| Kael | Ataque básico | Investida e corte. |
| | Lâmina Arcana | Investida e corte em X. |
| | Passo Etéreo | Rastro fantasma e figura translúcida até o próximo ataque. |
| | Duelo Perfeito | Aura pulsante. |
| | Corte Dimensional | Fenda escura que se abre no ar, clarão e tremor. |
| Nyxara / Vaelith | Ataque básico | Investida e corte. |
| | Lâmina Sombria / Lâmina Dilacerante | Investida e corte em X. |
| | Marca do Abismo / Marca Profana | Selo no alvo e marca girando acima da cabeça enquanto durar. |
| | Véu Espectral / Véu do Massacre | Rastro fantasma e figura translúcida. |
| | Eclipse de Vaelith | A arena escurece, a energia converge, clarão vermelho e a arte troca. |
| Vorath | Ataque básico | Investida e garras. |
| | Impacto do Abismo | Garras e tremor. |
| | Assimilação | Garras e partículas de vida que voltam para o Vorath. |
| | Massa Instável | Brilho de armadura no contorno. |
| | Ruptura do Vazio | Carga sobre o alvo, implosão, estouro, clarão e tremor forte. |

Também há reações gerais:

- **Dano**: a figura recua e pisca.
- **Crítico**: pausa curta antes do número e tremor.
- **Esquiva**: o projétil passa e fica um rastro.
- **Revide**: avanço rápido com corte.
- **Cura**: brilhos sobem.
- **Defender**: postura de guarda.
- **Fim da luta**: o vencedor se ergue e o derrotado tomba.

Entre as ações, os dois lutadores respiram de leve.

![Supernova da Lyra: carga, disparo, impacto e explosão](screenshots/anim-supernova.webp)

### Estados que ficam visíveis

| Estado | Visual |
| --- | --- |
| Escudo Astral | Cúpula azul translúcida |
| Queimadura | Brasas subindo do corpo |
| Sangramento | Gotas escorrendo |
| Torre Automática | Torre no chão (ilustração própria desde a 3.5.0) |
| Marca do Abismo | Selo roxo girando acima da cabeça |
| Lentidão e Torpor | Anel tracejado pulsando nos pés |
| Sobrecarga, Duelo Perfeito, Fúria, Força | Contorno pulsante e círculo de energia |
| Pele de Ferro, Massa Instável | Contorno metálico |
| Passo Etéreo e Véus | Figura translúcida |

Esses visuais seguem os efeitos que o motor mantém em cada personagem e desaparecem quando o efeito acaba ou quando o lutador é derrotado.

![Eclipse de Vaelith: Nyxara, carga, clarão e Vaelith](screenshots/anim-eclipse.webp)

## Movimento reduzido

Quando as animações estão desligadas nas opções (ou o sistema pede movimento reduzido):

- ninguém se desloca;
- não há projéteis, tremor nem clarão;
- a luta anda no ritmo rápido de antes.

Os estados persistentes continuam visíveis, parados, porque informam a situação do combate.

## Desempenho

Os efeitos usam apenas `transform` e `opacity`, com elementos leves que são removidos ao terminar. Não há laço de animação contínuo, `canvas` nem bibliotecas novas.

O pacote de JavaScript passou de cerca de 117 kB para cerca de 129 kB (39 kB com gzip). O de CSS passou de cerca de 52 kB para cerca de 68 kB (15 kB com gzip).

## O que precisa de arte (para planejar)

Tudo acima é feito movendo e iluminando a **mesma ilustração**. O personagem inclina, avança e brilha, mas os braços e a arma não mudam de posição. Para golpes com o corpo realmente em outra posição é preciso desenhar poses. O jogo já está preparado para recebê-las.

### Poses aceitas

| Nome | Quando aparece | Sugestão de desenho |
| --- | --- | --- |
| `windup` | Preparo, logo antes do golpe ou disparo | Arma recolhida, peso para trás |
| `strike` | Golpe corpo a corpo, durante a investida | Arma no fim do movimento, corpo à frente |
| `cast` | Disparo, magia e habilidades em si mesmo | Braço ou arma estendidos, energia na mão |
| `hurt` | Ao sofrer dano | Corpo encolhido, cabeça para trás |
| `guard` | Ao defender, até o turno seguinte | Arma ou braços à frente do corpo |
| `victory` | Fim da luta, vencedor | Pose de triunfo |
| `defeat` | Fim da luta, derrotado | Ajoelhado ou caído |

Nenhuma pose é obrigatória. As que faltarem continuam sendo feitas pelo movimento da arte parada, então dá para começar só com `strike` e `cast` dos personagens principais, por exemplo.

### Requisitos de cada arquivo

1. **Mesmo tamanho de tela da arte parada do personagem.** Tamanhos atuais:

   | Arte | Tamanho |
   | --- | --- |
   | Lyra | 864 × 1152 |
   | Vexra | 960 × 1050 |
   | Dravenor | 960 × 1126 |
   | Kael | 1053 × 1152 |
   | Nyxara | 964 × 1024 |
   | Vaelith | 758 × 1152 |
   | Vorath | 864 × 1152 |

2. **Mesmo ponto de apoio.** Os pés na mesma altura e o centro do corpo na mesma posição horizontal da arte parada, para a troca não "pular". O jeito mais simples é desenhar por cima de uma cópia da arte parada e apagar o original.
3. **Mesmo lado.** Olhando e apontando para o mesmo lado da arte parada. O jogo espelha sozinho quando o personagem está do outro lado da arena.
4. **WebP com transparência**, no mesmo estilo de pintura, sem cenário nem sombra no chão. A sombra e o anel são desenhados pelo jogo.
5. **Formas alternativas têm poses próprias.** A Vaelith usa as dela, não as da Nyxara.

### Como ligar no código

Coloque os arquivos em `src/assets/images/characters/` (por exemplo, `kael-strike.webp`) e declare em `src/ui/art.ts`:

```ts
import kaelStrike from '../assets/images/characters/kael-strike.webp';
import kaelCast from '../assets/images/characters/kael-cast.webp';

kael: {
  full: kaelFull,
  poses: { strike: kaelStrike, cast: kaelCast },
  // ...resto igual
},
```

Para a Vaelith, `poses` fica dentro de `forms.eclipse`. As poses são carregadas junto com a luta, então a troca não pisca.

Durante uma pose com arquivo próprio, a inclinação feita em CSS é desligada, porque o desenho já mostra o movimento. A investida, o recuo, o tremor e os efeitos continuam iguais.

### Outras peças de arte que melhorariam o resultado

- **Torre Automática.** Feito na 3.5.0: a torre desenhada em CSS deu lugar à ilustração própria (`src/assets/images/effects/vexra-turret.webp`), e os tiros saem da boca do canhão.
- **Efeitos pintados.** Os efeitos atuais são formas geométricas com brilho. Folhas de efeito desenhadas (uma explosão, um corte, uma fenda) podem entrar no lugar das classes `vfx-*` correspondentes. Um exemplo é uma sequência de quadros de explosão, em PNG ou WebP.
- **Animação quadro a quadro de verdade.** Por exemplo, 6 a 8 quadros por golpe. Exigiria um formato de folha de sprites e um pequeno leitor de quadros. A estrutura de poses já separa onde isso entraria, mas esse leitor não foi implementado.

## Verificação realizada

| Verificação | Resultado |
| --- | --- |
| `npm test` (Vitest) | 107 testes em 8 arquivos, todos passando. Os 4 novos de coreografia confirmam que todo ataque e toda habilidade têm movimento, que o tipo bate com o alvo da habilidade e que os estados citados existem no catálogo. |
| `npx tsc --noEmit` | Sem erros. |
| `npm run build` | Concluído. |
| Navegador, desktop 1440 × 900 | Chrome sem interface com Playwright, build de produção servido pelo `vite preview`. Foram capturadas sequências de quadros (um a cada 50–170 ms, conforme a tela) de todos os ataques básicos e todas as habilidades dos seis personagens, das três habilidades da Vaelith e da transformação. Revisei as sequências visualmente. |
| Navegador, celular 390 × 844 | Mesma captura para Kael e Nyxara, incluindo o Eclipse e as habilidades da Vaelith. |
| Movimento reduzido | Luta completa da Vexra com animações desligadas: nada se desloca e os estados ficam parados e visíveis. |
| Torre | Verificado pelo registro dos efeitos que o tiro da torre sai do centro da torre e o da Vexra sai da boca do canhão. |
| Poses com arquivo | Teste temporário com três poses da Lyra apontando para outras imagens. A troca de arquivo ocorreu no preparo, na conjuração e no dano, a arte parada voltou depois e a inclinação em CSS ficou desligada. A configuração de teste foi removida. |
| Roteiro da 3.3.0 em 1920, 1440, 768, 390 e 360 px | Sem rolagem horizontal, sem erros no console, e o Eclipse entra e sai corretamente. |

### Limitações

- As capturas são quadros espaçados, não vídeo. A fluidez foi avaliada pela sequência, sem medição de quadros por segundo e sem aparelhos fracos.
- Foram usados só o Chrome e telas simuladas. Firefox, Safari e celulares reais não foram testados.
- Em golpes corpo a corpo, lutadores largos (como o Dravenor) encostam e sobrepõem um pouco o adversário no impacto; isso foi deixado de propósito para o golpe "chegar".
- Os sons não mudaram nesta versão. A 3.5.0 integrou sons próprios sincronizados com estas animações (veja [`audio.md`](audio.md)).

# Relatório de balanceamento

Este relatório registra a **revisão funcional e de balanceamento** feita sobre o elenco de seis personagens do documento *Arena RPG: Personagens e Balanceamento v1.0*. A fase anterior (substituição do elenco) está resumida no fim, em [Histórico](#histórico-fase-anterior).

## Método

- Script do projeto: `npm run simulate -- [combates por par] [dificuldade] [deslocamento da semente]` (`scripts/simulate.ts`).
- IA contra IA nos 15 pares distintos. Os lados se alternam a cada semente; o mais veloz começa, como manda o motor.
- Toda a aleatoriedade é injetada (`SeededRandom`): os números abaixo são reproduzíveis.
- **Calibração**: 100 combates por par, sementes 1 a 100 (`npm run simulate -- 100 normal`).
- **Validação**: 150 combates por par em sementes que não foram usadas na calibração, 1001 a 1150 (`npm run simulate -- 150 normal 1000`). Serve para conferir que o ajuste não ficou "decorado" para um conjunto de sementes.
- O teste `tests/balance.test.ts` verifica automaticamente, nas dificuldades normal e difícil:
  - agregado de cada personagem entre 35% e 65%;
  - nenhum confronto abaixo de 20% ou acima de 80%;
  - nenhum confronto com média acima de 75 turnos.

## 1. Situação no início da revisão

Os agregados estavam dentro da meta, mas os confrontos não.

| Confronto (IA normal) | Vitórias do primeiro | Turnos médios | Máximo |
|---|---:|---:|---:|
| Dravenor × Vorath | **98%** | **87,1** | 109 |
| Kael × Vorath | **16%** | 37,3 | 49 |
| Nyxara × Vorath | **17%** | 35,6 | 44 |
| Vexra × Dravenor | 75% | 36,8 | 47 |

Na IA difícil a situação era pior: Dravenor × Vorath 99%, Vexra × Dravenor 87%, Dravenor × Nyxara 16%, Lyra × Kael 21%.

As habilidades de suporte quase não eram usadas: Barreira Arcana, Torre Automática, Sobrecarga, Passo Etéreo, Duelo Perfeito e os Véus ficavam em torno de 1% das ações na IA normal e **0%** na difícil.

## 2. Investigação das causas

Antes de mexer em atributos, medi cada confronto problemático: dano e cura por turno próprio, fontes de dano, ações usadas e duração (IA normal, 100 combates).

### Dravenor × Vorath (98%, 87 turnos)

| | Dano por turno | Cura por turno |
|---|---:|---:|
| Dravenor | 38,7 | 26,1 |
| Vorath | 38,7 | 20,1 |

- O dano é igual dos dois lados. A diferença está na cura: o **Vigor Ancestral** (20 por turno abaixo de 50%) passa metade da luta ativo, somado à Fúria Ancestral (90).
- Com dano líquido de 13 a 19 por turno contra 760 a 840 de vida, a luta chega a 87 turnos.
- **Lutas longas transformam vantagens pequenas em vitória quase certa.** A variação do combate é baixa (só o ataque básico varia ±10%; crítico e esquiva são raros). Em 40 turnos próprios, uma vantagem de 6 de cura por turno decide quase todas as lutas.

### Kael × Vorath (16%) e Nyxara × Vorath (17%)

- Kael causa 65 de dano por turno e Nyxara 68, mas o Vorath cura 28 a 29 por turno: Núcleo Voraz (12 todo turno, porque ele é atingido todo turno), Massa Instável (35), Assimilação e a poção, que cura 30% de 840.
- O dano líquido sobre ele cai para cerca de 37 por turno, enquanto o Vorath causa 40 por turno em alvos de defesa baixa.
- As lentidões do Vorath reduzem a velocidade e, com ela, a esquiva, que é a defesa desses dois personagens.

### Vexra × Dravenor (75%)

- A corrida é quase empatada: os dois levariam cerca de 20 turnos para derrotar o outro.
- A Vexra **sempre age primeiro** (velocidade 12 contra 7), e a queimadura ignora defesa, que é justamente o atributo do Dravenor.
- Numa corrida empatada, quem começa vence.

### Habilidades de suporte quase nunca usadas

Duas causas somadas:

1. **A IA subestimava o suporte.**
   - Um bônus de ataque valia "porcentagem × próximo ataque básico", como se durasse uma ação.
   - A IA ignorava quanto a luta ainda ia durar.
   - Comparava o bônus com o melhor golpe disponível. Mas, com recargas, usar um bônus antes do golpe forte não perde o golpe: só o adia um turno.
2. **Os números eram baixos.** Com os valores do documento, forcei o uso de cada habilidade sempre que disponível (IA difícil, contra o elenco) e medi a taxa de vitória:

   | Habilidade | Vitórias normais | Com uso forçado |
   |---|---:|---:|
   | Sobrecarga (Vexra) | 56,9% | 8,0% |
   | Torre Automática (Vexra) | 56,9% | 9,2% |
   | Duelo Perfeito (Kael) | 57,2% | 9,3% |
   | Passo Etéreo (Kael) | 57,2% | 5,6% |
   | Barreira Arcana (Lyra) | 49,6% | 2,7% |
   | Véu Espectral (Nyxara) | 49,9% | 7,2% |

   Usar em todo turno disponível é um teste extremo, mas a queda mostra que cada uso rendia bem menos que atacar. Uma ação custa cerca de um ataque básico, e a energia também tem valor (é o que limita as habilidades de dano). Um bônus de +25% por 2 turnos rende algo como metade de um ataque.

## 3. Correções

### 3.1 IA (todas as dificuldades)

A IA continua baseada em regras, sem modelos generativos nem APIs externas. Reescrevi a avaliação para considerar o estado do combate:

- **Leitura da luta.** Antes de pontuar, a IA estima:
  - o dano típico por ação de cada lado;
  - o maior golpe que o adversário pode dar no próximo turno, incluindo torre;
  - quantas ações cada um precisa para derrotar o outro (o "horizonte").
- **Bônus e debuffs** valem pelas ações que vão de fato aproveitar, limitadas pela duração e pelo horizonte.
  - O plano de ações considera as habilidades de dano prontas, nesta ordem, e a energia disponível.
  - Perto do fim da luta, preparação não vale nada.
- **Adiar não é perder.** Uma ação sem dano (bônus, defesa, item) recebe 80% da diferença entre o melhor golpe pronto e o ataque básico. Assim, "Sobrecarga e depois Granada" vence "Granada agora" quando o bônus vale mais que um ataque básico.
- **Defesa e esquiva**:
  - valem pelo dano que evitam, considerando o golpe mais forte do adversário;
  - a IA soma revides e influência ganha;
  - há bônus de sobrevivência quando a habilidade evita uma derrota no próximo turno.
- **Recursos**:
  - o Elixir de Energia vale pela habilidade que ele libera;
  - a cura fica mais urgente quando o adversário pode vencer em poucas ações.
- **Dificuldades.** Fácil e normal mantêm erros e ruído. A novidade é que **o fácil não planeja**: avalia efeitos só pela próxima ação e não usa o crédito de adiamento.

| Medida (mesmas regras e personagens) | Antes | Depois |
|---|---:|---:|
| IA nova contra a anterior, normal | – | **57,6%** |
| IA nova contra a anterior, difícil | – | **60,6%** |
| Difícil contra fácil | 78,1% | 80,0% |
| Normal contra fácil | 71,5% | 73,8% |
| Difícil contra normal | 56,7% | 61,9% |

### 3.2 Habilidades de suporte

Só valores. Nenhuma habilidade nova, nenhuma removida, nenhuma identidade trocada.

| Habilidade | Antes | Depois |
|---|---|---|
| Barreira Arcana (Lyra) | −30% no próximo dano direto, consumido; 30 de energia, recarga 3 | **−35% em todo dano direto** nos 2 turnos seguintes do adversário; **20** de energia, recarga **4** |
| Torre Automática (Vexra) | 22 de dano fixo por 2 turnos; 40 de energia, recarga 4 | **30 por 3 turnos**; **25** de energia, recarga **5** |
| Sobrecarga (Vexra) | ataque +25% por 2 turnos; 35 de energia | ataque **+40% por 3 turnos**; **20** de energia |
| Passo Etéreo (Kael) | +20 pontos de esquiva; 30 de energia | **+35 pontos**; se esquivar, **revida** (poder 1,0); **15** de energia |
| Duelo Perfeito (Kael) | ataque +20% e velocidade +15% por 2 turnos; 35 de energia | ataque **+35%** e velocidade **+20% por 3 turnos**; **20** de energia |
| Véu Espectral (Nyxara) | +20 pontos de esquiva; 30 de energia | **+35 pontos**; se esquivar, **+20 de influência**; **15** de energia |
| Véu do Massacre (Vaelith) | +20 pontos; revide de poder 0,55 se for atingida; 30 de energia | **+35 pontos**; revide de poder **1,0**; **15** de energia |

O teto de 50% de esquiva e o teto de 60% de redução de dano continuam valendo.

Para isso, o motor ganhou duas peças pequenas, sem mudar regras globais:

- o campo de efeito `counterOnDodge`, que dispara um revide quando a esquiva funciona;
- o gancho `onEvasionResolved`, que a Nyxara usa para ganhar influência quando o Véu Espectral funciona.

### 3.3 Sustentação e atributos

Primeiro ajustei **um parâmetro por vez**, medindo cada passo. As medições abaixo são intermediárias: foram feitas com a IA nova, antes dos valores finais das habilidades de suporte.

| Passo | Efeito medido |
|---|---|
| Núcleo Voraz 12 → 8 | Vorath de 66% para 48% no geral. Dravenor × Vorath foi para 100%. |
| Vigor Ancestral 20 → 14 | Dravenor de 60% para 44%. Vexra × Dravenor foi para 94%. |
| Dravenor com mais ataque e menos cura | Dravenor subiu para 65%: o ataque pesa mais que a cura. |
| Vida da Nyxara 560 → 600 | Nyxara de 37% para 63–70%. |

O sistema é muito sensível: poucos pontos mudam confrontos inteiros.

Depois fiz uma busca por coordenadas, um parâmetro de cada vez em passos pequenos, avaliando as dificuldades fácil, normal e difícil. O objetivo:

- penalizava confrontos fora de 35% a 65%, agregados fora de 46% a 54% e Dravenor × Vorath acima de 55 turnos;
- penalizava também o afastamento dos valores do documento.

O resultado foi conferido nas sementes de validação. A ferramenta de busca é auxiliar e não faz parte do projeto; o resultado pode ser conferido com `npm run simulate`.

| Personagem | Mudança | Motivo |
|---|---|---|
| Lyra | sem mudança (600 / 82 / 22 / 14) | Ficou equilibrada com a nova IA. |
| Vexra | vida 630 → **640**, ataque 86 → **84**, queimadura 18 → **16** | Menos pressão contra os tanques; um pouco mais de vida. |
| Dravenor | vida 760 → **780**, ataque 54 → **57**; Vigor 20 abaixo de 50% → **16 abaixo de 45%**; Fúria Ancestral 90 → **65**; atordoamento 30% → **40%** | Troca cura passiva por ameaça, encurtando as lutas longas. |
| Kael | vida 580 → **570** | Compensa o Duelo Perfeito mais forte. |
| Nyxara | vida 560 → **580**; ataque no Eclipse +25% → **+30%** | Era a mais fraca. A transformação ficou mais recompensadora, sem mudar regras. |
| Vorath | vida 840 → **820**, ataque 60 → **61**; Núcleo Voraz 12 → **10**; Massa Instável cura 35 → **25**; Assimilação 40% → **35%** | Menos cura sobre atacantes frágeis. |

Valores que **não** mudaram:

- velocidades e defesas;
- regras globais (fórmula de dano, esquiva, guarda, energia, crítico);
- todas as outras habilidades e efeitos;
- a transformação (3 turnos, recarga 5, influência +15 / +10 / +10, velocidade +10%, defesa −15%).

## 4. Resultados: antes e depois

### Taxa de vitória agregada (100 combates por par, sementes 1 a 100)

| Personagem | Normal antes | Normal depois | Difícil antes | Difícil depois | Fácil antes | Fácil depois |
|---|---:|---:|---:|---:|---:|---:|
| Lyra | 49,4% | 50,4% | 48,0% | 54,4% | 61,0% | 60,6% |
| Vexra | 52,6% | 52,0% | 57,0% | 50,0% | 43,2% | 43,2% |
| Dravenor | 50,4% | 53,8% | 40,6% | 49,4% | 63,6% | 53,4% |
| Kael | 49,0% | 47,2% | 56,4% | 48,0% | 42,4% | 45,2% |
| Nyxara | 41,8% | 46,0% | 51,2% | 51,6% | 33,0% | 36,6% |
| Vorath | 56,8% | 50,6% | 46,8% | 46,6% | 56,8% | 61,0% |
| **Faixa** | 41,8–56,8 | **46,0–53,8** | 40,6–57,0 | **46,6–54,4** | 33,0–63,6 | 36,6–61,0 |

Na validação (sementes 1001 a 1150, 150 por par):

- normal: 45,3% a 56,5% (antes, 39,9% a 55,5%);
- difícil: 45,5% a 54,8% (antes, 38,3% a 59,1%).

### Confrontos fora da faixa de 25% a 75%

| Dificuldade | Antes | Depois |
|---|---|---|
| Normal | Dravenor × Vorath 98%, Kael × Vorath 16%, Nyxara × Vorath 17% | **nenhum** |
| Difícil | Dravenor × Vorath 99%, Vexra × Dravenor 87%, Dravenor × Nyxara 16%, Lyra × Kael 21%, Kael × Vorath 24% | Lyra × Kael 77% |
| Fácil | Dravenor × Vorath 96%, Kael × Vorath 18%, Nyxara × Vorath 21% | Lyra × Vexra 78%, Nyxara × Vorath 21% |

Na validação, o único confronto fora da faixa foi Vexra × Dravenor no difícil (78%). Na normal, nenhum.

### Confrontos na IA normal

| Confronto | Antes | Depois | Turnos antes | Turnos depois |
|---|---:|---:|---:|---:|
| Lyra × Vexra | 51% | 54% | 23,7 | 25,1 |
| Lyra × Dravenor | 64% | 55% | 40,9 | 40,0 |
| Lyra × Kael | 35% | 48% | 22,8 | 28,2 |
| Lyra × Nyxara | 55% | 45% | 21,8 | 23,8 |
| Lyra × Vorath | 42% | 50% | 42,2 | 38,8 |
| Vexra × Dravenor | 75% | **59%** | 36,8 | 36,2 |
| Vexra × Kael | 44% | 50% | 21,6 | 23,0 |
| Vexra × Nyxara | 52% | 47% | 21,0 | 22,2 |
| Vexra × Vorath | 43% | 58% | 37,5 | 34,9 |
| Dravenor × Kael | 63% | 64% | 38,0 | 37,4 |
| Dravenor × Nyxara | 30% | 47% | 35,7 | 35,1 |
| Dravenor × Vorath | **98%** | **72%** | **87,1** | **66,0** |
| Kael × Nyxara | 71% | 62% | 20,2 | 21,9 |
| Kael × Vorath | **16%** | **36%** | 37,3 | 36,3 |
| Nyxara × Vorath | **17%** | **31%** | 35,6 | 33,7 |

### Duração

| | Antes | Depois |
|---|---:|---:|
| Turnos médios, normal | 34,8 | 33,5 |
| Turnos médios, difícil | 33,3 | 32,5 |
| Dravenor × Vorath, normal (média / máximo) | 87,1 / 109 | 66,0 / 83 |
| Dravenor × Vorath, difícil (média / máximo) | 82,8 / 95 | 62,0 / 77 |
| Dravenor × Vorath, fácil (média / máximo) | 100,0 / 133 | 70,9 / 102 |
| Vitórias do Dravenor agindo primeiro, normal | 98,0% | 72,0% |

### Uso das habilidades revisadas (% das ações do personagem)

| Habilidade | Normal antes | Normal depois | Difícil antes | Difícil depois |
|---|---:|---:|---:|---:|
| Barreira Arcana | 0,6% | 7,5% | 0,0% | 6,0% |
| Torre Automática | 0,8% | 10,8% | 0,0% | 11,3% |
| Sobrecarga | 0,8% | 11,7% | 0,0% | 9,5% |
| Passo Etéreo | 1,0% | 7,6% | 0,0% | 7,0% |
| Duelo Perfeito | 1,0% | 15,8% | 0,0% | 16,9% |
| Véu Espectral / do Massacre | 1,1% | 5,3% | 0,0% | 3,2% |
| Eclipse de Vaelith | 10,3% | 10,0% | 10,7% | 10,6% |

Nenhuma delas virou obrigatória: o ataque básico e as habilidades de dano continuam sendo a maior parte das ações.

Repeti o teste de uso forçado com os valores novos. O uso forçado continua pior que a escolha da IA, que é o esperado: essas habilidades valem no momento certo, não em todo turno.

| Habilidade | Vitórias com a IA escolhendo | Com uso forçado: antes da revisão | Com uso forçado: depois |
|---|---:|---:|---:|
| Sobrecarga | 53,6% | 8,0% | 41,6% |
| Torre Automática | 53,6% | 9,2% | 47,5% |
| Duelo Perfeito | 47,6% | 9,3% | 42,8% |
| Barreira Arcana | 57,2% | 2,7% | 35,3% |
| Passo Etéreo | 47,6% | 5,6% | 9,7% |
| Véu Espectral | 50,0% | 7,2% | 6,7% |

- Os bônus (Sobrecarga, Torre e Duelo) agora custam pouco mesmo usados sem critério.
- As esquivas (Passo Etéreo e Véu) são reações: usadas em todo turno, trocam ataques por uma chance de no máximo 50%. Por isso a IA só as escolhe quando o próximo golpe do adversário é forte.

Eclipses por luta: 1,36 (normal) e 1,35 (difícil), praticamente iguais a antes.

### Ações por personagem depois da revisão (IA normal)

| Personagem | Ações mais usadas |
|---|---|
| Lyra | ataque 35,2%, Orbe Astral 22,9%, Supernova 11,2%, Barreira Arcana 7,5%, Campo de Estrelas 6,6%, poção 6,5%, elixir 4,5% |
| Vexra | ataque 25,7%, Rajada Perfurante 21,4%, Granada Explosiva 17,8%, Sobrecarga 11,7%, Torre Automática 10,8%, poção 7,2% |
| Dravenor | ataque 40,7%, Golpe Devastador 22,9%, Ruptura da Terra 11,1%, Fúria Ancestral 8,0%, defender 5,5%, poção 4,7%, Pele de Ferro 1,0% |
| Kael | ataque 31,0%, Lâmina Arcana 21,5%, Duelo Perfeito 15,8%, Corte Dimensional 9,5%, Passo Etéreo 7,6%, poção 6,8% |
| Nyxara | ataque 37,6%, Lâmina Sombria/Dilacerante 32,3%, Eclipse 10,0%, poção 7,4%, Véu 5,3%, Marca 1,0% |
| Vorath | ataque 42,6%, Impacto do Abismo 20,1%, Ruptura do Vazio 12,4%, Assimilação 6,1%, defender 5,7%, poção 4,9%, Massa Instável 4,1% |

## 5. Nyxara: verificação da transformação

Cada item abaixo tem teste automatizado em `tests/nyxara.test.ts`:

- **Influência**:
  - +15 por dano direto, +10 por dano direto recebido e +10 por habilidade normal;
  - sem contar golpes múltiplos nem dano periódico;
  - para em 100.
- **Véu Espectral**: +20 de influência quando a esquiva funciona, e nada a mais quando o golpe acerta.
- **Ultimate**:
  - bloqueada antes de 100 e liberada com 100;
  - com Eclipse ativo, fica bloqueada (**não há transformação simultânea**);
  - depois do retorno, a recarga de 5 turnos impede outra transformação mesmo com a influência cheia.
- **Duração**: 3 turnos próprios completos; o turno da ativação não conta.
- **Troca**:
  - atributos e habilidades mudam na mesma instância;
  - as versões normal e bestial compartilham os ids, então as recargas são mantidas.
- **Retorno**:
  - vida, energia, efeitos e recargas são preservados;
  - os atributos e habilidades normais voltam.
- **Fim da luta durante o Eclipse**:
  - derrotada: a batalha termina normalmente;
  - vencendo: a batalha termina sem eventos depois do fim e não aceita novas ações;
  - um novo combate começa na forma normal.

## 6. Testes executados nesta revisão

| Comando | Resultado |
|---|---|
| `npm test` | **103 testes aprovados** em 7 arquivos |
| `npm run typecheck` | sem erros |
| `npm run build` | build de produção gerado |
| `npm run simulate` | fácil, normal e difícil: 100 por par (sementes 1 a 100) e 150 por par (sementes 1001 a 1150) |
| Verificação no navegador | Chrome sem interface (Playwright), com o build de produção: duelo completo Vexra × Vorath até a tela de resultado, textos novos das habilidades, três disparos da Torre e Eclipse da Nyxara nas capturas de `docs/screenshots`. Nenhum erro no console. |

Testes novos ou atualizados nesta revisão:

- **Habilidades revisadas**:
  - Barreira por 2 turnos;
  - Torre 30 × 3;
  - Sobrecarga +40% por 3 turnos;
  - Passo Etéreo com revide só na esquiva;
  - Duelo Perfeito;
  - Véu do Massacre com revide de poder 1,0.
- **Passivas** com os valores novos, incluindo o atordoamento de 40% com rolagem injetada.
- **Nyxara**: os seis casos da seção 5 que não existiam antes.
- **IA**:
  - bônus perde valor perto do fim da luta;
  - o fácil não planeja;
  - a Barreira vale mais sob ameaça letal;
  - o elixir é usado quando libera a habilidade mais forte, e não com energia cheia.
- **Balanceamento**: além do agregado, nenhum confronto fora de 20% a 80% e nenhum acima de 75 turnos.

## 7. Pendências

- **Dificuldade fácil.** Lyra fica em 60–65% e Nyxara em 36%.
  - No fácil, 35% das ações são aleatórias e a IA não planeja.
  - A Lyra tem o kit mais "à prova de erro"; a Nyxara (complexidade 5/5) depende de gerir a influência.
  - A meta continua sendo medida nas dificuldades normal e difícil.
- **Dravenor × Vorath ainda é o confronto mais longo**: 62 a 66 turnos em média (máximo 83), contra 87 antes. É tanque contra tanque. Encurtar mais exigiria tirar a sustentação que define os dois.
- **Confrontos favoráveis no difícil.** Vexra × Dravenor (72–78%), Lyra × Kael (66–77%) e Kael × Nyxara (~70%) seguem desequilibrados.
  - A causa principal continua sendo a **ordem fixa de turnos**: o mais veloz sempre começa, e as lutas têm pouca variação.
  - Dar mais peso ao acaso ou alternar quem começa seria uma mudança de regra global, fora do escopo desta revisão.
- **Habilidades só de defesa continuam raras**: Pele de Ferro (1%), Marca do Abismo (1%) e Massa Instável (4%).
  - Na fórmula `100 / (100 + defesa)`, mudar a defesa em 25% a 35% altera o dano em só 5% a 10%. Gastar uma ação nisso quase nunca compensa.
  - Melhorar essas habilidades exige rever a fórmula de defesa ou trocar o efeito delas, o que muda regras ou identidades. Fica como decisão de design.
- **IA contra IA não mede diversão.** Falta confirmar com partidas reais, sobretudo o ritmo das lutas longas e a leitura das habilidades de suporte.

## Histórico (fase anterior)

Na integração do documento, os valores provisórios davam:

- Dravenor com **100%** de vitórias e Lyra com **5,6%** (IA normal);
- os tanques dominavam pela combinação de vida, defesa 48 e cura.

Naquela fase foram ajustados só atributos do nível 1:

| Personagem | Vida | Ataque | Defesa |
|---|---|---|---|
| Lyra | 540 → 600 | 78 → 82 | 20 → 22 |
| Vexra | 610 → 630 | 86 | 22 |
| Dravenor | 850 → 760 | 64 → 54 | 48 → 34 |
| Kael | 570 → 580 | 80 | 24 |
| Vorath | 880 → 840 | 60 | 42 → 34 |

O agregado foi para 41,8% a 56,8% (IA normal). Os confrontos extremos e as habilidades pouco usadas ficaram registrados como pendência, e foram o ponto de partida desta revisão.

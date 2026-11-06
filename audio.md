# Efeitos sonoros (3.5.0)

Esta versão integra a biblioteca sonora criada para o projeto: 15 efeitos gerados no Adobe Firefly, sendo 14 de habilidades e 1 impacto genérico. Cada som toca no instante do acontecimento que representa (o disparo, o golpe, a explosão ou o clarão) e não no momento em que a habilidade é escolhida.

O `BattleEngine`, os cálculos, as habilidades, os custos e as recargas não mudaram. Toda a integração está na camada de apresentação.

## Arquivos e momentos de reprodução

| Personagem | Habilidade | Arquivo | Ponto principal no arquivo | Coincide com |
| --- | --- | --- | --- | --- |
| Lyra | Orbe Astral | `lyra-astral-orb` | 0,08 s | Saída do orbe do cajado |
| Lyra | Supernova | `lyra-supernova` | 0,90 s (explosão) | Explosão no alvo; a subida do som acompanha a carga no cajado |
| Vexra | Rajada Perfurante | `vexra-piercing-burst` | 0,01 s e 0,26 s | Um trecho para cada um dos dois tiros |
| Vexra | Granada Explosiva | `vexra-explosive-grenade` | 0,06 s (detonação) | Explosão no alvo; o arremesso tem um sopro sintetizado curto |
| Vexra | Torre Automática (disparo) | `vexra-auto-turret-shot` | 0,22 s | Cada tiro real da torre registrado pelo motor |
| Dravenor | Golpe Devastador | `dravenor-devastating-blow` | 0,27 s | Contato do machado; o assobio do machado acompanha a investida |
| Dravenor | Ruptura da Terra | `dravenor-earth-rupture` | 0,09 s | Machado batendo no chão; o estrondo segue com a rachadura |
| Kael | Lâmina Arcana | `kael-arcane-blade` | 0,13 s | Corte em X |
| Kael | Corte Dimensional | `kael-dimensional-cut` | 0,33 s | Abertura da fenda no alvo |
| Nyxara | Lâmina Sombria | `nyxara-shadow-blade` | 0,33 s | Corte da foice |
| Nyxara | Eclipse de Vaelith | `nyxara-eclipse` | 0,62 s (surto) | Clarão vermelho e troca da arte; o início acompanha a energia convergindo |
| Vaelith | Lâmina Dilacerante | `vaelith-shadow-blade` | 0,30 s | Corte da foice |
| Vorath | Impacto do Abismo | `vorath-abyss-impact` | 0,07 s | Garras |
| Vorath | Ruptura do Vazio | `vorath-void-rupture` | 0,83 s (estouro) | Implosão; a sucção acompanha a carga sobre o alvo |
| Geral | Impacto comum | `general-combat-impact` | 0,08 s | Golpes sem som próprio (substitui o antigo `punch.mp3`) |

Os pontos principais foram medidos no envelope de volume e no espectrograma de cada arquivo. Eles ficam em `src/ui/sound/soundCatalog.ts` (`CLIPS`) e podem ser ajustados ali.

### Como o som acompanha a animação

1. **Previsão.** Quando uma ação começa, a interface calcula quanto falta para o disparo e para o impacto, usando as mesmas durações da coreografia (`TIMING` em `choreography.ts`).
2. **Agendamento.** O arquivo é agendado no relógio do Web Audio para que o seu ponto principal caia nesse instante, mais uma folga de 110 ms.
   - Se sobra tempo, o som começa atrasado.
   - Se falta tempo, ele começa já, pulando parte da preparação.
3. **Encontro.** No momento do disparo, do impacto ou do clarão, a animação espera, se for preciso, pelo instante marcado pelo som. É no máximo alguns quadros.

Assim, os dois coincidem mesmo quando a animação atrasa num aparelho mais lento. Com o som desligado, a animação não espera nada.

### Regras

- **Habilidade com som próprio:** toca só o arquivo dela; o impacto genérico não toca por cima.
- **Habilidade sem arquivo:** continua com o som sintetizado ao ser usada e com o impacto genérico no golpe.
- **Ataque básico e revide:** impacto genérico no instante do golpe.
- **Crítico:** o mesmo impacto, 2 dB mais alto, com um tom grave curto. Ele soa no golpe, antes da pausa do crítico.
- **Dano contínuo (queimadura, sangramento):** impacto genérico 9 dB mais baixo.
- **Esquiva:**
  - nenhum impacto confirmado toca;
  - sons de disparo (orbe, tiros, golpe no chão) tocam inteiros, porque o disparo aconteceu;
  - sons com preparação longa (Supernova, lâminas, Corte Dimensional, Golpe Devastador, Ruptura do Vazio) param com um fade logo antes do golpe;
  - golpes secos (Lâmina Arcana, garras, granada) não tocam.
- **Torre:** a implantação usa o som sintetizado. Cada disparo da torre toca `vexra-auto-turret-shot`, um por dano `turret` emitido pelo motor.
- **Nyxara e Vaelith:** a Lâmina Sombria e a Lâmina Dilacerante têm o mesmo id. O som é escolhido pela **forma ativa** naquele ponto da luta, acompanhada pelos eventos `form-change`, e não pela imagem mostrada.
- **Eclipse:**
  - toca uma única vez por transformação, no evento `form-change`;
  - o uso da habilidade não toca o som genérico;
  - um segundo aviso da mesma forma é ignorado;
  - a volta à forma normal mantém o som de bônus.
- **Nocaute:** continua com `fatality.mp3` até existir um som próprio.

## Volume

Os arquivos vieram do Firefly com volumes bem diferentes: o mais alto estava cerca de 8 dB acima do mais baixo, e vários tinham picos cortados (clipping) no próprio arquivo.

**Normalização.** Cada arquivo foi convertido para MP3 (48 kHz, estéreo, VBR de cerca de 190 kbps) com:

- ajuste de ganho pela loudness momentânea máxima (janela de 400 ms, padrão EBU R128);
- um limitador com teto de −1 dBFS.

**Alvos de loudness.** Os efeitos maiores ficaram um pouco mais intensos sem ficarem excessivos:

| Grupo | Alvo |
| --- | --- |
| Golpes finais e transformação (Supernova, Ruptura da Terra, Corte Dimensional, Eclipse, Ruptura do Vazio) | −10,5 LUFS |
| Demais habilidades | −12 LUFS |
| Impacto genérico (frequente) | −13 LUFS |
| Tiro da torre (frequente e curto) | −14 LUFS |

Os valores obtidos ficaram a até 1,3 dB do alvo, com pico máximo de −0,7 dBFS. O ganho aplicado a cada arquivo está em `assets-source/audio/ajustes.json`.

**Preservação.** A duração e o conteúdo foram preservados: a correlação entre original e convertido mostrou deslocamento de 0 ms em todos. Os picos que já vinham cortados no original não podem ser recuperados; o limitador só evita que piorem.

**Na reprodução:**

- tudo passa por um compressor de segurança, que só age quando vários sons se somam, e pelo volume geral das opções;
- com o som desligado (ou volume zero), nada toca, e o que estiver tocando para na hora;
- no máximo 6 arquivos tocam ao mesmo tempo; o mais antigo é encerrado;
- o mesmo trecho pedido duas vezes no mesmo instante toca uma vez só.

**Carregamento.**

- Cada luta pré-carrega só os sons dos dois lutadores, mais o impacto e o nocaute, e libera os da luta anterior.
- Ao sair da tela de batalha, os sons em andamento são interrompidos.
- Os 15 arquivos somam cerca de 560 kB, contra 4,3 MB dos originais.

## Sons que continuam sintetizados

- Habilidades sem arquivo próprio: Campo de Estrelas, Barreira Arcana, Torre Automática (implantação), Sobrecarga, Pele de Ferro, Fúria Ancestral, Passo Etéreo, Duelo Perfeito, Marca do Abismo, Marca Profana, Véu Espectral, Véu do Massacre, Assimilação e Massa Instável.
- Arremesso da granada.
- Menus, turno, defesa, cura, bônus, penalidades, esquiva, vitória e derrota.

O manifesto da biblioteca (`assets-source/audio/manifesto_sons.json`) lista os 14 complementares planejados e o nocaute.

## Onde fica cada coisa

| Caminho | Conteúdo |
| --- | --- |
| `assets-source/audio/` | Arquivos originais do Firefly (WAV e MP3), sem alteração, com o manifesto, os prompts e `ajustes.json`. Não entram no build. |
| `src/assets/sounds/combat/` | Versões normalizadas usadas pelo jogo. |
| `src/ui/sound/soundCatalog.ts` | Catálogo: arquivos, pontos principais e qual habilidade usa qual som. |
| `src/ui/sound/soundFiles.ts` | Endereço de cada arquivo (resolvido pelo Vite). |
| `src/ui/sound/schedule.ts` | Cálculo de início, trecho e fade. |
| `src/ui/sound/BattleSound.ts` | Regras de quando tocar o quê, a partir dos eventos da luta. |
| `src/ui/AudioManager.ts` | Web Audio: carregamento, reprodução, volume, compressor e limpeza. |

## Como adicionar um novo efeito

1. Guarde o original em `assets-source/audio/`.
2. Meça a loudness momentânea máxima do arquivo, com qualquer medidor EBU R128 de janela de 400 ms. Depois converta com o ganho que leva ao alvo do grupo:
   ```
   ffmpeg -i original.wav -af "volume=<ganho>dB,alimiter=limit=0.84:attack=1:release=60:level=false:latency=true" -ar 48000 -ac 2 -c:a libmp3lame -q:a 2 src/assets/sounds/combat/<id>.mp3
   ```
   Registre o ganho em `assets-source/audio/ajustes.json`.
3. Em `soundCatalog.ts`:
   - acrescente o id em `ClipId` e em `CLIPS`, com a duração e o ponto principal (`hitAt`);
   - associe-o à habilidade em `ABILITY_CUES`. Use `id@forma` quando o som depender da forma.
   - Em `sync`, escolha `launch` (disparo, golpe no chão) ou `impact` (contato com o alvo).
   - Em `kind`, escolha `release` (toca mesmo se o alvo esquivar) ou `impact` (contém o golpe confirmado).
4. Importe o arquivo em `soundFiles.ts`.
5. Rode `npm test`. Os testes conferem a associação, a existência do arquivo e se o ponto principal está dentro dele.

Para o nocaute, troque o arquivo de `knockout` em `soundFiles.ts` e ajuste a duração em `CLIPS`.

## Verificação realizada

| Verificação | Resultado |
| --- | --- |
| `npm test` | 138 testes passando (31 novos em `tests/sound.test.ts`). |
| `npm run typecheck` e `npm run build` | Sem erros. |
| Novos testes | Associação dos arquivos; Nyxara × Vaelith por forma ativa; um tiro de torre por disparo do motor (também numa luta real); som sintetizado e impacto genérico como alternativa; esquiva; trechos da Rajada; volume, som desligado, limite de vozes, repetição e liberação de memória no `AudioManager`; Eclipse tocando uma única vez numa luta real. |
| Sincronização no navegador | Chrome sem interface com Playwright e o build de produção. Registrei o instante em que cada som atinge o ponto principal e o instante em que o efeito visual correspondente aparece. Foram lutas com os seis personagens, todas as habilidades e o Eclipse. Resultado: |

**Resultado da sincronização no navegador** (diferença entre som e efeito visual):

| Som | Diferença |
| --- | --- |
| Sons próprios das habilidades | Na medição final, com folga de 110 ms, todos ficaram entre −12 ms e 0 ms (a maioria entre 0 e −1 ms), nos 14 sons próprios. Numa medição anterior, com folga de 90 ms, um caso da Lâmina Dilacerante ficou em −32 ms; por isso a folga subiu. |
| Impacto genérico | Cerca de 30 ms depois do golpe visual, de propósito, para não cortar o ataque do som. |
| Torre | Testada separadamente: 3 disparos com 3 sons de torre. |
| Nocaute | Testado separadamente: tocou no fim da luta. |

Também foram verificados:

- com movimento reduzido, os sons continuam tocando;
- com o som desligado nas opções, nenhum arquivo foi iniciado;
- nenhum erro no console;
- sem rolagem horizontal nas telas de 1920, 1440, 768, 390 e 360 px. Isso foi conferido no roteiro de verificação visual das versões anteriores, que também confirmou o Eclipse entrando e saindo.

### Limitações

- A medição usa o relógio do navegador e os instantes em que os efeitos entram na página. Ela não inclui a latência da placa de som nem a do monitor, que variam de aparelho para aparelho.
- Não ouvi os sons: a escolha dos pontos principais veio da análise do sinal. Vale ouvir cada habilidade e, se algum momento parecer adiantado ou atrasado, ajustar `hitAt` no catálogo.
- Só testei no Chrome. Safari e Firefox suportam o que foi usado (Web Audio e MP3), mas não foram testados.
- O arremesso da granada usa um sopro sintetizado, porque o arquivo da granada é praticamente só a explosão.

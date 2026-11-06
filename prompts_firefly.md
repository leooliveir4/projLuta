# Arena RPG — Biblioteca Sonora v1.1

Planejamento de **28 efeitos**: **3 já prontos** (Eclipse da Nyxara, Orbe Astral e Supernova da Lyra) e **25 a gerar** no Adobe Firefly. O jogo já possui efeitos genéricos para ataque comum, esquiva, defesa, cura, interface, vitórias e derrotas; **não é necessário recriá-los nesta rodada**. Assim cobrimos as habilidades dos seis personagens e as variações da Vaelith sem gastar créditos em sons pouco diferenciados.

## Como usar com o Firefly

1. Para cada faixa abaixo, cole o **prompt em inglês** na ferramenta de geração de efeitos sonoros. Use uma geração por efeito (ou variações, se o Firefly oferecer).
2. Escolha a duração aproximada indicada. Aceite a duração mais próxima que o Firefly permitir, sem estender artificialmente o silêncio.
3. Ouça os resultados e preserve apenas o mais fiel. Evite efeitos com música, voz inteligível, fundo de vento constante ou volume excessivo.
4. Salve preferencialmente WAV; renomeie com o nome indicado sem mudar falsamente a extensão. Se receber MP3, preserve a extensão MP3.
5. Guarde os escolhidos na pasta `audio/`. Quando todos estiverem concluídos, reúna-os em ZIP com este catálogo e o manifesto e envie ao Claude **uma vez só** para integrar.
6. **Faça primeiro os marcados ESSENCIAL**, depois os COMPLEMENTARES. Eclipse, Orbe Astral e Supernova estão prontos e incluídos neste pacote.

### Direção sonora
- Jogo de fantasia sombria com leitura clara: um evento sonoro principal por ação; efeitos sem música e sem diálogos.
- Manter picos semelhantes ao ouvido, sem distorção; hits mais secos e habilidades finais mais encorpadas.
- Sons normais ~0,5–1,6 s, especiais ~1,8–2,6 s. Gerar cada som isoladamente.
- Os sons da Vaelith devem ser claramente mais graves e ferozes que os da Nyxara base, mantendo identidade comum.

## Catálogo e prompts

### Lyra

#### Orbe Astral — ESSENCIAL
**Arquivo:** `audio/lyra-astral-orb.wav`  
**Duração sugerida:** 1,2 s  
**Momento:** `release`  

```text
A bright celestial magic orb charges with tiny crystalline chimes, launches with a smooth airy whoosh, and bursts with a shimmering blue-white magical crack. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Campo de Estrelas — COMPLEMENTAR
**Arquivo:** `audio/lyra-star-field.wav`  
**Duração sugerida:** 1,5 s  
**Momento:** `impact`  

```text
Several delicate astral stars rain down in quick succession with sparkling glasslike tinkles and soft pulsing celestial impacts. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Barreira Arcana — COMPLEMENTAR
**Arquivo:** `audio/lyra-arcane-barrier.wav`  
**Duração sugerida:** 1,1 s  
**Momento:** `activation`  

```text
A protective magical dome unfurls with a rising glassy shimmer, a soft resonant chime and a gentle stable energy hum that rapidly fades. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Supernova — ESSENCIAL
**Arquivo:** `audio/lyra-supernova.wav`  
**Duração sugerida:** 2,5 s  
**Momento:** `charge+impact`  

```text
A powerful cosmic spell charges with rising crystalline harmonics and deep astral energy, then releases a massive radiant magical burst with a clean, bass-rich impact. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```


### Vexra

#### Rajada Perfurante — ESSENCIAL
**Arquivo:** `audio/vexra-piercing-burst.wav`  
**Duração sugerida:** 1,1 s  
**Momento:** `release`  

```text
A rapid burst of three sharp steampunk arcane cannon shots with metallic mechanisms, bright muzzle blasts and tight mechanical recoil. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Granada Explosiva — ESSENCIAL
**Arquivo:** `audio/vexra-explosive-grenade.wav`  
**Duração sugerida:** 1,6 s  
**Momento:** `impact`  

```text
A small mechanical grenade clicks and whistles through the air, then detonates with a heavy, punchy fantasy explosion and short metal debris rattle. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Torre Automática — ativação — COMPLEMENTAR
**Arquivo:** `audio/vexra-auto-turret.wav`  
**Duração sugerida:** 1,5 s  
**Momento:** `activation`  

```text
A compact steampunk auto turret unfolds from metal panels with precise servo whirs, gear clicks, and a final short electric targeting beep. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Torre Automática — disparo — COMPLEMENTAR
**Arquivo:** `audio/vexra-auto-turret-shot.wav`  
**Duração sugerida:** 0,45 s  
**Momento:** `turret-impact`  

```text
A single short automated mechanical turret shot: tight metallic snap, compressed magical muzzle blast and a quick decaying electrical tail. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Sobrecarga — COMPLEMENTAR
**Arquivo:** `audio/vexra-overload.wav`  
**Duração sugerida:** 1,4 s  
**Momento:** `activation`  

```text
A steampunk cannon powers up: ticking relays, rising electric coil, pressurized mechanical whine and a brief satisfying charge-lock click. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```


### Dravenor

#### Golpe Devastador — ESSENCIAL
**Arquivo:** `audio/dravenor-devastating-blow.wav`  
**Duração sugerida:** 1,15 s  
**Momento:** `impact`  

```text
A gigantic battle axe sweeps through the air and strikes thick armor with a thunderous low metal-and-stone impact and short gritty debris. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Pele de Ferro — COMPLEMENTAR
**Arquivo:** `audio/dravenor-iron-skin.wav`  
**Duração sugerida:** 1,2 s  
**Momento:** `activation`  

```text
Heavy stone and iron plates shift and harden around a warrior, with layered metallic clanks, gritty grinding and a solid shield-lock resonance. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Fúria Ancestral — COMPLEMENTAR
**Arquivo:** `audio/dravenor-ancestral-fury.wav`  
**Duração sugerida:** 1,5 s  
**Momento:** `activation`  

```text
A deep nonverbal warrior battle growl blends with ancient ritual energy swelling under rumbling drums and a brief fiery surge; no words. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Ruptura da Terra — ESSENCIAL
**Arquivo:** `audio/dravenor-earth-rupture.wav`  
**Duração sugerida:** 2,0 s  
**Momento:** `impact`  

```text
An enormous heavy axe slams into the ground, sending a fast spreading stone fracture and seismic rumble, ending in a sharp rock eruption. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```


### Kael

#### Lâmina Arcana — ESSENCIAL
**Arquivo:** `audio/kael-arcane-blade.wav`  
**Duração sugerida:** 1,1 s  
**Momento:** `impact`  

```text
An elegant magical sword cuts rapidly through air with a crisp steel swish, shimmering azure arcane trail and a bright clean sword impact. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Passo Etéreo — COMPLEMENTAR
**Arquivo:** `audio/kael-ethereal-step.wav`  
**Duração sugerida:** 0,9 s  
**Momento:** `activation`  

```text
A swift supernatural teleport dash: thin whispering wind, spectral phase shimmer, reverse airy suction and a tiny crystalline arrival snap. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Duelo Perfeito — COMPLEMENTAR
**Arquivo:** `audio/kael-perfect-duel.wav`  
**Duração sugerida:** 1,15 s  
**Momento:** `activation`  

```text
A poised arcane duelist enters focus: subtle rising harmonic energy, two graceful steel ring tones and a controlled magical power-up pulse. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Corte Dimensional — ESSENCIAL
**Arquivo:** `audio/kael-dimensional-cut.wav`  
**Duração sugerida:** 2,0 s  
**Momento:** `impact`  

```text
A razor-sharp enchanted blade slices open reality with a piercing metallic slash, ominous spatial tear and a sudden deep magical crack. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```


### Nyxara

#### Lâmina Sombria — ESSENCIAL
**Arquivo:** `audio/nyxara-shadow-blade.wav`  
**Duração sugerida:** 1,25 s  
**Momento:** `impact`  

```text
A sinister long scythe makes a fast sharp diagonal slash, leaving a dark crimson spectral hiss and a biting supernatural impact. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Marca do Abismo — COMPLEMENTAR
**Arquivo:** `audio/nyxara-abyss-mark.wav`  
**Duração sugerida:** 1,3 s  
**Momento:** `activation`  

```text
A cursed mark brands an enemy: whispering shadow energy swirls inward, low eerie pulses and a brief sharp arcane seal imprint; no speech. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Véu Espectral — COMPLEMENTAR
**Arquivo:** `audio/nyxara-nyx-veil.wav`  
**Duração sugerida:** 1,1 s  
**Momento:** `activation`  

```text
A stealthy shadow veil envelops a female assassin: soft ethereal air displacement, ghostly flutter and a brief distant crimson magical echo. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Eclipse de Vaelith — PRONTO
**Arquivo:** `audio/nyxara-eclipse.mp3`  
**Duração sugerida:** 2,6 s  
**Momento:** `form-change`  

```text
Dark demonic corruption swells to a crescendo and releases a deep feminine nonverbal demon growl with a powerful magical burst. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```


### Vaelith

#### Lâmina Dilacerante — ESSENCIAL
**Arquivo:** `audio/vaelith-shadow-blade.wav`  
**Duração sugerida:** 1,45 s  
**Momento:** `impact`  

```text
A monstrous female demon swings an enormous cursed scythe: deep tearing blade whoosh, vicious layered crimson slash and heavy demonic impact. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Marca Profana — COMPLEMENTAR
**Arquivo:** `audio/vaelith-abyss-mark.wav`  
**Duração sugerida:** 1,5 s  
**Momento:** `activation`  

```text
A powerful infernal curse brands a target with boiling shadow resonance, guttural low magic distortion and a sharp corrupted seal impact. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Véu do Massacre — COMPLEMENTAR
**Arquivo:** `audio/vaelith-nyx-veil.wav`  
**Duração sugerida:** 1,3 s  
**Momento:** `activation`  

```text
An aggressive demonic crimson shroud expands around a female demon, with a shadowy rush, crackling violent energy and sharp counterstrike anticipation. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```


### Vorath

#### Impacto do Abismo — ESSENCIAL
**Arquivo:** `audio/vorath-abyss-impact.wav`  
**Duração sugerida:** 1,4 s  
**Momento:** `impact`  

```text
A colossal inhuman abyssal creature slams its massive claws down, producing deep bone-and-stone crunch, cracking armor and a subsonic cavernous impact. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Assimilação — COMPLEMENTAR
**Arquivo:** `audio/vorath-assimilation.wav`  
**Duração sugerida:** 1,6 s  
**Momento:** `impact`  

```text
An abyssal creature drains life energy with a viscous supernatural suction, wet hollow resonance and dark pulsing energy returning to the source. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Massa Instável — COMPLEMENTAR
**Arquivo:** `audio/vorath-unstable-mass.wav`  
**Duração sugerida:** 1,4 s  
**Momento:** `activation`  

```text
A monstrous living body rearranges dense rock, bone and shadow matter, with low organic creaks, granular shifting and an ominous violet energy pulse. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

#### Ruptura do Vazio — ESSENCIAL
**Arquivo:** `audio/vorath-void-rupture.wav`  
**Duração sugerida:** 2,3 s  
**Momento:** `impact`  

```text
A terrifying void implosion sucks nearby energy into an unnatural silence, then erupts in a massive cavernous bass-heavy cosmic rupture. Isolated professional fantasy video game sound effect, dry and clean, no background music, no intelligible speech, no ambient environment, no other characters.
```

## Mapeamento ao código e regras de integração

O arquivo `docs/manifesto_sons.json` já mapeia `abilityId`, `form` e `trigger` para cada faixa. Não confundir a Nyxara normal com a Vaelith: as versões melhoradas compartilham os IDs `shadow-blade`, `abyss-mark` e `nyx-veil`; selecione o áudio com base na forma `eclipse`.

**Evento da transformação:** reproduzir `nyxara-eclipse.mp3` **uma vez** no início da coreografia de `form-change` para `eclipse`, sincronizando o ápice com o clarão/troca de arte. Evitar tocar outro `ability` genérico por cima.

**Outras ações:** lançar sons no evento visual correspondente (conjuração/disparo/impacto), preservando o código e as regras originais. O evento da torre deve disparar `vexra-auto-turret-shot` cada vez que a torre ataca; não reproduzir o som de implantação em todos os tiros.

**Recomendações técnicas:** pré-carregar/decodificar os clips uma vez, suportar sons simultâneos controlados (sem acumular instâncias), respeitar `soundEnabled` e `volume`, silenciar ao sair da batalha e evitar disparos duplicados. Fallback para efeitos sintetizados já existentes. Não alterar a IA ou o balanceamento.

## Checklist final antes de enviar

- [ ] Todas as faixas ESSENCIAIS foram ouvidas e aprovadas.
- [ ] As demais faixas foram concluídas, ou as faltantes foram explicitamente marcadas como fallback genérico.
- [ ] Áudios não têm músicas, palavras, ruído contínuo nem cortes abruptos.
- [ ] Nomes de arquivo batem com o manifesto (ou manifesto atualizado para extensões finais).
- [ ] O pacote inclui `audio/`, `docs/manifesto_sons.json` e este arquivo.
- [ ] Guardar os arquivos de áudio originais para futuras edições.

**Nota:** estes são prompts criativos; os resultados dependem do Firefly e devem ser escutados e selecionados. Nenhum arquivo sonoro novo, além do Eclipse, foi gerado neste pacote.

## Efeitos gerais (adicionados no planejamento v1.8)

### Impacto genérico de combate — já gerado
Arquivo: `audio/general-combat-impact.wav`
Prompt original: A short, sharp fantasy RPG combat impact sound effect. A powerful weapon strike lands against armor with a crisp metallic hit, a subtle low-frequency thump and a very brief resonance. Punchy and satisfying, suitable for repeated turn-based combat. No music, no voices, no ambience, no long reverb.

### Nocaute / derrota — pendente por créditos
Arquivo reservado: `audio/general-knockout.wav`
Prompt: A powerful fantasy RPG knockout sound effect. A devastating final impact with a deep cinematic bass hit, followed by a brief metallic resonance and a dark fading rumble. Dramatic and satisfying, signaling that an enemy has been defeated. No music, no voices, no announcer, no ambience.

Integração: evitar que a mesma ação dispare o impacto genérico e o som exclusivo de uma habilidade ao mesmo tempo. Manter um fallback até que o efeito de nocaute esteja pronto.

# Manini · Costruito meglio. In fabbrica.

Landing page 3D, stile Apple, per i sistemi prefabbricati Manini (Ondal, Ondal+, TAU, Manini Plan, Solai). Interattivo: sole e prova al fuoco, maglia, pioggia, esploso, configuratore di capannone con cinque tetti, sisma con AllDrift®, monitoraggio Manini Connect, pioggia su tetto verde. Etichette cliccabili per approfondire.

**Concept non ufficiale**, non realizzato né approvato da Manini Prefabbricati S.p.A. Nomi, numeri e referenze sono tratti da manini.it; i modelli 3D sono ricostruzioni stilizzate.

## Aprire

`scene.js` è un modulo ES, quindi serve un server locale:

```bash
python3 -m http.server 8765
```

poi apri http://localhost:8765. Serve internet per three.js (CDN) e i font Google.

## Struttura

- `index.html`: contenuti, stile, controlli
- `scene.js`: scena three.js, camera guidata dallo scroll, simulazione sisma, Manini Connect

Colori del brand: blu `#00498a`, bianco, nero, grigi.

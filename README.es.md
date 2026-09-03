<div align="center">
  <img src="public/logo-square-dark-bg.svg" alt="Trace" width="100">

# Trace

*Sigue la información hasta donde empezó.*

<p align="center"><a href="README.md">English</a> · Español</p>

</div>

## ¿Qué es Trace?

Trace es una herramienta de rastreo de procedencia. Pegás una URL y reconstruye
de dónde vienen realmente las afirmaciones de un artículo: qué cita, quién lo
cita a él, qué es una copia casi textual en otro lado y — cuando el corpus ya
tiene suficiente para saberlo — la aparición más antigua de cada afirmación.

Acá no se inventa nada. Cada nivel de confianza, fecha del timeline y marca de
"sin verificar" se deriva de evidencia que ya está en la página o ya está en
el corpus — Trace nunca fabrica una certeza que no tiene.

## Funcionalidades

- **Extracción de artículos** — título, autor, fecha, texto completo y enlaces
  salientes de cualquier URL vía Readability, con protecciones SSRF contra
  objetivos internos o privados.
- **Detección de afirmaciones** — estadísticas, atribuciones y hechos citados
  se extraen oración por oración y se asocian a su párrafo.
- **Grafo de citas y copias** — resuelve relaciones `cites` y `copied_from`
  entre todos los artículos del corpus, incluyendo qué lado es
  cronológicamente anterior cuando las fechas lo permiten.
- **Rastreo de primera aparición** — encuentra la aparición fechada más
  antigua de una afirmación en el corpus, siendo explícito sobre la
  diferencia entre "la más antigua encontrada" y "origen confirmado".
- **Confianza, nunca inventada** — cada afirmación y relación recibe un nivel
  basado en evidencia (alto / medio / bajo / sin verificar) con el motivo
  adjunto, nunca un porcentaje inventado.
- **Detección de divergencia** — compara la redacción de una afirmación
  contra el texto real de su fuente resuelta para marcar números que no
  coinciden o afirmaciones que la fuente no respalda.
- **Búsqueda de fuentes bajo demanda** — descubrimiento de fuentes con Brave
  Search y seguimiento de cadenas con profundidad limitada, disparado por
  afirmación, una solicitud a la vez.
- **Firecrawl opcional como respaldo** — para fuentes que un fetch simple no
  puede alcanzar por protección anti-bot, disponible con cuenta iniciada.
- **Grafo de procedencia interactivo** — un grafo con posiciones automáticas,
  navegable con pan y zoom, con panel inspector y una línea de tiempo de
  cada evento fechado encontrado.
- **Historial por cuenta** — los usuarios con sesión iniciada tienen un
  historial real y privado; las visitas anónimas nunca se registran.

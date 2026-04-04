# Design System Strategy: The Nocturnal Architect

## 1. Overview & Creative North Star
The "Creative North Star" for this design system is **The Nocturnal Architect**. In the high-stakes world of UK property management, precision and calm are paramount. This system moves away from the "neon-on-black" cyberpunk aesthetic toward a sophisticated, editorial dark mode that feels more like a luxury architectural folio than a standard SaaS dashboard.

We reject the generic grid in favor of **Intentional Tonal Depth**. By utilizing a palette of warm near-blacks and rust-undertones, we create a workspace that reduces cognitive load. The layout relies on generous white space (breathing room) and sharp, high-contrast typography to guide the user’s eye, rather than heavy-handed boxes and lines.

---

## 2. Colors: Tonal Architecture
The palette is rooted in the earth. The `surface` tokens are not mere shades of grey; they are desaturated, warm-toned blacks that provide a sense of stability and premium quality.

### The "No-Line" Rule
Designers are prohibited from using 1px solid borders for structural sectioning. Spatial boundaries must be defined through **Background Shifts**. 
*   A `surface-container-low` navigation bar should sit directly against a `surface` background. 
*   The transition between the sidebar and the main canvas is marked by the shift from `#0f0e0d` to `#161513`, not a line.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of "Obsidian Glass." 
*   **Base:** `surface` (#141312) - The foundation.
*   **Elevated Sections:** `surface-container` (#211f1e) - Primary content areas.
*   **Active Elements:** `surface-container-highest` (#363433) - Floating modals or active prompt bars.

### Signature Textures
To break the flat digital plane, we utilize the **Hero Gradient**: 
*   **Token:** `secondary_container` transition.
*   **Implementation:** A radial bloom from top-center using `#3d1a0a` (warm rust) fading into the `surface` base. This is reserved for "Canvas 1" landing states to provide an authoritative, editorial welcome.

---

## 3. Typography: The Editorial Edge
We utilize **Inter** (or Geist) with a focus on "tight" tracking and intentional weight pairing.

*   **Display/Headline:** Use `display-md` (2.75rem) with `-0.04em` letter spacing. This creates a "compressed" authority seen in high-end design journals.
*   **The Muted Secondary:** Use `on_surface_variant` (#797876) for all secondary metadata. This creates a sharp contrast against the `on_surface` (#cdccca) primary text, ensuring the hierarchy is felt before it is read.
*   **Labels:** All `label-sm` elements should be in uppercase with `+0.05em` letter spacing to act as "structural markers" across the UI.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows and borders are replaced by the **Layering Principle**. 

*   **Ambient Shadows:** For floating dialogs, use a shadow color tinted with the primary rust/teal tones at 6% opacity. 
    *   *Spec:* `0px 24px 48px rgba(1, 105, 111, 0.06)`
*   **The Ghost Border:** If a boundary is required for accessibility (e.g., Input fields), use a "Ghost Border": `outline_variant` at 20% opacity. 
*   **Glassmorphism:** Use `backdrop-blur: 20px` on floating prompt bars and the sidebar. The underlying `surface` should bleed through, softening the interface and making the narrow (220px) sidebar feel integrated rather than "tacked on."

---

## 5. Components: Minimal Primitives

### Prompt Input Bars
The center-piece of the AI-driven workflow.
*   **Style:** `surface-container-highest` with a 1px "Ghost Border."
*   **Padding:** `24px` internal horizontal padding. No sharp corners; use `rounded-xl` (0.75rem).
*   **Visuals:** A single `primary` (Teal) action icon, no text buttons.

### Horizontal Progress Steppers
*   **Visual:** A thin 2px track using `outline_variant`.
*   **Active State:** A `primary` (Teal) pill badge.
*   **Layout:** Generous spacing between steps; the text label sits *above* the pill, not beside it, following an editorial vertical rhythm.

### Split-Layout Chat & Tables
*   **Tables:** Forbid row lines. Use `surface_container_low` on `:hover` to highlight data. Padding should be an aggressive `16px` vertically to ensure the data "breathes."
*   **Chat Interface:** Use a 60/40 split. The chat column (40) uses a `surface-dim` background to distinguish the "thinking" area from the "action" canvas.

### Buttons
*   **Primary:** Solid `primary_container` (#01696f) with `on_primary_container` (#97e6ec) text. 
*   **Rules:** No gradients. No rounded-full (use `rounded-md`). No drop shadows. High contrast only.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use vertical white space (32px, 48px, 64px) to separate dashboard modules instead of dividers.
*   **Do** use `surface-bright` for hover states on cards to create a "glow" effect from within the material.
*   **Do** maintain a strict 220px width for the sidebar to preserve the "Narrow Navigation" aesthetic inspired by Acme/Linear.

### Don’t
*   **Don't** use decorative orbs or "blobs." Any glow must be tied to a functional component (e.g., a button hover or a radial hero background).
*   **Don't** use pure white (#ffffff). The brightest point of the system should be `on_primary_fixed` for teal accents or `on_surface` for text.
*   **Don't** use standard 12-column grids for everything. Allow the "AI Prompt Bar" and "Canvas" to occupy asymmetrical spaces to create a bespoke feel.

---

**Director’s Note:** This system is about the "quiet power" of the space between elements. If the layout feels too "busy," increase the padding and remove a border. Let the typography and the tonal shifts do the heavy lifting.
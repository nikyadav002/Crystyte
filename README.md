# crystyte

A fully-static 3D crystal structure visualizer — no server, no login, no database.  
Runs entirely in the browser.

---

## Features

- **File formats** — POSCAR / CONTCAR / .vasp, CIF (with full symmetry expansion), XYZ / extended-XYZ
- **Parsing** — Web Worker keeps the UI thread free during file loading
- **3D Viewer** — Three.js with `InstancedMesh` for high-performance rendering
  - CPK atom colors and covalent radii, per-element
  - Bonds via Minimum Image Convention across periodic boundaries; two half-cylinders per bond, each colored by its atom
  - Unit cell box (edges only)
- **Display modes** — Ball & Stick · Spacefill (VDW) · Stick
- **Supercell** — tile 1×1×1 → 3×3×3 with live sliders
- **Info panel** — reduced formula, space group, lattice parameters (a/b/c/α/β/γ), atom count, clickable per-element color swatches
- **Export** — PNG at 1×, 2×, 4× resolution with optional transparent background
- **Dark theme**, responsive on desktop and mobile

---

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Deploying to GitHub Pages

### 1. Create a GitHub repository

Go to [github.com/new](https://github.com/new) and create a **public** repository named `crystyte`.

### 2. Push the code

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/crystyte.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username.

### 3. Enable GitHub Pages

In your repository on GitHub:

1. Go to **Settings → Pages**
2. Under **Source**, choose **GitHub Actions**
3. Click **Save**

The `.github/workflows/deploy.yml` file already included in this repo handles the build and deploy automatically on every push to `main`.

### 4. Access your site

After the first push the Actions workflow will run (takes about 1–2 minutes).  
Your site will be live at:

```
https://YOUR-USERNAME.github.io/crystyte/
```

You can check the workflow status under the **Actions** tab in your repository.

---

## Build output

```bash
npm run build   # produces dist/
```

The `dist/` folder is a fully self-contained static site you can host anywhere.

---

## Controls

| Action     | Mouse                    | Touch            |
|------------|--------------------------|------------------|
| Orbit      | Left drag                | One finger       |
| Pan        | Right drag / Middle drag | Two-finger drag  |
| Zoom       | Scroll wheel             | Pinch            |
| Reset view | Reset button in toolbar  | —                |

---

## Project structure

```
src/
  lib/
    elements.js       # CPK colors + covalent/VDW radii for all elements
    math.js           # 3×3 matrix ops, lattice conversions, MIC helpers
    structure.js      # Supercell expansion, bond detection, cell-box edges
  parsers/
    poscar.js         # VASP POSCAR / CONTCAR / .vasp
    cif.js            # CIF with symmetry expansion
    xyz.js            # XYZ / extended-XYZ
    detect.js         # Auto-detect format from filename + content
  workers/
    parser.worker.js  # All parsing runs off the UI thread
  components/
    CrystalViewer.jsx # Three.js renderer
    DropZone.jsx      # Drag-and-drop / file-picker overlay
    InfoPanel.jsx     # Formula, lattice params, color swatches
    ControlPanel.jsx  # Display mode, supercell sliders, export
  App.jsx
  index.css
.github/
  workflows/
    deploy.yml        # GitHub Actions — build and deploy to Pages on push to main
```

---

## License

MIT

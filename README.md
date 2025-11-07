# u8g2-drawing-generator

This small web app provides a 32×32 pixel editor and a code generator for the u8g2 library.
It was made as a side project and some of it is remixed from other projects.

Usage
-----

1. Open `index.html` in your browser (double-click or serve with a simple static server).
2. Paint pixels by clicking or dragging on the 32×32 grid. Right-click an individual cell to clear it.
3. Use the toolbar to Clear, Invert, or Randomize the grid.
4. Set an origin (base point): click `Set origin`, then click the cell you want to use as the origin. The chosen cell will be highlighted and shown under "Origin".
5. Choose an output mode (radio buttons in the toolbar):
	- Normal — emits absolute coordinates: `u8g2.drawPixel(X, Y);`.
	- Relative — emits expressions relative to the selected origin, e.g. `u8g2.drawPixel(15 + 7, 17 - 5);` (numeric base is the origin coordinates). Requires an origin to be set.
	- Variable — uses variable names `x` and `y` as the base, e.g. `u8g2.drawPixel(x + 7, y - 5);`. Requires an origin to be set.
6. Optionally change the Prefix and Suffix fields to match your preferred function wrapper.
7. Click `Generate Code` to produce lines in the code box. You can Copy or Download the generated code.
8. To import code back into the editor, paste code into the textbox and click `Import code` (the importer expects the same prefix/suffix you used when exporting).

Notes & tips
---------------
- If you pick Relative or Variable modes but haven't set an origin, the generator will prompt you to set one and abort generation.
- Variable mode is useful when you want to emit code that will be used inside a loop or function using `x`/`y` as dynamic base coordinates.
- The origin highlight uses a visible outline to help you identify the base pixel.
- Presets clear the whole grid so beware, you can quickly reset your progress and will need to start over
- When a line is draw the app checks the direction and outputs a drawLine function. If you do not want this feature download [v3.0.0](https://github.com/vectoren/u8g2-drawing-generator/releases/tag/v.3.0.0).


Contribution
---------------
Pull requests welcome.

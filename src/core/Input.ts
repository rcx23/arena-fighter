/**
 * Polled keyboard/mouse state. Listeners write into the maps; gameplay code
 * polls during the fixed update. `wasPressed` is edge-triggered and cleared
 * once per simulation tick via endFrame().
 */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  mouseScreen = { x: 0, y: 0 };
  mouseDown = false;
  private mousePressed = false;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouseDown = false;
    });
    target.addEventListener('mousemove', (e) => {
      this.mouseScreen.x = e.clientX;
      this.mouseScreen.y = e.clientY;
    });
    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mousePressed = true;
      }
      if (e.button === 2) this.pressed.add('MouseRight');
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  wasMousePressed(): boolean {
    return this.mousePressed;
  }

  endFrame(): void {
    this.pressed.clear();
    this.mousePressed = false;
  }
}
